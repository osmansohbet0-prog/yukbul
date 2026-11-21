import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data' show BytesBuilder;
import 'package:html/parser.dart' as html;
import 'package:crypto/crypto.dart' as crypto;
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'app_update.dart';
import 'verified_android_installer.dart';
import 'favorites.dart';
import 'appearance.dart';
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

part 'service_search.dart';
part 'service_screen.dart';
part 'service_contact.dart';
part 'roadside_position.dart';

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
  static final _google = GoogleSignIn.instance;
  static String? _cookie;
  static bool _initialized = false;
  static bool _googleInitialized = false;

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
    } catch (_) {}
  }

  static Future<void> beginGoogleSignIn() async {
    if (busy.value) return;
    busy.value = true;
    status.value = 'Google ile güvenli giriş başlatılıyor…';
    try {
      final configResponse = await http.get(Uri.parse('$baseUrl/api/mobile/config'),
        headers: const {'Accept': 'application/json'}).timeout(const Duration(seconds: 12));
      if (configResponse.statusCode != 200) throw StateError('Google girişi şu anda kullanılamıyor.');
      final config = jsonDecode(utf8.decode(configResponse.bodyBytes));
      final clientId = config is Map ? (config['google_client_id'] ?? '').toString() : '';
      if (clientId.isEmpty) throw StateError('Google girişi henüz yapılandırılmamış.');
      if (!_googleInitialized) {
        await _google.initialize(serverClientId: clientId);
        _googleInitialized = true;
      }
      if (!_google.supportsAuthenticate()) throw StateError('Bu cihaz Google girişini desteklemiyor.');
      status.value = 'Google hesabını seç…';
      final account = await _google.authenticate();
      final credential = account.authentication.idToken;
      if (credential == null || credential.isEmpty) {
        throw StateError('Google doğrulama anahtarı alınamadı. Tekrar dene.');
      }
      status.value = 'Google oturumu doğrulanıyor…';
      final response = await http.post(Uri.parse('$baseUrl/api/auth/google'),
        headers: const {'Content-Type': 'application/json', 'Origin': baseUrl},
        body: jsonEncode({'credential': credential, 'platform': 'android'}),
      ).timeout(const Duration(seconds: 20));
      Map<String, dynamic> body = {};
      try {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded is Map) body = Map<String, dynamic>.from(decoded);
      } catch (_) {}
      if (response.statusCode != 200 || body['user'] is! Map) {
        throw StateError((body['error'] ?? 'Google girişi tamamlanamadı.').toString());
      }
      final pair = (response.headers['set-cookie'] ?? '').split(';').first;
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
      _cookie = cookie;
      user.value = identity;
      status.value = 'Google hesabınla giriş yaptın.';
    } catch (error) {
      status.value = error is StateError ? error.message : 'Google girişi tamamlanamadı. Tekrar dene.';
    } finally {
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
    } catch (_) {}
  }

  static Future<void> cancelSignIn() async {
    try { await _google.signOut(); } catch (_) {}
    busy.value = false;
    status.value = 'Google girişi iptal edildi.';
  }

  static Future<void> logout() async {
    final cookie = _cookie;
    try {
      if (cookie != null) {
        await http.post(Uri.parse('$baseUrl/api/auth/logout'),
          headers: {'Origin': baseUrl, 'Cookie': '__Host-yv_member=$cookie'},
        ).timeout(const Duration(seconds: 10));
      }
      await _google.signOut();
    } catch (_) {}
    await _clear();
    status.value = 'Oturum kapatıldı.';
  }

  static Future<void> _clear() async {
    _cookie = null;
    user.value = null;
    for (final key in ['yv_member_cookie','yv_member_id','yv_member_email']) {
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
  Future<({List<YukListing> items,String? nextCursor,bool offline})> listingPage({
    String category='all',String query='',String city='',String? cursor,int limit=20,
  }) async {
    final q=<String,String>{'limit':limit.toString(),'sort':'newest'};
    if(category!='all')q['category']=category;
    if(city.trim().isNotEmpty)q['city']=city.trim();
    if(query.trim().isNotEmpty)q['q']=query.trim();
    if(cursor!=null&&cursor.isNotEmpty)q['cursor']=cursor;
    final uri=Uri.parse(baseUrl+'/api/listings').replace(queryParameters:q);
    final cacheKey='yv_feed_page_'+crypto.sha256.convert(utf8.encode(uri.toString())).toString();
    ({List<YukListing> items,String? nextCursor,bool offline}) parse(String raw,bool offline){
      final body=jsonDecode(raw);
      if(body is! Map||body['items'] is! List)throw const FormatException('Beklenmeyen ilan yanıtı');
      final items=(body['items'] as List).whereType<Map>()
        .map((v)=>YukListing.fromJson(Map<String,dynamic>.from(v)))
        .where((v)=>v.title.isNotEmpty&&v.id.isNotEmpty).toList(growable:false);
      final next=body['next_cursor'];
      return(items:items,nextCursor:next is String&&next.isNotEmpty?next:null,offline:offline);
    }
    try{
      final response=await client.get(uri,headers:const {'Accept':'application/json'})
        .timeout(const Duration(seconds:15));
      if(response.statusCode!=200)throw Exception('Sunucu hatası: '+response.statusCode.toString());
      final raw=utf8.decode(response.bodyBytes);
      final page=parse(raw,false);
      unawaited(SharedPreferences.getInstance().then((prefs)=>prefs.setString(cacheKey,raw)).catchError((_)=>false));
      return page;
    }catch(error){
      try{
        final cached=await SharedPreferences.getInstance().then((prefs)=>prefs.getString(cacheKey));
        if(cached!=null)return parse(cached,true);
      }catch(_){}
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> mobileFeed(String type) async {
    if (type != 'jobs' && type != 'tenders') throw ArgumentError.value(type);
    final response = await client.get(Uri.parse('$baseUrl/api/mobile/$type'),
      headers: const {'Accept': 'application/json'}).timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) throw StateError('Fırsatlar yüklenemedi.');
    final body = jsonDecode(utf8.decode(response.bodyBytes));
    if (body is! Map || body['items'] is! List) throw const FormatException('Fırsat yanıtı geçersiz.');
    return (body['items'] as List).whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item)).toList(growable: false);
  }

  Future<List<YukListing>> nearby(double lat, double lng,
      {int radiusKm = 100, String category = 'all'}) async {
    final body = <String, dynamic>{
      'latitude': lat,
      'longitude': lng,
      'radius_km': radiusKm,
    };
    if (category != 'all') body['category'] = category;
    Future<http.Response> request() => client.post(Uri.parse(baseUrl + '/api/ai/nearby'),
      headers: const {'Content-Type': 'application/json', 'Origin': baseUrl},
      body: jsonEncode(body),
    ).timeout(const Duration(seconds: 8));
    var response = await request();
    if (response.statusCode == 400 && body.containsKey('category')) {
      // The earlier Worker accepts only latitude, longitude and radius.
      body.remove('category');
      response = await request();
    }
    return _parse(response).where((item) => category == 'all' || item.category == category).toList();
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

  Map<String, String> memberHeaders({bool jsonBody = false}) {
    final cookie = MemberAuth._cookie;
    if (cookie == null || cookie.isEmpty) throw StateError('Önce hesabına giriş yap.');
    return {'Accept':'application/json','Origin':baseUrl,'Cookie':'__Host-yv_member=' + cookie,
      if (jsonBody) 'Content-Type':'application/json'};
  }

  Map<String, dynamic> memberBody(http.Response response) {
    Map<String, dynamic> body = {};
    try { final d = jsonDecode(utf8.decode(response.bodyBytes)); if (d is Map) body = Map<String,dynamic>.from(d); } catch (_) {}
    if (response.statusCode < 200 || response.statusCode >= 300)
      throw StateError((body['error'] ?? body['message'] ?? 'İşlem tamamlanamadı.').toString());
    return body;
  }

  Future<List<Map<String,dynamic>>> myListings() async {
    final response = await client.get(Uri.parse(baseUrl + '/api/listings/mine'),headers:memberHeaders()).timeout(const Duration(seconds:15));
    final items = memberBody(response)['items'];
    if (items is! List) throw const FormatException('İlan yanıtı geçersiz.');
    return items.whereType<Map>().map((e)=>Map<String,dynamic>.from(e)).toList(growable:false);
  }
  Future<Map<String,dynamic>> createListing(Map<String,dynamic> listing,List<Map<String,dynamic>> photos) async {
    final response=await client.post(Uri.parse(baseUrl+'/api/listings'),headers:memberHeaders(jsonBody:true),
      body:jsonEncode({'listing':listing,'photos':photos,'privacy_ok':true,'hp':''})).timeout(const Duration(seconds:30));
    return memberBody(response);
  }
  Future<Map<String,dynamic>> updateListing(String id,Map<String,dynamic> listing,List<Map<String,dynamic>>? photos) async {
    final payload=<String,dynamic>{'listing':listing,'privacy_ok':true}; if(photos!=null) payload['photos']=photos;
    final response=await client.patch(Uri.parse(baseUrl+'/api/listings/'+Uri.encodeComponent(id)),headers:memberHeaders(jsonBody:true),body:jsonEncode(payload)).timeout(const Duration(seconds:30));
    return memberBody(response);
  }
  Future<void> appealListing(String id, String message) async {
    final response=await client.patch(Uri.parse(baseUrl+'/api/listings/'+Uri.encodeComponent(id)),
      headers:memberHeaders(jsonBody:true),body:jsonEncode({'action':'appeal','message':message}))
      .timeout(const Duration(seconds:15));
    memberBody(response);
  }

  Future<void> deleteListing(String id) async {
    final response=await client.delete(Uri.parse(baseUrl+'/api/listings/'+Uri.encodeComponent(id)),headers:memberHeaders()).timeout(const Duration(seconds:15));
    memberBody(response);
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
  if (!context.mounted) return;
  switch (path) {
    case '/hesabim':
    case '/hesabim/':
      await Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => Scaffold(appBar: AppBar(), body: const Account()),
      ));
      return;
    case '/ilan-ver/':
      _openMemberScreen(context, const ListingEditorScreen());
      return;
    case '/is-talepleri/':
      await Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => const OpportunityHub()));
      return;
    default:
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bu bölüm uygulama içi ekrana taşınıyor.')));
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  LicenseRegistry.addLicense(() async* {
    yield LicenseEntryWithLineBreaks(const ['YükVinç • İl ve ilçe verileri'],
        await rootBundle.loadString('assets/location-data-license.txt'));
  });
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
    var installingUpdate = false;
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
          content: SingleChildScrollView(child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(update.notes),
              const SizedBox(height: 12),
              const Text('Uygulama içinde indirilecek, SHA-256 ile doğrulanacak '
                  've Android kurulum ekranı açılacak. Uygulamayı silmene gerek yok.'),
            ],
          )),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialog, false),
              child: const Text('Daha sonra')),
            FilledButton(onPressed: () => Navigator.pop(dialog, true),
              child: const Text('İndir ve güncelle')),
          ],
        ),
      );
      if (accepted != true || !mounted) return;
      installingUpdate = true;
      final progress = ValueNotifier<double?>(0.0);
      final messenger = ScaffoldMessenger.of(context);
      messenger.showSnackBar(SnackBar(
        duration: const Duration(minutes: 10),
        content: ValueListenableBuilder<double?>(
          valueListenable: progress,
          builder: (context, ratio, _) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(ratio == null
                  ? 'YükVinç ${update.version} indiriliyor…'
                  : 'YükVinç ${update.version} indiriliyor: %${(ratio * 100).round()}'),
              const SizedBox(height: 8),
              LinearProgressIndicator(value: ratio),
            ],
          ),
        ),
      ));
      try {
        final apk = await VerifiedAndroidInstaller.downloadVerified(
          client, update,
          onProgress: (ratio) {
            if (mounted) progress.value = ratio;
          },
        );
        if (mounted) messenger.hideCurrentSnackBar();
        await VerifiedAndroidInstaller.requestInstall(apk);
        if (mounted) {
          updateMessage('Güncelleme doğrulandı. Android kurulum '
              'ekranından yüklemeyi onayla; uygulamanı silme.');
        }
      } finally {
        if (mounted) messenger.hideCurrentSnackBar();
        progress.dispose();
      }
    } catch (error) {
      if (mounted && (manual || installingUpdate)) {
        final message = error is FormatException
            ? error.message
            : installingUpdate
                ? 'Güncelleme tamamlanamadı. Bağlantını ve '
                    'Android yükleme iznini kontrol edip tekrar dene.'
                : 'Sürüm kontrolü yapılamadı. Biraz sonra tekrar dene.';
        updateMessage(message);
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
      ],
    ),
    body: SafeArea(child: Center(child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 760),
      child: IndexedStack(index: tab, children: [
        Opportunities(onExplore: () => openTab(1), onNearby: () => openTab(2), onRoadHelp: () => openTab(3)),
        if (openedTabs.contains(1)) const ListingsScreen() else const SizedBox.shrink(),
        if (openedTabs.contains(2)) Nearby(onBrowse: () => openTab(1)) else const SizedBox.shrink(),
        if (openedTabs.contains(3)) const Nearby(roadside: true) else const SizedBox.shrink(),
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
  const Opportunities({super.key, required this.onExplore, required this.onNearby, required this.onRoadHelp});
  final VoidCallback onExplore, onNearby, onRoadHelp;
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
        ActionChip(avatar: const Icon(Icons.car_repair_outlined, size: 18),
          label: const Text('Yol yardım bul'), onPressed: widget.onRoadHelp),
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
  final search=TextEditingController();
  final scroll=ScrollController();
  final appended=<YukListing>[];
  Timer? timer;
  String category='all';
  String? cursor;
  bool hasMore=true,loadingMore=false,offline=false;
  int generation=0;
  late Future<List<YukListing>> future;
  static const filters=<String,String>{
    'all':'Tümü','crane':'Vinç','tow':'Çekici','basket':'Sepetli',
    'mobile_tire':'Lastik','manlift':'Manlift','machine':'Makine',
    'lift':'Asansör','operator':'Operatör',
  };
  @override void initState(){
    super.initState();
    search.text=widget.initialQuery;
    scroll.addListener(checkForMore);
    future=firstPage(generation);
  }
  Future<List<YukListing>> firstPage(int requestGeneration)async{
    final requestedQuery=search.text,requestedCategory=category;
    final page=await api.listingPage(query:requestedQuery,category:requestedCategory);
    if(mounted&&generation==requestGeneration)setState((){cursor=page.nextCursor;hasMore=cursor!=null;offline=page.offline;});
    return page.items;
  }
  void load(){
    timer?.cancel();
    generation++;
    setState((){
      appended.clear();cursor=null;hasMore=true;loadingMore=false;offline=false;
      future=firstPage(generation);
    });
    if(scroll.hasClients)scroll.jumpTo(0);
  }
  Future<void> refresh()async{
    load();
    try{await future;}catch(_){}
  }
  void checkForMore(){
    if(scroll.hasClients&&scroll.position.extentAfter<500)unawaited(loadMore());
  }
  Future<void> loadMore()async{
    if(loadingMore||!hasMore||cursor==null)return;
    final requestGeneration=generation,requestedCursor=cursor;
    final requestedQuery=search.text,requestedCategory=category;
    setState(()=>loadingMore=true);
    try{
      final page=await api.listingPage(query:requestedQuery,category:requestedCategory,cursor:requestedCursor);
      if(!mounted||generation!=requestGeneration)return;
      setState((){
        appended.addAll(page.items);
        cursor=page.nextCursor;
        hasMore=cursor!=null;offline=page.offline;
      });
    }catch(_){
      if(mounted&&generation==requestGeneration)ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content:const Text('Diğer ilanlar yüklenemedi.'),action:SnackBarAction(label:'Tekrar dene',onPressed:()=>unawaited(loadMore()))));
    }finally{if(mounted&&generation==requestGeneration)setState(()=>loadingMore=false);}
  }
  @override void dispose(){
    timer?.cancel();search.dispose();scroll.dispose();super.dispose();
  }
  @override Widget build(BuildContext context)=>Column(children:[
    Padding(padding:const EdgeInsets.fromLTRB(18,12,18,3),child:TextField(
      controller:search,textInputAction:TextInputAction.search,
      decoration:InputDecoration(hintText:'Şehir, ilan veya ekipman ara',
        prefixIcon:const Icon(Icons.search),filled:true,
        border:OutlineInputBorder(borderRadius:BorderRadius.circular(15),borderSide:BorderSide.none)),
      onSubmitted:(_){timer?.cancel();load();},
      onChanged:(_){timer?.cancel();timer=Timer(const Duration(milliseconds:450),load);},
    )),
    SizedBox(height:53,child:ListView(scrollDirection:Axis.horizontal,padding:const EdgeInsets.symmetric(horizontal:18),
      children:[for(final filter in filters.entries)Padding(padding:const EdgeInsets.only(right:7),
        child:ChoiceChip(label:Text(filter.value),selected:category==filter.key,onSelected:(selected){
          if(!selected||category==filter.key)return;
          category=filter.key;load();
        }))])),
    if(offline)const Padding(padding:EdgeInsets.symmetric(horizontal:18,vertical:4),
      child:Align(alignment:Alignment.centerLeft,child:Text('Çevrimdışısın · kaydedilmiş ilanlar gösteriliyor.'))),
    Expanded(child:FutureBuilder<List<YukListing>>(future:future,builder:(context,snap){
      if(!snap.hasData&&!snap.hasError)return const Loading();
      if(snap.hasError)return Retry(onTap:refresh);
      final items=[...(snap.data??const <YukListing>[]),...appended];
      if(items.isEmpty)return const Empty('Bu aramaya uygun ilan yok.');
      return RefreshIndicator(onRefresh:refresh,child:ListView.builder(
        controller:scroll,padding:const EdgeInsets.fromLTRB(18,4,18,20),
        physics:const AlwaysScrollableScrollPhysics(),
        itemCount:items.length+(loadingMore?1:0),
        itemBuilder:(context,i)=>i<items.length?ListingCard(item:items[i]):
          const Padding(padding:EdgeInsets.all(20),child:Center(child:CircularProgressIndicator())),
      ));
    })),
  ]);
}

class OpportunityHub extends StatefulWidget {
  const OpportunityHub({super.key});
  @override State<OpportunityHub> createState() => _OpportunityHubState();
}
class _OpportunityHubState extends State<OpportunityHub> {
  int tab = 0;
  late Future<List<Map<String, dynamic>>> future;
  @override void initState() { super.initState(); future = api.mobileFeed('jobs'); }
  void select(int value) => setState(() {
    tab = value;
    future = api.mobileFeed(value == 0 ? 'jobs' : 'tenders');
  });
  Future<void> refresh() async {
    final next = api.mobileFeed(tab == 0 ? 'jobs' : 'tenders');
    setState(() => future = next);
    try { await next; } catch (_) {}
  }
  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('İş fırsatları')),
    body: Column(children: [
      Padding(padding: const EdgeInsets.all(16), child: SegmentedButton<int>(
        segments: const [
          ButtonSegment(value: 0, label: Text('İş talepleri'), icon: Icon(Icons.work_outline)),
          ButtonSegment(value: 1, label: Text('İhaleler'), icon: Icon(Icons.gavel_outlined)),
        ],
        selected: {tab}, onSelectionChanged: (value) => select(value.first),
      )),
      Expanded(child: FutureBuilder<List<Map<String, dynamic>>>(
        future: future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const Loading();
          if (snapshot.hasError) return Retry(onTap: refresh);
          final items = snapshot.data ?? const <Map<String, dynamic>>[];
          if (items.isEmpty) return RefreshIndicator(
            onRefresh: refresh,
            child: ListView(physics: const AlwaysScrollableScrollPhysics(), children: [
              const SizedBox(height: 110),
              Empty(tab == 0 ? 'Şu anda açık iş talebi yok.' : 'Şu anda yayında ihale fırsatı yok.'),
            ]),
          );
          return RefreshIndicator(onRefresh: refresh, child: ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              final title = (item['title'] ?? 'Yeni fırsat').toString();
              final place = [item['city'], item['district']]
                .whereType<String>().where((part) => part.trim().isNotEmpty).join(' · ');
              final detail = (item['public_summary'] ?? item['description'] ?? '').toString();
              final organization = (item['organization'] ?? item['category'] ?? item['service_type'] ?? '').toString();
              final publishedValue = item['public_at'];
              final publishedAt = publishedValue is num
                ? DateTime.fromMillisecondsSinceEpoch((publishedValue * 1000).round())
                : DateTime.tryParse((item['published_at'] ?? '').toString());
              final age = publishedAt == null ? null : DateTime.now().difference(publishedAt);
              final isNewTender = tab == 1 && age != null && !age.isNegative && age.inHours < 24;
              return Card(margin: const EdgeInsets.only(bottom: 12), child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (isNewTender) const Chip(avatar: Icon(Icons.fiber_new, size: 17), label: Text('Son 24 saatte yayımlandı')),
                  Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  if (place.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 7),
                    child: Text(place, style: TextStyle(color: Theme.of(context).colorScheme.primary))),
                  if (organization.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 5), child: Text(organization)),
                  if (detail.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 9), child: Text(detail)),
                ]),
              ));
            },
          ));
        },
      )),
    ]),
  );
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
                    builder: (context, busy, child) => Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        FilledButton.icon(
                          onPressed: busy ? null : () { unawaited(MemberAuth.beginGoogleSignIn()); },
                          icon: busy
                            ? const SizedBox.square(dimension: 18,
                                child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.login_rounded),
                          label: Text(busy ? 'Giriş bekleniyor…' : 'Google ile devam et'),
                        ),
                        if (busy)
                          TextButton(
                            onPressed: () { unawaited(MemberAuth.cancelSignIn()); },
                            child: const Text('Girişten vazgeç'),
                          ),
                      ],
                    ),
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
      AccountLink(icon: Icons.person_outline_rounded, title: 'İlanlarım',
        subtitle: 'İlanlarını uygulama içinden yönet',
        onTap: () => _openMemberScreen(context, const MyListingsScreen())),
      AccountLink(icon: Icons.add_circle_outline, title: 'İlan ver',
        subtitle: 'Fotoğraflı hizmet veya operatör ilanı oluştur',
        onTap: () => _openMemberScreen(context, const ListingEditorScreen())),
      AccountLink(icon: Icons.work_outline_rounded, title: 'İş talepleri',
        subtitle: 'Açık talepleri ve ihale fırsatlarını görüntüle',
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
          builder: (_) => const OpportunityHub(),
        ))),
    ]);
}


void _openMemberScreen(BuildContext context, Widget screen) {
  if (MemberAuth.user.value == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Devam etmek için önce Google ile giriş yap.')));
    return;
  }
  Navigator.of(context).push(MaterialPageRoute<bool>(builder: (_) => screen));
}

class MyListingsScreen extends StatefulWidget {
  const MyListingsScreen({super.key});
  @override State<MyListingsScreen> createState() => _MyListingsScreenState();
}
class _MyListingsScreenState extends State<MyListingsScreen> {
  late Future<List<Map<String,dynamic>>> future;
  @override void initState() { super.initState(); future=api.myListings(); }
  Future<void> refresh() async {
    final next=api.myListings(); setState(()=>future=next);
    try { await next; } catch (_) {}
  }
  Future<void> edit(Map<String,dynamic> item) async {
    final changed=await Navigator.of(context).push<bool>(MaterialPageRoute(
      builder:(_)=>ListingEditorScreen(existing:item)));
    if(changed==true && mounted) await refresh();
  }
  Future<void> appeal(Map<String,dynamic> item) async {
    final controller=TextEditingController();
    final message=await showDialog<String>(context:context,builder:(dialog)=>AlertDialog(
      title:const Text('İlan incelemesine itiraz'),
      content:TextField(controller:controller,minLines:3,maxLines:6,maxLength:1000,
        decoration:const InputDecoration(hintText:'En az 10 karakterle açıklamanı yaz.')),
      actions:[TextButton(onPressed:()=>Navigator.pop(dialog),child:const Text('Vazgeç')),
        FilledButton(onPressed:()=>Navigator.pop(dialog,controller.text.trim()),child:const Text('Gönder'))]));
    controller.dispose();
    if(message==null||message.trim().length<10)return;
    try{
      await api.appealListing((item['id']??'').toString(),message.trim());
      if(mounted){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('İtirazın iletildi.')));await refresh();}
    }catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString().replaceFirst('Bad state: ',''))));}
  }
  Future<void> remove(Map<String,dynamic> item) async {
    final yes=await showDialog<bool>(context:context,builder:(d)=>AlertDialog(
      title:const Text('İlanı kaldır?'),
      content:Text('"' + (item['title']??'İlan').toString() + '" yayından kaldırılacak.'),
      actions:[TextButton(onPressed:()=>Navigator.pop(d,false),child:const Text('Vazgeç')),
        FilledButton(onPressed:()=>Navigator.pop(d,true),child:const Text('Kaldır'))]));
    if(yes!=true)return;
    try {
      await api.deleteListing((item['id']??'').toString());
      if(mounted){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('İlan kaldırıldı.')));await refresh();}
    } catch(e) {
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString().replaceFirst('Bad state: ',''))));
    }
  }
  String statusLabel(String s)=>switch(s){
    'approved'=>'Yayında','pending'=>'İncelemede','flagged'=>'Kontrol gerekiyor',
    'rejected'=>'Reddedildi',_=>'Durum: '+s,
  };
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('İlanlarım'),actions:[
      IconButton(tooltip:'Yenile',onPressed:refresh,icon:const Icon(Icons.refresh))]),
    floatingActionButton:FloatingActionButton.extended(
      onPressed:()async{
        final changed=await Navigator.of(context).push<bool>(MaterialPageRoute(builder:(_)=>const ListingEditorScreen()));
        if(changed==true&&mounted)await refresh();
      },icon:const Icon(Icons.add),label:const Text('Yeni ilan')),
    body:FutureBuilder<List<Map<String,dynamic>>>(future:future,builder:(context,snap){
      if(snap.connectionState==ConnectionState.waiting)return const Loading();
      if(snap.hasError)return Retry(onTap:refresh);
      final rows=snap.data??const <Map<String,dynamic>>[];
      if(rows.isEmpty)return const Center(child:Empty('Henüz ilan vermedin.'));
      return RefreshIndicator(onRefresh:refresh,child:ListView.separated(
        padding:const EdgeInsets.fromLTRB(16,16,16,96),itemCount:rows.length,
        separatorBuilder:(_,_)=>const SizedBox(height:10),
        itemBuilder:(context,index){
          final item=rows[index],loc=[item['city'],item['district']].where((v)=>v!=null&&v.toString().isNotEmpty).join(' / ');
          return Card(child:ListTile(
            title:Text((item['title']??'').toString(),maxLines:2,overflow:TextOverflow.ellipsis,style:const TextStyle(fontWeight:FontWeight.w800)),
            subtitle:Text(loc+' · '+statusLabel((item['status']??'').toString())),
            trailing:PopupMenuButton<String>(onSelected:(value){
              if(value=='edit')unawaited(edit(item));
              if(value=='appeal')unawaited(appeal(item));
              if(value=='remove')unawaited(remove(item));
            },itemBuilder:(_)=>[
              const PopupMenuItem(value:'edit',child:Text('Düzenle')),
              if(['flagged','rejected','pending'].contains(item['status']))
                const PopupMenuItem(value:'appeal',child:Text('İtiraz et')),
              const PopupMenuItem(value:'remove',child:Text('İlanı kaldır'))]),
            onTap:()=>unawaited(edit(item))));
        }));
    }));
}

class ListingEditorScreen extends StatefulWidget {
  const ListingEditorScreen({super.key,this.existing});
  final Map<String,dynamic>? existing;
  @override State<ListingEditorScreen> createState()=>_ListingEditorScreenState();
}
class _ListingEditorScreenState extends State<ListingEditorScreen>{
  static const categories=<String,String>{
    'crane':'Vinç','tow':'Çekici','basket':'Sepetli platform','machine':'İş makinesi',
    'lift':'Nakliyat asansörü','manlift':'Manlift','mobile_tire':'Mobil lastik',
    'operator':'İş arayan operatör',
  };
  final form=GlobalKey<FormState>();
  final picker=ImagePicker();
  late final TextEditingController title,description,city,district,address,price,phone,business;
  final photos=<({Uint8List bytes,String mime})>[];
  DistrictIndex? locationIndex;
  String category='crane';
  bool busy=false;
  @override void initState(){
    super.initState();
    final d=widget.existing??const <String,dynamic>{};
    category=categories.containsKey(d['category'])?(d['category'] as String):'crane';
    title=TextEditingController(text:(d['title']??'').toString());
    description=TextEditingController(text:(d['description']??'').toString());
    city=TextEditingController(text:(d['city']??'').toString());
    district=TextEditingController(text:(d['district']??'').toString());
    address=TextEditingController(text:(d['address']??'').toString());
    price=TextEditingController(text:(d['price_amount']??'').toString());
    phone=TextEditingController(text:(d['contact_phone']??'').toString());
    business=TextEditingController(text:(d['business_name']??'').toString());
    unawaited(loadLocations());
  }
  Future<void> loadLocations() async {
    try {
      final data = await DistrictIndex.load();
      if (mounted) setState(() => locationIndex = data);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('İl ve ilçe listesi yüklenemedi.')));
    }
  }
  List<String> get cityNames => locationIndex?.places.keys.toList() ?? [];
  List<String> get districtNames => locationIndex?.places[city.text]?.keys.toList() ?? [];
  @override void dispose(){
    for(final c in [title,description,city,district,address,price,phone,business]){c.dispose();}
    super.dispose();
  }
  String? validateText(String? value,String label,int min,int max){
    final n=(value??'').trim().length;
    return n<min||n>max?label+' '+min.toString()+'–'+max.toString()+' karakter olmalı.':null;
  }
  Future<void> choosePhotos()async{
    try{
      final files=await picker.pickMultiImage(imageQuality:78,maxWidth:1600);
      photos.clear();
      for(final f in files.take(3)){
        final bytes=await f.readAsBytes();
        if(bytes.length>1800000){if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Bir fotoğraf 1,8 MB sınırını aşıyor. Daha küçük fotoğraf seç.')));continue;}
        final ext=f.name.toLowerCase().split('.').last;
        photos.add((bytes:bytes,mime:ext=='png'?'image/png':ext=='webp'?'image/webp':'image/jpeg'));
      }
      if(mounted)setState((){});
    }catch(_){if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Fotoğraflar açılamadı. Tekrar dene.')));}
  }
  Future<void> submit()async{
    if(busy||!form.currentState!.validate())return;
    if(category!='operator'&&phone.text.trim().replaceAll(RegExp(r'\D'),'').length<10){
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('En az 10 rakamlı iletişim telefonu gir.')));return;
    }
    final amount=price.text.trim();
    if(amount.isNotEmpty&&int.tryParse(amount)==null){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Fiyatı tam sayı olarak yaz.')));return;}
    setState(()=>busy=true);
    try{
      final listing=<String,dynamic>{
        'category':category,'title':title.text.trim(),'description':description.text.trim(),
        'city':city.text.trim(),'district':district.text.trim(),'address':address.text.trim(),
        'price_amount':category=='operator'||amount.isEmpty?null:int.parse(amount),
        'price_unit':category=='operator'?null:amount.isEmpty?'teklif':'iş başı',
        'contact_phone':phone.text.trim(),'business_name':business.text.trim(),
      };
      final payload=photos.map((p)=><String,dynamic>{'mime_type':p.mime,'data':base64Encode(p.bytes)}).toList(growable:false);
      final d=widget.existing;
      final result=d==null?await api.createListing(listing,payload):
        await api.updateListing((d['id']??'').toString(),listing,photos.isEmpty?null:payload);
      if(!mounted)return;
      final flagged=result['status']=='flagged';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(
        flagged?'İlanın ek kontrole alındı.':d==null?'İlan gönderildi; durumunu İlanlarım bölümünde görebilirsin.':'Değişiklik gönderildi; ilan tekrar incelemeye alındı.')));
      Navigator.of(context).pop(true);
    }catch(e){
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString().replaceFirst('Bad state: ',''))));
    }finally{if(mounted)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:Text(widget.existing==null?'Yeni ilan':'İlanı düzenle')),
    body:Form(key:form,child:ListView(padding:const EdgeInsets.all(18),children:[
      DropdownButtonFormField<String>(initialValue:category,decoration:const InputDecoration(labelText:'Kategori'),
        items:categories.entries.map((e)=>DropdownMenuItem(value:e.key,child:Text(e.value))).toList(),
        onChanged:busy?null:(v){if(v!=null)setState(()=>category=v);}),
      const SizedBox(height:12),
      TextFormField(controller:title,maxLength:120,decoration:const InputDecoration(labelText:'Başlık'),
        validator:(v)=>validateText(v,'Başlık',5,120)),
      TextFormField(controller:description,maxLength:3000,minLines:4,maxLines:8,decoration:const InputDecoration(labelText:'Açıklama'),
        validator:(v)=>validateText(v,'Açıklama',20,3000)),
      DropdownButtonFormField<String>(
        initialValue:cityNames.contains(city.text)?city.text:null,
        decoration:const InputDecoration(labelText:'İl'),
        items:cityNames.map((v)=>DropdownMenuItem(value:v,child:Text(v))).toList(growable:false),
        onChanged:busy||cityNames.isEmpty?null:(v){if(v!=null)setState(() { city.text=v; district.clear(); });},
        validator:(v)=>v==null?'İl seç.':null),
      DropdownButtonFormField<String>(
        initialValue:districtNames.contains(district.text)?district.text:null,
        decoration:InputDecoration(labelText:'İlçe',helperText:city.text.isEmpty?'Önce il seç.':null),
        items:districtNames.map((v)=>DropdownMenuItem(value:v,child:Text(v))).toList(growable:false),
        onChanged:busy||city.text.isEmpty?null:(v){if(v!=null)setState(()=>district.text=v);},
        validator:(v)=>v==null?'İlçe seç.':null),
      TextFormField(controller:address,maxLength:300,decoration:const InputDecoration(labelText:'Adres (isteğe bağlı)')),
      if(category!='operator')TextFormField(controller:price,keyboardType:TextInputType.number,decoration:const InputDecoration(labelText:'Fiyat (isteğe bağlı)')),
      TextFormField(controller:phone,keyboardType:TextInputType.phone,decoration:const InputDecoration(labelText:'İletişim telefonu')),
      TextFormField(controller:business,maxLength:120,decoration:const InputDecoration(labelText:'Firma adı (isteğe bağlı)')),
      const SizedBox(height:14),
      OutlinedButton.icon(onPressed:busy?null:choosePhotos,icon:const Icon(Icons.add_a_photo_outlined),label:Text('Fotoğraf ekle ('+photos.length.toString()+'/3)')),
      if(photos.isNotEmpty)SizedBox(height:110,child:ListView.separated(scrollDirection:Axis.horizontal,itemCount:photos.length,
        separatorBuilder:(_,_)=>const SizedBox(width:8),itemBuilder:(_,i)=>ClipRRect(borderRadius:BorderRadius.circular(10),
          child:Image.memory(photos[i].bytes,width:140,height:100,fit:BoxFit.cover)))),
      const SizedBox(height:10),
      const Text('İlan, YükVinç’in mevcut doğrulama ve inceleme kurallarından geçer. Değişiklikler tekrar incelemeye alınır.'),
      const SizedBox(height:18),
      FilledButton.icon(onPressed:busy?null:submit,
        icon:busy?const SizedBox.square(dimension:18,child:CircularProgressIndicator(strokeWidth:2)):const Icon(Icons.publish),
        label:Text(busy?'Gönderiliyor…':'İlanı gönder')),
    ])));
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
                onPressed: () => card.contact(context, Uri(scheme: 'whatsapp', host: 'send', queryParameters: {
                  'text': '${item.title}\n$baseUrl/ilan/${Uri.encodeComponent(item.id)}/',
                })),
              ),
              const SizedBox(height: 16),
              SelectableText(item.description, style: const TextStyle(height: 1.6)),
              const SizedBox(height: 24),
              FilledButton.icon(onPressed: () => showServiceContact(context, item, widget.client ?? api),
                icon: const Icon(Icons.phone_outlined), label: const Text('İletişim bilgileri')),
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
