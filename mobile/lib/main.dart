import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:app_links/app_links.dart';
import 'package:crypto/crypto.dart' as crypto;
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'app_update.dart';
import 'favorites.dart';
import 'appearance.dart';
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

const baseUrl = 'https://yukvinc.com.tr';
const navy = Color(0xFF172D35);
const yellow = Color(0xFFFFC466);
const green = Color(0xFF0D6D5C);
const bg = Color(0xFFF0F5F5);

class MemberIdentity {
  const MemberIdentity({required this.id, required this.email});
  final String id;
  final String email;
  factory MemberIdentity.fromJson(Map<String, dynamic> value) => MemberIdentity(
    id: (value['id'] ?? '').toString(), email: (value['email'] ?? '').toString());
}

class MemberAuth {
  static const _storage = FlutterSecureStorage();
  static final user = ValueNotifier<MemberIdentity?>(null);
  static final status = ValueNotifier<String>('');
  static final busy = ValueNotifier<bool>(false);
  static final _random = math.Random.secure();
  static String? _cookie;
  static String? _processingCode;
  static String? _completedCode;
  static StreamSubscription<Uri>? _linkSubscription;
  static bool _initialized = false;

  static String _randomToken() => base64Url.encode(
    List<int>.generate(32, (_) => _random.nextInt(256))).replaceAll('=', '');

  static String _challenge(String verifier) =>
    base64Url.encode(crypto.sha256.convert(utf8.encode(verifier)).bytes).replaceAll('=', '');

  static Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    try {
      _cookie = await _storage.read(key: 'yv_member_cookie');
      final email = await _storage.read(key: 'yv_member_email');
      final id = await _storage.read(key: 'yv_member_id');
      if (_cookie != null && email != null && id != null) {
        user.value = MemberIdentity(id: id, email: email);
        unawaited(_refresh());
      }
      final links = AppLinks();
      _linkSubscription ??= links.uriLinkStream.listen(
        (uri) => unawaited(_handleCallback(uri)),
        onError: (_) => status.value = 'Uygulama bağlantısı açılamadı. Tekrar giriş yap.',
      );
      final initial = await links.getInitialLink();
      if (initial != null) await _handleCallback(initial);
    } catch (_) {
      // Sign-in remains available when the platform link plugin is not ready.
    }
  }

  static Future<void> beginGoogleSignIn() async {
    if (busy.value) return;
    busy.value = true;
    status.value = 'Güvenli Google giriş sayfası açılıyor…';
    try {
      final state = _randomToken(), verifier = _randomToken();
      await _storage.write(key: 'yv_auth_state', value: state);
      await _storage.write(key: 'yv_auth_verifier', value: verifier);
      final handoff = Uri(
        path: '/api/auth/mobile-handoff',
        queryParameters: {
          'app': 'android',
          'state': state,
          'code_challenge': _challenge(verifier),
          'code_challenge_method': 'S256',
        },
      );
      final uri = Uri.parse('$baseUrl/giris/').replace(queryParameters: {
        'next': handoff.toString(),
      });
      var opened = false;
      try { opened = await launchUrl(uri, mode: LaunchMode.inAppBrowserView); } catch (_) {}
      if (!opened) opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened) throw StateError('Giriş sayfası açılamadı.');
    } catch (_) {
      status.value = 'Google giriş sayfası açılamadı. İnternet bağlantını kontrol et.';
    } finally {
      busy.value = false;
    }
  }

  static Future<void> _handleCallback(Uri uri) async {
    if (uri.scheme != 'yukvinc' || uri.host != 'auth' || uri.path != '/callback') return;
    final code = uri.queryParameters['code'] ?? '';
    final state = uri.queryParameters['state'] ?? '';
    if (code.isEmpty || code == _processingCode || code == _completedCode) return;
    _processingCode = code;
    busy.value = true;
    status.value = 'Google oturumu güvenle doğrulanıyor…';
    try {
      final expectedState = await _storage.read(key: 'yv_auth_state');
      final verifier = await _storage.read(key: 'yv_auth_verifier');
      if (expectedState == null || verifier == null || state != expectedState) {
        throw StateError('Giriş doğrulaması uyuşmadı. Yeniden dene.');
      }
      final response = await http.post(Uri.parse('$baseUrl/api/auth/mobile-exchange'),
        headers: const {'Content-Type': 'application/json', 'Origin': baseUrl},
        body: jsonEncode({'code': code, 'code_verifier': verifier}),
      ).timeout(const Duration(seconds: 15));
      Map<String, dynamic> body = {};
      try {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded is Map) body = Map<String, dynamic>.from(decoded);
      } catch (_) {}
      if (response.statusCode != 200 || body['user'] is! Map) {
        throw StateError((body['error'] ?? 'Google girişi tamamlanamadı.').toString());
      }
      final cookieHeader = response.headers['set-cookie'] ?? '';
      final pair = cookieHeader.split(';').first;
      const prefix = '__Host-yv_member=';
      if (!pair.startsWith(prefix)) throw StateError('Güvenli oturum kaydedilemedi.');
      final cookie = Uri.decodeComponent(pair.substring(prefix.length));
      final identity = MemberIdentity.fromJson(Map<String, dynamic>.from(body['user'] as Map));
      if (cookie.isEmpty || identity.id.isEmpty || identity.email.isEmpty) {
        throw StateError('Google hesabı yanıtı eksik.');
      }
      await _storage.write(key: 'yv_member_cookie', value: cookie);
      await _storage.write(key: 'yv_member_id', value: identity.id);
      await _storage.write(key: 'yv_member_email', value: identity.email);
      await _storage.delete(key: 'yv_auth_state');
      await _storage.delete(key: 'yv_auth_verifier');
      _cookie = cookie;
      user.value = identity;
      _completedCode = code;
      status.value = 'Google hesabınla giriş yaptın.';
    } catch (error) {
      status.value = error is StateError ? error.message : 'Google girişi tamamlanamadı. Tekrar dene.';
    } finally {
      _processingCode = null;
      busy.value = false;
    }
  }

  static Future<void> _refresh() async {
    final cookie = _cookie;
    if (cookie == null || cookie.isEmpty) return;
    try {
      final response = await http.get(Uri.parse('$baseUrl/api/auth/me'),
        headers: {'Accept': 'application/json', 'Cookie': '__Host-yv_member=$cookie'},
      ).timeout(const Duration(seconds: 12));
      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        if (data is Map && data['user'] is Map) {
          final identity = MemberIdentity.fromJson(Map<String, dynamic>.from(data['user'] as Map));
          if (identity.id.isNotEmpty && identity.email.isNotEmpty) {
            user.value = identity;
            await _storage.write(key: 'yv_member_id', value: identity.id);
            await _storage.write(key: 'yv_member_email', value: identity.email);
          }
        }
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        await _clear();
      }
    } catch (_) {
      // Keep the last confirmed account visible while offline.
    }
  }

  static Future<void> logout() async {
    final cookie = _cookie;
    try {
      if (cookie != null) {
        await http.post(Uri.parse('$baseUrl/api/auth/logout'),
          headers: {'Origin': baseUrl, 'Cookie': '__Host-yv_member=$cookie'},
        ).timeout(const Duration(seconds: 10));
      }
    } catch (_) {}
    await _clear();
    status.value = 'Oturum kapatıldı.';
  }

  static Future<void> _clear() async {
    _cookie = null;
    user.value = null;
    for (final key in ['yv_member_cookie','yv_member_id','yv_member_email',
      'yv_auth_state','yv_auth_verifier']) {
      await _storage.delete(key: key);
    }
  }
}


class YukListing {
  const YukListing({required this.id, required this.title, required this.city,
    required this.district, required this.category, required this.description,
    this.photoUrl, this.distanceKm, this.phone = '', this.createdAt = 0});
  final String id, title, city, district, category, description;
  final String? photoUrl;
  final num? distanceKm;
  final String phone;
  final int createdAt;
  factory YukListing.fromJson(Map<String, dynamic> v) {
    String s(String key) => (v[key] ?? '').toString();
    return YukListing(
      id: s('id'), title: s('title'), city: s('city'), district: s('district'),
      category: s('category'), description: s('description'),
      photoUrl: v['photo_url']?.toString(),
      phone: s('contact_phone'), createdAt: int.tryParse(s('created_at')) ?? 0,
      distanceKm: v['distance_km'] is num ? v['distance_km'] as num : null,
    );
  }
}

class YukApi {
  YukApi({http.Client? client}) : client = client ?? http.Client();
  final http.Client client;
  Future<List<YukListing>>? _firstLoad;

  Future<List<YukListing>> initialListings() => _firstLoad ??= listings().catchError(
    (Object error, StackTrace stack) {
      _firstLoad = null;
      Error.throwWithStackTrace(error, stack);
    },
  );
  Future<List<YukListing>> listings({String category = 'all', String query = '', String city = ''}) async {
    final q = <String, String>{};
    if (category != 'all') q['category'] = category;
    if (city.trim().isNotEmpty) q['city'] = city.trim();
    if (query.trim().isNotEmpty) q['q'] = query.trim();
    final uri = Uri.parse(baseUrl + '/api/listings')
      .replace(queryParameters: q.isEmpty ? null : q);
    return _parse(await client.get(uri, headers: const {'Accept': 'application/json'})
        .timeout(const Duration(seconds: 15)));
  }
  Future<List<YukListing>> nearby(double lat, double lng, {int radiusKm = 100}) async {
    return _parse(await client.post(Uri.parse(baseUrl + '/api/ai/nearby'),
      headers: const {'Content-Type': 'application/json', 'Origin': baseUrl},
      body: jsonEncode({'latitude': lat, 'longitude': lng, 'radius_km': radiusKm}),
    ).timeout(const Duration(seconds: 15)));
  }
  Future<({YukListing listing, List<String> photos})> detail(String id) async {
    final response = await client.get(
      Uri.parse('$baseUrl/api/listings/${Uri.encodeComponent(id)}'),
      headers: const {'Accept': 'application/json'},
    ).timeout(const Duration(seconds: 15));
    if (response.statusCode == 404) {
      throw ListingUnavailable();
    }
    if (response.statusCode != 200) throw StateError('İlan yüklenemedi.');
    final body = jsonDecode(utf8.decode(response.bodyBytes));
    if (body is! Map || body['listing'] is! Map || body['photos'] is! List) {
      throw const FormatException('Geçersiz ilan yanıtı');
    }
    final listing = YukListing.fromJson(Map<String, dynamic>.from(body['listing'] as Map));
    if (listing.id != id || listing.title.isEmpty) {
      throw const FormatException('İlan bilgileri uyuşmuyor');
    }
    final photos = (body['photos'] as List).whereType<String>()
        .where((path) => path.startsWith('/api/listing-photo/') && !path.contains('..'))
        .toList(growable: false);
    return (listing: listing, photos: photos);
  }

  Future<List<YukListing>> savedListings(Iterable<String> ids) async {
    final pendingIds = ids.toList();
    final results = <YukListing>[];
    for (var offset = 0; offset < pendingIds.length; offset += 4) {
      final batch = pendingIds.skip(offset).take(4);
      final items = await Future.wait(batch.map((id) async {
        try {
          final result = await detail(id);
          return YukListing.fromJson({
            'id': result.listing.id, 'title': result.listing.title,
            'city': result.listing.city, 'district': result.listing.district,
            'category': result.listing.category,
            'description': result.listing.description,
            'photo_url': result.photos.isEmpty ? null : result.photos.first,
          });
        } on ListingUnavailable {
          return null;
        }
      }));
      results.addAll(items.whereType<YukListing>());
    }
    return results;
  }

  List<YukListing> _parse(http.Response response) {
    if (response.statusCode != 200) {
      throw Exception('Sunucu hatası: ' + response.statusCode.toString());
    }
    final body = jsonDecode(utf8.decode(response.bodyBytes));
    if (body is! Map || body['items'] is! List) {
      throw const FormatException('Beklenmeyen sunucu yanıtı');
    }
    return (body['items'] as List).whereType<Map>()
        .map((v) => YukListing.fromJson(Map<String, dynamic>.from(v)))
        .where((v) => v.title.isNotEmpty && v.id.isNotEmpty).toList(growable: false);
  }
}

final api = YukApi();
Future<void> openSite(BuildContext context, String path) async {
  try {
    final uri = Uri.parse(baseUrl + path);
    final external = path == '/hesabim/' || path == '/ilan-ver/';
    final opened = !external && await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
    final ok = opened || await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) throw Exception('Bağlantı açılamadı');
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Sayfa açılamadı. İnternet bağlantını kontrol et.')));
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try { await AppAppearance.load(); } catch (_) {}
  try { await MemberAuth.initialize(); } catch (_) {}
  runApp(const YukVincApp());
}

class YukVincApp extends StatelessWidget {
  const YukVincApp({super.key});
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<ThemeMode>(
    valueListenable: AppAppearance.mode,
    builder: (context, mode, child) => MaterialApp(
      title: 'YükVinç', debugShowCheckedModeBanner: false,
      theme: AppAppearance.theme(Brightness.light),
      darkTheme: AppAppearance.theme(Brightness.dark),
      themeMode: mode,
      home: const Shell(),
    ),
  );
}

class ListingUnavailable extends StateError {
  ListingUnavailable() : super('İlan artık yayında değil.');
}

class Shell extends StatefulWidget {
  const Shell({super.key});
  @override State<Shell> createState() => _ShellState();
}
class _ShellState extends State<Shell> {
  int tab = 0;
  bool checkingUpdate = false;
  bool get supportsUpdate => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  @override
  void initState() {
    super.initState();
    if (supportsUpdate) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) checkUpdate();
      });
    }
  }

  Future<void> checkUpdate({bool manual = false}) async {
    if (checkingUpdate) return;
    checkingUpdate = true;
    final client = http.Client();
    var openingDownload = false;
    try {
      final update = await AndroidUpdates.check(client);
      if (!mounted) return;
      if (update == null) {
        if (manual) updateMessage('YükVinç v$installedVersion güncel.');
        return;
      }
      final accepted = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: Text('YükVinç ${update.version} hazır'),
          content: SingleChildScrollView(child: Text(update.notes)),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialog, false),
              child: const Text('Daha sonra')),
            FilledButton(onPressed: () => Navigator.pop(dialog, true),
              child: const Text('Şimdi güncelle')),
          ],
        ),
      );
      if (accepted == true && mounted) {
        openingDownload = true;
        final launched = await launchUrl(update.download, mode: LaunchMode.externalApplication);
        if (!launched && mounted) updateMessage('APK indirme bağlantısı açılamadı.');
      }
    } catch (_) {
      if (mounted && (manual || openingDownload)) {
        updateMessage(openingDownload ? 'APK indirme bağlantısı açılamadı.'
          : 'Sürüm kontrolü yapılamadı. Tekrar dene.');
      }
    } finally {
      client.close();
      checkingUpdate = false;
    }
  }

  void updateMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
  final openedTabs = <int>{0};

  void openTab(int index) => setState(() {
    tab = index;
    openedTabs.add(index);
  });
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Row(children: [
        Icon(Icons.local_shipping_rounded, size: 29),
        SizedBox(width: 10),
        Text('YükVinç', style: TextStyle(fontWeight: FontWeight.w900)),
      ]),
      actions: [
        if (supportsUpdate) IconButton(
          icon: const Icon(Icons.system_update_rounded),
          tooltip: 'Güncellemeleri kontrol et',
          onPressed: () => checkUpdate(manual: true),
        ),
        IconButton(
        icon: const Icon(Icons.open_in_browser_rounded), tooltip: 'Web sitesi',
        onPressed: () => openSite(context, '/'),
      )],
    ),
    body: SafeArea(child: Center(child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 760),
      child: IndexedStack(index: tab, children: [
        Opportunities(onExplore: () => openTab(1), onNearby: () => openTab(2)),
        if (openedTabs.contains(1)) const ListingsScreen() else const SizedBox.shrink(),
        if (openedTabs.contains(2)) Nearby(onBrowse: () => openTab(1)) else const SizedBox.shrink(),
        if (openedTabs.contains(3)) const RoadHelp() else const SizedBox.shrink(),
        if (openedTabs.contains(4)) const Account() else const SizedBox.shrink(),
      ]),
    ))),
    bottomNavigationBar: NavigationBar(
      selectedIndex: tab,
      onDestinationSelected: openTab,
      destinations: const [
        NavigationDestination(icon: Icon(Icons.work_outline_rounded), label: 'Ana Sayfa'),
        NavigationDestination(icon: Icon(Icons.search_rounded), label: 'Keşfet'),
        NavigationDestination(icon: Icon(Icons.near_me_outlined), label: 'Yakınımda'),
        NavigationDestination(icon: Icon(Icons.car_repair_outlined), label: 'Yol yardım'),
        NavigationDestination(icon: Icon(Icons.person_outline_rounded), label: 'Hesabım'),
      ],
    ),
  );
}

class Opportunities extends StatefulWidget {
  const Opportunities({super.key, required this.onExplore, required this.onNearby});
  final VoidCallback onExplore, onNearby;
  @override State<Opportunities> createState() => _OpportunitiesState();
}
class _OpportunitiesState extends State<Opportunities> {
  late Future<List<YukListing>> future;
  @override void initState() { super.initState(); future = api.initialListings(); }
  Future<void> refresh() async {
    final next = api.listings(); setState(() => future = next);
    try { await next; } catch (_) {}
  }
  @override Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: refresh,
    child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(18), children: [
      Spotlight(
        icon: Icons.construction_rounded,
        title: 'İşine uygun\nekipmanı bul.',
        subtitle: 'Vinç, platform, yol yardım ve operatör ilanları.',
        action: 'İlanları keşfet', actionIcon: Icons.arrow_forward_rounded,
        onTap: widget.onExplore,
      ),
      const SizedBox(height: 18),
      TextField(
        textInputAction: TextInputAction.search,
        decoration: const InputDecoration(
          hintText: 'Şehir veya ekipman ara', prefixIcon: Icon(Icons.search_rounded),
        ),
        onSubmitted: (query) {
          if (query.trim().isEmpty) return;
          Navigator.of(context).push(MaterialPageRoute<void>(
            builder: (_) => Scaffold(
              appBar: AppBar(title: const Text('Keşfet')),
              body: ListingsScreen(initialQuery: query.trim()),
            ),
          ));
        },
      ),
      const SizedBox(height: 12),
      Wrap(spacing: 8, children: [
        ActionChip(avatar: const Icon(Icons.bookmark_outline, size: 18),
          label: const Text('Favorilerim'),
          onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
            builder: (_) => const FavoriteListings(),
          ))),
        ActionChip(avatar: const Icon(Icons.history, size: 18),
          label: const Text('Son baktıklarım'),
          onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
            builder: (_) => const FavoriteListings(recent: true),
          ))),
      ]),
      const SizedBox(height: 14),
      Row(children: [
        Expanded(child: ShortcutCard(
          icon: Icons.near_me_outlined, title: 'Yakınımda',
          subtitle: 'Konuma göre ara', onTap: widget.onNearby,
        )),
        const SizedBox(width: 10),
        Expanded(child: ShortcutCard(
          icon: Icons.add_circle_outline, title: 'İlan ver',
          subtitle: 'İlanını oluştur', onTap: () => openSite(context, '/ilan-ver/'),
        )),
      ]),
      const SizedBox(height: 24),
      const Text('Güncel ilanlar', style: TextStyle(fontSize: 21,
        fontWeight: FontWeight.w800)),
      const SizedBox(height: 5),
      const Text('Onaylı ilanlar gösterilir. Operatör ilanları iş arayan kişilere aittir.',
        style: TextStyle(fontSize: 12)),
      const SizedBox(height: 12),
      FutureBuilder<List<YukListing>>(future: future, builder: (context, snap) {
        if (!snap.hasData && !snap.hasError) return const Loading();
        if (snap.hasError) return Retry(onTap: refresh);
        final items = snap.data ?? [];
        if (items.isEmpty) return const Empty('Şu anda görüntülenecek ilan yok.');
        return Column(children: [
          for (final item in items.take(10)) ListingCard(item: item),
        ]);
      }),
    ]),
  );
}

class Spotlight extends StatelessWidget {
  const Spotlight({super.key, required this.icon, required this.title,
    required this.subtitle, required this.action, required this.actionIcon,
    required this.onTap});

  final IconData icon, actionIcon;
  final String title, subtitle, action;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(28),
    child: DecoratedBox(
      decoration: const BoxDecoration(gradient: LinearGradient(
        begin: Alignment.topLeft, end: Alignment.bottomRight,
        colors: [Color(0xFF10272C), Color(0xFF18434A)],
      )),
      child: Stack(children: [
        Positioned(top: -24, right: -23,
          child: ExcludeSemantics(child: Icon(icon, size: 156, color: const Color(0x224EF0CC)))),
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: const Color(0xFF94FFE4), size: 28),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(color: Colors.white,
              fontSize: 32, height: 1.08, fontWeight: FontWeight.w800, letterSpacing: -.8)),
            const SizedBox(height: 10),
            Text(subtitle, style: const TextStyle(color: Color(0xFFD1E6E4), height: 1.4)),
            const SizedBox(height: 20),
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: yellow, foregroundColor: navy,
                disabledBackgroundColor: const Color(0x334EF0CC),
                disabledForegroundColor: const Color(0xFFD1E6E4), minimumSize: const Size(0, 48)),
              onPressed: onTap, icon: Icon(actionIcon), label: Text(action),
            ),
          ]),
        ),
      ]),
    ),
  );
}

class ShortcutCard extends StatelessWidget {
  const ShortcutCard({super.key, required this.icon, required this.title,
    required this.subtitle, required this.onTap});
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  @override Widget build(BuildContext context) => Card(
    child: InkWell(borderRadius: BorderRadius.circular(18), onTap: onTap,
      child: Padding(padding: const EdgeInsets.all(15),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 27), const SizedBox(height: 12),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 3),
          Text(subtitle, style: const TextStyle(fontSize: 11)),
        ]))),
  );
}

class ListingsScreen extends StatefulWidget {
  const ListingsScreen({super.key, this.initialQuery = ''});
  final String initialQuery;
  @override State<ListingsScreen> createState() => _ListingsState();
}
class _ListingsState extends State<ListingsScreen> {
  final search = TextEditingController();
  Timer? timer;
  String category = 'all';
  late Future<List<YukListing>> future;
  static const filters = <String, String>{
    'all': 'Tümü', 'crane': 'Vinç', 'tow': 'Çekici',
    'basket': 'Sepetli', 'mobile_tire': 'Lastik', 'manlift': 'Manlift',
    'machine': 'Makine', 'lift': 'Asansör', 'operator': 'Operatör',
  };
  @override void initState() {
    super.initState();
    search.text = widget.initialQuery;
    future = search.text.isEmpty ? api.initialListings() : api.listings(query: search.text);
  }
  void load() => setState(() =>
    future = api.listings(query: search.text, category: category));
  Future<void> refresh() async { load(); try { await future; } catch (_) {} }
  @override void dispose() { timer?.cancel(); search.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Column(children: [
    Padding(padding: const EdgeInsets.fromLTRB(18, 12, 18, 3),
      child: TextField(
        controller: search, textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: 'Şehir, ilan veya ekipman ara',
          prefixIcon: const Icon(Icons.search),
          filled: true,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(15),
            borderSide: BorderSide.none)),
        onSubmitted: (_) { timer?.cancel(); load(); },
        onChanged: (_) { timer?.cancel();
          timer = Timer(const Duration(milliseconds: 450), load); },
      )),
    SizedBox(height: 53, child: ListView(scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 18),
      children: [for (final filter in filters.entries)
        Padding(padding: const EdgeInsets.only(right: 7),
          child: ChoiceChip(label: Text(filter.value),
            selected: category == filter.key,
            onSelected: (selected) {
              if (!selected || category == filter.key) return;
              timer?.cancel();
              category = filter.key;
              load();
            }))])),
    Expanded(child: FutureBuilder<List<YukListing>>(
      future: future, builder: (context, snap) {
        if (!snap.hasData && !snap.hasError) return const Loading();
        if (snap.hasError) return Retry(onTap: refresh);
        final items = snap.data ?? [];
        if (items.isEmpty) return const Empty('Bu aramaya uygun ilan yok.');
        return RefreshIndicator(onRefresh: refresh, child: ListView.builder(
          padding: const EdgeInsets.fromLTRB(18, 4, 18, 20),
          physics: const AlwaysScrollableScrollPhysics(),
          itemCount: items.length,
          itemBuilder: (context, i) => ListingCard(item: items[i]),
        ));
      },
    )),
  ]);
}

class Nearby extends StatefulWidget {
  const Nearby({super.key, required this.onBrowse});
  final VoidCallback onBrowse;
  @override State<Nearby> createState() => _NearbyState();
}
class _NearbyState extends State<Nearby> {
  bool loading = false;
  String? error;
  bool showAppSettings = false;
  bool showLocationSettings = false;
  List<YukListing>? items;
  int radius = 100;
  bool newest = false;
  bool manual = false;
  String category = 'all';
  final city = TextEditingController();
  final district = TextEditingController();

  @override
  void dispose() {
    city.dispose();
    district.dispose();
    super.dispose();
  }

  Future<void> find({bool useLocation = true}) async {
    if (loading) return;
    setState(() {
      loading = true;
      items = null;
      manual = !useLocation;
      error = null;
      showAppSettings = false;
      showLocationSettings = false;
    });
    try {
      if (!useLocation) {
        final province = city.text.trim();
        final borough = district.text.trim();
        if (province.isEmpty) throw StateError('İl adını yaz.');
        final results = await api.listings(city: province, query: borough, category: category);
        final matches = results.where((item) =>
          regionKey(item.city) == regionKey(province) &&
          (borough.isEmpty || regionKey(item.district) == regionKey(borough))).toList();
        if (mounted) setState(() => items = matches);
        return;
      }
      if (!await Geolocator.isLocationServiceEnabled()) {
        showLocationSettings = true;
        throw StateError('Telefonunda konum hizmeti kapalı.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        showAppSettings = true;
        throw StateError('YükVinç için konum iznini uygulama ayarlarından açabilirsin.');
      }
      if (permission != LocationPermission.whileInUse && permission != LocationPermission.always) {
        throw StateError('Konum izni verilmedi. Şehir bazlı arama yapabilirsin.');
      }
      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 10)));
      final result = await api.nearby(p.latitude, p.longitude, radiusKm: radius);
      if (mounted) setState(() => items = result);
    } catch (e) {
      if (mounted) setState(() => error =
        e is StateError ? e.message : 'Arama tamamlanamadı. Tekrar deneyebilir veya şehir seçebilirsin.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }
  @override Widget build(BuildContext context) {
    final visible = items?.where((item) => category == 'all' || item.category == category).toList();
    if (newest || manual) {
      visible?.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    }
    return ListView(
    padding: const EdgeInsets.all(18), children: [
      Spotlight(
        icon: Icons.near_me_rounded,
        title: 'Yakınımdaki ilanlar',
        subtitle: 'Konumunu bu aramada kullan. İlanların mesafesi yaklaşık gösterilir.',
        action: loading ? 'Aranıyor…' : 'Konumumla ara',
        actionIcon: Icons.my_location_rounded,
        onTap: loading ? null : () => find(),
      ),
      const SizedBox(height: 12),
      Wrap(spacing: 8, children: [
        for (final km in [5, 10, 25, 50, 100])
          ChoiceChip(label: Text('$km km'), selected: km == radius,
            onSelected: loading ? null : (selected) {
              if (!selected) return;
              setState(() { radius = km; if (!manual) items = null; });
            }),
      ]),
      DropdownButtonFormField<String>(
        initialValue: category,
        decoration: const InputDecoration(labelText: 'Kategori'),
        items: [for (final option in _ListingsState.filters.entries)
          DropdownMenuItem(value: option.key, child: Text(option.value))],
        onChanged: loading ? null : (value) => setState(() {
          category = value ?? 'all';
          if (manual) items = null;
        }),
      ),
      SwitchListTile(
        title: const Text('En yeni ilanlar önce'),
        value: newest || manual,
        onChanged: manual ? null : (value) => setState(() => newest = value),
        contentPadding: EdgeInsets.zero,
      ),
      ExpansionTile(title: const Text('İl ve ilçeyle ara'),
        tilePadding: EdgeInsets.zero,
        children: [
          TextField(controller: city, decoration: const InputDecoration(labelText: 'İl')),
          TextField(controller: district, decoration: const InputDecoration(labelText: 'İlçe (isteğe bağlı)')),
          const SizedBox(height: 12),
          FilledButton.icon(
            icon: const Icon(Icons.search),
            onPressed: loading ? null : () => find(useLocation: false),
            label: const Text('Bölgedeki ilanları bul'),
          ),
        ],
      ),
      if (loading) const Loading(),
      if (error != null) Padding(padding: const EdgeInsets.symmetric(vertical: 14),
        child: Text(error!, style: const TextStyle(color: Colors.red))),
      if (showAppSettings)
        OutlinedButton(onPressed: () => Geolocator.openAppSettings(),
          child: const Text('Uygulama ayarlarını aç')),
      if (showLocationSettings)
        OutlinedButton(onPressed: () => Geolocator.openLocationSettings(),
          child: const Text('Konum ayarlarını aç')),
      if (visible != null) ...[
        const SizedBox(height: 23),
        Text(manual ? 'Bölgedeki ilanlar (${visible.length})' : 'Yakındaki ilanlar (${visible.length})',
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        if (visible.isEmpty) Empty(manual
          ? 'Bu il ve ilçe için ilan bulunamadı.'
          : 'Bu aramada doğrulanmış konumlu ilan bulunamadı. Mesafeyi artırabilir veya il ve ilçeyle arayabilirsin.'),
        for (final item in visible) ListingCard(item: item),
      ],
      const SizedBox(height: 15),
      OutlinedButton.icon(
        onPressed: widget.onBrowse,
        icon: const Icon(Icons.location_city),
        label: const Text('Tüm Türkiye ilanları'),
      ),
    ]);
  }
}

String regionKey(String text) => text.trim()
    .replaceAll('İ', 'i').replaceAll('I', 'ı').toLowerCase();

class RoadHelp extends StatefulWidget {
  const RoadHelp({super.key});
  @override
  State<RoadHelp> createState() => _RoadHelpState();
}

class _RoadHelpState extends State<RoadHelp> {
  String category = 'tow';
  final city = TextEditingController();
  late Future<List<YukListing>> results;

  @override
  void initState() {
    super.initState();
    results = api.listings(category: category);
  }

  Future<void> refresh() async {
    final next = api.listings(category: category, city: city.text);
    setState(() => results = next);
    try { await next; } catch (_) {}
  }

  @override
  void dispose() {
    city.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(children: [
    Padding(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
      child: TextField(
        controller: city,
        textInputAction: TextInputAction.search,
        onSubmitted: (_) => refresh(),
        decoration: InputDecoration(
          labelText: 'Yol yardım için il ara',
          suffixIcon: IconButton(icon: const Icon(Icons.search),
            tooltip: 'Ara', onPressed: refresh),
        ),
      ),
    ),
    Wrap(spacing: 8, children: [
      for (final entry in const {'tow': 'Çekici', 'mobile_tire': 'Mobil lastik'}.entries)
        ChoiceChip(label: Text(entry.value), selected: category == entry.key,
          onSelected: (selected) {
            if (!selected) return;
            category = entry.key;
            refresh();
          }),
    ]),
    Expanded(child: FutureBuilder<List<YukListing>>(
      future: results,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) return const Loading();
        if (snapshot.hasError) return Retry(onTap: refresh);
        final items = snapshot.data ?? [];
        if (items.isEmpty) return const Empty('Bu bölgede yol yardım ilanı bulunamadı.');
        return RefreshIndicator(onRefresh: refresh, child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(18),
          itemCount: items.length,
          itemBuilder: (context, index) => ListingCard(item: items[index]),
        ));
      },
    )),
  ]);
}

class FavoriteListings extends StatefulWidget {
  const FavoriteListings({super.key, this.recent = false});
  final bool recent;
  @override State<FavoriteListings> createState() => _FavoriteListingsState();
}

class _FavoriteListingsState extends State<FavoriteListings> {
  late Future<List<YukListing>> future;

  @override
  void initState() {
    super.initState();
    future = _load();
  }

  Future<List<YukListing>> _load() async {
    final ids = widget.recent ? await RecentListingsStore.load() : await FavoritesStore.load();
    return api.savedListings(ids);
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() => future = next);
    try { await next; } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.recent ? 'Son görüntülenenler' : 'Favorilerim'),
      actions: [
        if (widget.recent) IconButton(
          tooltip: 'Geçmişi temizle', icon: const Icon(Icons.delete_outline),
          onPressed: () async {
            try {
              await RecentListingsStore.clear();
              if (mounted) await _refresh();
            } catch (_) {
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Geçmiş temizlenemedi.')),
              );
            }
          },
        ),
      ],
    ),
    body: FutureBuilder<List<YukListing>>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) return const Loading();
        if (snapshot.hasError) return Retry(onTap: _refresh);
        final items = snapshot.data ?? const <YukListing>[];
        if (items.isEmpty) return const Empty('Gösterilecek ilan yok. İlanları keşfederek başlayabilirsin.');
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(18),
            itemCount: items.length,
            itemBuilder: (context, index) => ListingCard(
              item: items[index], onFavoriteChanged: _refresh,
            ),
          ),
        );
      },
    ),
  );
}

class Account extends StatelessWidget {
  const Account({super.key});
  @override Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(18), children: [
      const Text('Hesabım', style: TextStyle(
        fontSize: 25, fontWeight: FontWeight.w900)),
      const SizedBox(height: 7),
      const Text('YükVinç hesabınla uygulamadan devam et.'),
      const SizedBox(height: 17),
      ValueListenableBuilder<MemberIdentity?>(
        valueListenable: MemberAuth.user,
        builder: (context, member, child) => Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: member == null
              ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Icon(Icons.account_circle_rounded, size: 48,
                    color: Theme.of(context).colorScheme.primary),
                  const SizedBox(height: 10),
                  Text('İşlerini tek hesaptan yönet',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  const Text('Google ile giriş yap; doğrulama tamamlanınca güvenli oturumun bu uygulamada açılır.',
                    textAlign: TextAlign.center),
                  const SizedBox(height: 14),
                  ValueListenableBuilder<bool>(
                    valueListenable: MemberAuth.busy,
                    builder: (context, busy, child) => FilledButton.icon(
                      onPressed: busy ? null : () { unawaited(MemberAuth.beginGoogleSignIn()); },
                      icon: busy
                        ? const SizedBox.square(dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.login_rounded),
                      label: Text(busy ? 'Giriş hazırlanıyor…' : 'Google ile devam et'),
                    ),
                  ),
                  const SizedBox(height: 4),
                  OutlinedButton(
                    onPressed: () { unawaited(MemberAuth.beginGoogleSignIn()); },
                    child: const Text('E-posta ile giriş yap'),
                  ),
                  ValueListenableBuilder<String>(
                    valueListenable: MemberAuth.status,
                    builder: (context, status, child) => status.isEmpty
                      ? const SizedBox.shrink()
                      : Padding(padding: const EdgeInsets.only(top: 10),
                          child: Text(status, textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodySmall)),
                  ),
                ])
              : Column(children: [
                  ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                      child: const Icon(Icons.person_rounded),
                    ),
                    title: Text(member.email,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: const Text('YükVinç hesabınla giriş yaptın.'),
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton.icon(
                      onPressed: () { unawaited(MemberAuth.logout()); },
                      icon: const Icon(Icons.logout_rounded),
                      label: const Text('Çıkış yap'),
                    ),
                  ),
                  ValueListenableBuilder<String>(
                    valueListenable: MemberAuth.status,
                    builder: (context, status, child) => status.isEmpty
                      ? const SizedBox.shrink()
                      : Padding(padding: const EdgeInsets.only(bottom: 10),
                          child: Text(status, style: Theme.of(context).textTheme.bodySmall)),
                  ),
                ]),
          ),
        ),
      ),
      Card(child: Padding(
        padding: const EdgeInsets.all(16),
        child: ValueListenableBuilder<ThemeMode>(
          valueListenable: AppAppearance.mode,
          builder: (context, mode, child) => DropdownButtonFormField<ThemeMode>(
            initialValue: mode, decoration: const InputDecoration(labelText: 'Görünüm'),
            items: const [
              DropdownMenuItem(value: ThemeMode.system, child: Text('Telefon ayarı')),
              DropdownMenuItem(value: ThemeMode.light, child: Text('Aydınlık')),
              DropdownMenuItem(value: ThemeMode.dark, child: Text('Karanlık')),
            ],
            onChanged: (value) async {
              if (value == null) return;
              try { await AppAppearance.save(value); } catch (_) {
                if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Görünüm kaydedilemedi.')),
                );
              }
            },
          ),
        ),
      )),
      AccountLink(icon: Icons.history_rounded, title: 'Son görüntülenenler',
        subtitle: 'Bu cihazda baktığın son 12 ilan',
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
          builder: (_) => const FavoriteListings(recent: true),
        ))),
      AccountLink(icon: Icons.bookmark_outline_rounded, title: 'Favorilerim',
        subtitle: 'Bu cihazda kaydettiğin ilanlar',
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
          builder: (_) => const FavoriteListings(),
        ))),
      AccountLink(icon: Icons.person_outline_rounded, title: 'Hesabımı aç',
        subtitle: 'Profilini ve ilanlarını yönet',
        onTap: () => openSite(context, '/hesabim/')),
      AccountLink(icon: Icons.add_circle_outline, title: 'İlan ver',
        subtitle: 'Hizmetini veya operatör ilanını yayınla',
        onTap: () => openSite(context, '/ilan-ver/')),
      AccountLink(icon: Icons.work_outline_rounded, title: 'İş talepleri',
        subtitle: 'Yayındaki talepleri incele',
        onTap: () => openSite(context, '/is-talepleri/')),
    ]);
}

class AccountLink extends StatelessWidget {
  const AccountLink({super.key, required this.icon, required this.title,
    required this.subtitle, required this.onTap});
  final IconData icon; final String title, subtitle;
  final VoidCallback onTap;
  @override Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: CircleAvatar(backgroundColor: Theme.of(context).colorScheme.primaryContainer, child: Icon(icon)),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
      subtitle: Text(subtitle), trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    ));
}

class ListingCard extends StatelessWidget {
  const ListingCard({super.key, required this.item, this.onFavoriteChanged});
  final YukListing item;
  final VoidCallback? onFavoriteChanged;

  String get dialNumber {
    final digits = item.phone.replaceAll(RegExp(r'[^0-9]'), '');
    return switch (digits.length) {
      10 => '90$digits',
      11 when digits.startsWith('0') => '90${digits.substring(1)}',
      12 when digits.startsWith('90') => digits,
      _ => '',
    };
  }

  Future<void> contact(BuildContext context, Uri uri) async {
    try {
      if (await launchUrl(uri, mode: LaunchMode.externalApplication)) return;
    } catch (_) {}
    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('İletişim bağlantısı açılamadı.')),
    );
  }

  String get categoryLabel => switch (item.category) {
    'crane' => 'VİNÇ', 'tow' => 'ÇEKİCİ', 'basket' => 'SEPETLİ PLATFORM',
    'mobile_tire' => 'MOBİL LASTİK', 'operator' => 'İŞ ARAYAN OPERATÖR',
    'manlift' => 'MANLİFT', 'machine' => 'İŞ MAKİNESİ', 'lift' => 'NAKLİYAT ASANSÖRÜ', _ => 'İLAN',
  };
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final photo = item.photoUrl;
    final uri = photo == null ? null : Uri.tryParse(photo);
    final imageUrl = uri != null && photo!.startsWith('/api/listing-photo/')
        ? baseUrl + photo
        : uri != null && uri.scheme == 'https' && uri.host == 'yukvinc.com.tr'
            ? uri.toString() : null;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
          builder: (_) => ListingDetail(itemId: item.id),
        )),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AspectRatio(aspectRatio: 16 / 9, child: imageUrl == null
            ? const ListingPlaceholder()
            : Image.network(imageUrl, fit: BoxFit.cover, cacheWidth: 900,
                semanticLabel: item.title,
                errorBuilder: (_, error, stack) => const ListingPlaceholder())),
          Padding(padding: const EdgeInsets.all(18), child: Column(
            crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(categoryLabel,
                  style: TextStyle(color: colors.primary,
                    fontWeight: FontWeight.w800, fontSize: 11))),
                FavoriteButton(key: ValueKey(item.id),
                  itemId: item.id, onChanged: onFavoriteChanged),
              ]),
              Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              Row(children: [
                Icon(Icons.location_on_outlined, size: 17, color: colors.onSurfaceVariant),
                const SizedBox(width: 5),
                Expanded(child: Text(
                  [item.city, item.district].where((value) => value.isNotEmpty).join(' / '),
                  style: TextStyle(color: colors.onSurfaceVariant))),
                if (item.distanceKm != null)
                  Text('${item.distanceKm} km', style: TextStyle(color: colors.primary)),
              ]),
            ],
          )),
        ]),
      ),
    );
  }
}


class ListingDetail extends StatefulWidget {
  const ListingDetail({super.key, required this.itemId, this.client});
  final String itemId;
  final YukApi? client;

  @override
  State<ListingDetail> createState() => _ListingDetailState();
}

class _ListingDetailState extends State<ListingDetail> {
  late Future<({YukListing listing, List<String> photos})> future;
  int photoIndex = 0;

  @override
  void initState() {
    super.initState();
    future = (widget.client ?? api).detail(widget.itemId).then((value) {
      unawaited(RecentListingsStore.record(widget.itemId).catchError((Object error) {}));
      return value;
    });
  }

  Future<void> refresh() async {
    final next = (widget.client ?? api).detail(widget.itemId);
    setState(() { future = next; photoIndex = 0; });
    try { await next; } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('İlan detayı'),
      actions: [
        IconButton(tooltip: 'Bağlantıyı kopyala', icon: const Icon(Icons.link),
          onPressed: () async {
            try {
              await Clipboard.setData(ClipboardData(
                text: '$baseUrl/ilan/${Uri.encodeComponent(widget.itemId)}/'));
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('İlan bağlantısı kopyalandı.')),
              );
            } catch (_) {
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Bağlantı kopyalanamadı.')),
              );
            }
          },
        ),
        FavoriteButton(itemId: widget.itemId),
      ],
    ),
    body: FutureBuilder<({YukListing listing, List<String> photos})>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) return const Loading();
        if (snapshot.hasError) {
          return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(snapshot.error is StateError
                ? (snapshot.error as StateError).message.toString()
                : 'İlan yüklenemedi. Bağlantını kontrol et.'),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: refresh, child: const Text('Tekrar dene')),
          ]));
        }
        final detail = snapshot.data!;
        final item = detail.listing;
        final card = ListingCard(item: item);
        return RefreshIndicator(
          onRefresh: refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(18),
            children: [
              if (detail.photos.isNotEmpty) ...[
                SizedBox(height: 280, child: ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: PageView.builder(
                    key: ValueKey(future),
                    itemCount: detail.photos.length,
                    onPageChanged: (index) => setState(() => photoIndex = index),
                    itemBuilder: (context, index) => InteractiveViewer(
                      minScale: 1, maxScale: 3,
                      child: Image.network(
                        baseUrl + detail.photos[index],
                        fit: BoxFit.contain, cacheWidth: 1200,
                        semanticLabel: '${item.title}, fotoğraf ${index + 1}',
                        errorBuilder: (_, error, stack) => const ListingPlaceholder(),
                      ),
                    ),
                  ),
                )),
                const SizedBox(height: 8),
                Text('${photoIndex + 1} / ${detail.photos.length}',
                  textAlign: TextAlign.center),
                const SizedBox(height: 18),
              ],
              Text(card.categoryLabel, style: const TextStyle(color: green,
                fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(item.title, style: const TextStyle(fontSize: 25,
                fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text([item.city, item.district].where((v) => v.isNotEmpty).join(' / ')),
              const SizedBox(height: 24),
              OutlinedButton.icon(
                icon: const Icon(Icons.share_outlined),
                label: const Text('WhatsApp’ta paylaş'),
                onPressed: () => card.contact(context, Uri.https('wa.me', '/', {
                  'text': '${item.title}\n$baseUrl/ilan/${Uri.encodeComponent(item.id)}/',
                })),
              ),
              const SizedBox(height: 16),
              SelectableText(item.description, style: const TextStyle(height: 1.6)),
              const SizedBox(height: 24),
              if (card.dialNumber.isNotEmpty) Wrap(spacing: 12, children: [
                FilledButton.icon(
                  onPressed: () => card.contact(context,
                    Uri(scheme: 'tel', path: '+${card.dialNumber}')),
                  icon: const Icon(Icons.call_outlined), label: const Text('Ara'),
                ),
                OutlinedButton.icon(
                  onPressed: () => card.contact(context,
                    Uri.https('wa.me', '/${card.dialNumber}')),
                  icon: const Icon(Icons.chat_outlined), label: const Text('WhatsApp'),
                ),
              ]),
            ],
          ),
        );
      },
    ),
  );
}

class FavoriteButton extends StatefulWidget {
  const FavoriteButton({super.key, required this.itemId, this.onChanged});
  final String itemId;
  final VoidCallback? onChanged;

  @override
  State<FavoriteButton> createState() => _FavoriteButtonState();
}

class _FavoriteButtonState extends State<FavoriteButton> {
  bool favorite = false;
  bool ready = false;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    FavoritesStore.changes.addListener(reload);
    reload();
  }

  void reload() {
    final id = widget.itemId;
    FavoritesStore.contains(id).then((value) {
      if (mounted && widget.itemId == id) {
        setState(() { favorite = value; ready = true; });
      }
    }).catchError((Object error) {
      if (mounted) setState(() => ready = true);
    });
  }

  @override
  void didUpdateWidget(covariant FavoriteButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.itemId != widget.itemId) {
      ready = false;
      reload();
    }
  }

  @override
  void dispose() {
    FavoritesStore.changes.removeListener(reload);
    super.dispose();
  }

  Future<void> toggle() async {
    if (saving) return;
    setState(() => saving = true);
    try {
      final ids = await FavoritesStore.toggle(widget.itemId);
      if (mounted) setState(() { favorite = ids.contains(widget.itemId); ready = true; });
      widget.onChanged?.call();
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Favori kaydedilemedi. Tekrar dene.')),
      );
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: favorite ? 'Favorilerden kaldır' : 'Favorilere ekle',
    onPressed: ready && !saving ? toggle : null,
    icon: saving ? const SizedBox(
      width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2),
    ) : Icon(favorite ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
        color: favorite ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.onSurfaceVariant),
  );
}

class ListingPlaceholder extends StatelessWidget {
  const ListingPlaceholder({super.key});
  @override Widget build(BuildContext context) => Container(
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: const Icon(Icons.local_shipping_outlined, size: 32));
}
class Loading extends StatelessWidget {
  const Loading({super.key});
  @override Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()));
}
class Empty extends StatelessWidget {
  const Empty(this.label, {super.key});
  final String label;
  @override Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(30),
    child: Center(child: Text(label, textAlign: TextAlign.center,
      style: Theme.of(context).textTheme.bodyMedium)));
}
class Retry extends StatelessWidget {
  const Retry({super.key, required this.onTap});
  final Future<void> Function() onTap;
  @override Widget build(BuildContext context) => Center(child: Column(
    mainAxisSize: MainAxisSize.min, children: [
    const Text('İlanlar yüklenemedi.'),
    const SizedBox(height: 12),
    OutlinedButton.icon(onPressed: onTap,
      icon: const Icon(Icons.refresh), label: const Text('Tekrar dene')),
  ]));
}
