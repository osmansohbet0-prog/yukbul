import 'dart:async';
import 'dart:convert';
import 'package:material_ui/material_ui.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

const baseUrl = 'https://yukvinc.com.tr';
const navy = Color(0xFF172D35);
const yellow = Color(0xFFF5AD35);
const green = Color(0xFF168256);
const bg = Color(0xFFF5F7F8);

class YukListing {
  const YukListing({required this.id, required this.title, required this.city,
    required this.district, required this.category, required this.description,
    this.photoUrl, this.distanceKm});
  final String id, title, city, district, category, description;
  final String? photoUrl;
  final num? distanceKm;
  factory YukListing.fromJson(Map<String, dynamic> v) {
    String s(String key) => (v[key] ?? '').toString();
    return YukListing(
      id: s('id'), title: s('title'), city: s('city'), district: s('district'),
      category: s('category'), description: s('description'),
      photoUrl: v['photo_url']?.toString(),
      distanceKm: v['distance_km'] is num ? v['distance_km'] as num : null,
    );
  }
}

class YukApi {
  YukApi({http.Client? client}) : client = client ?? http.Client();
  final http.Client client;
  Future<List<YukListing>> listings({String category = 'all', String query = ''}) async {
    final q = <String, String>{};
    if (category != 'all') q['category'] = category;
    if (query.trim().isNotEmpty) q['q'] = query.trim();
    final uri = Uri.parse(baseUrl + '/api/listings')
      .replace(queryParameters: q.isEmpty ? null : q);
    return _parse(await client.get(uri, headers: const {'Accept': 'application/json'})
        .timeout(const Duration(seconds: 15)));
  }
  Future<List<YukListing>> nearby(double lat, double lng) async {
    return _parse(await client.post(Uri.parse(baseUrl + '/api/ai/nearby'),
      headers: const {'Content-Type': 'application/json', 'Origin': baseUrl},
      body: jsonEncode({'latitude': lat, 'longitude': lng, 'radius_km': 100}),
    ).timeout(const Duration(seconds: 15)));
  }
  List<YukListing> _parse(http.Response response) {
    if (response.statusCode != 200) {
      throw Exception('Sunucu hatası: ' + response.statusCode.toString());
    }
    final body = jsonDecode(response.body);
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
    final ok = await launchUrl(Uri.parse(baseUrl + path),
        mode: LaunchMode.inAppBrowserView);
    if (!ok) throw Exception('Bağlantı açılamadı');
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Sayfa açılamadı. İnternet bağlantını kontrol et.')));
  }
}

void main() => runApp(const YukVincApp());
class YukVincApp extends StatelessWidget {
  const YukVincApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'YükVinç', debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: navy)
          .copyWith(primary: navy, secondary: yellow, tertiary: green),
      scaffoldBackgroundColor: bg,
      appBarTheme: const AppBarTheme(backgroundColor: bg, foregroundColor: navy),
      cardTheme: CardThemeData(
        color: Colors.white, elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))),
    ),
    home: const Shell(),
  );
}

class Shell extends StatefulWidget {
  const Shell({super.key});
  @override State<Shell> createState() => _ShellState();
}
class _ShellState extends State<Shell> {
  int tab = 0;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Row(children: [
        Icon(Icons.local_shipping_rounded, size: 29, color: navy),
        SizedBox(width: 10),
        Text('YükVinç', style: TextStyle(fontWeight: FontWeight.w900)),
      ]),
      actions: [IconButton(
        icon: const Icon(Icons.open_in_browser_rounded), tooltip: 'Web sitesi',
        onPressed: () => openSite(context, '/'),
      )],
    ),
    body: SafeArea(child: IndexedStack(index: tab, children: const [
      Opportunities(), ListingsScreen(), Nearby(), Account(),
    ])),
    bottomNavigationBar: NavigationBar(
      selectedIndex: tab,
      onDestinationSelected: (v) => setState(() => tab = v),
      indicatorColor: yellow.withValues(alpha: .3),
      destinations: const [
        NavigationDestination(icon: Icon(Icons.work_outline_rounded), label: 'Fırsatlar'),
        NavigationDestination(icon: Icon(Icons.search_rounded), label: 'İlanlar'),
        NavigationDestination(icon: Icon(Icons.near_me_outlined), label: 'Yakınımda'),
        NavigationDestination(icon: Icon(Icons.person_outline_rounded), label: 'Hesabım'),
      ],
    ),
  );
}

class Opportunities extends StatefulWidget {
  const Opportunities({super.key});
  @override State<Opportunities> createState() => _OpportunitiesState();
}
class _OpportunitiesState extends State<Opportunities> {
  late Future<List<YukListing>> future;
  @override void initState() { super.initState(); future = api.listings(); }
  Future<void> refresh() async {
    final next = api.listings(); setState(() => future = next);
    try { await next; } catch (_) {}
  }
  @override Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: refresh,
    child: ListView(padding: const EdgeInsets.all(18), children: [
      Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          color: navy, borderRadius: BorderRadius.circular(24)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('İŞ VE HİZMET FIRSATLARI',
            style: TextStyle(color: yellow, fontSize: 12, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          const Text('Yeni işini YükVinç’te keşfet.',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900,
              fontSize: 27, height: 1.16)),
          const SizedBox(height: 10),
          const Text('Vinç, çekici, operatör ve ekipman ilanları tek yerde.',
            style: TextStyle(color: Color(0xFFD5E0E2), height: 1.45)),
          const SizedBox(height: 18),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: yellow, foregroundColor: navy),
            onPressed: () => openSite(context, '/ilan-ver/'),
            icon: const Icon(Icons.post_add_rounded),
            label: const Text('İş İlanı Ver', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ]),
      ),
      const SizedBox(height: 15),
      Row(children: [
        Expanded(child: ShortcutCard(icon: Icons.engineering_outlined,
          title: 'İş ilanları', subtitle: 'Operatör ilanları',
          onTap: () => openSite(context, '/kategori/operator-is-ilanlari/'))),
        const SizedBox(width: 10),
        Expanded(child: ShortcutCard(icon: Icons.local_shipping_outlined,
          title: 'Yol yardım', subtitle: 'Çekici hizmetleri',
          onTap: () => openSite(context, '/kategori/oto-kurtarici/'))),
      ]),
      const SizedBox(height: 24),
      const Text('Güncel ilanlar', style: TextStyle(fontSize: 21,
        fontWeight: FontWeight.w800, color: navy)),
      const SizedBox(height: 5),
      const Text('Onaylı ilanlar gösterilir. Operatör ilanları iş arayan kişilere aittir.',
        style: TextStyle(fontSize: 12, color: Colors.black54)),
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
          Icon(icon, size: 27, color: navy), const SizedBox(height: 12),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: navy)),
          const SizedBox(height: 3),
          Text(subtitle, style: const TextStyle(fontSize: 11, color: Colors.black54)),
        ]))),
  );
}

class ListingsScreen extends StatefulWidget {
  const ListingsScreen({super.key});
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
    'machine': 'Makine', 'operator': 'Operatör',
  };
  @override void initState() { super.initState(); future = api.listings(); }
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
          filled: true, fillColor: Colors.white,
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
            onSelected: (_) { category = filter.key; load(); }))])),
    Expanded(child: FutureBuilder<List<YukListing>>(
      future: future, builder: (context, snap) {
        if (!snap.hasData && !snap.hasError) return const Loading();
        if (snap.hasError) return Retry(onTap: refresh);
        final items = snap.data ?? [];
        if (items.isEmpty) return const Empty('Bu aramaya uygun ilan yok.');
        return RefreshIndicator(onRefresh: refresh, child: ListView.builder(
          padding: const EdgeInsets.fromLTRB(18, 4, 18, 20),
          itemCount: items.length,
          itemBuilder: (context, i) => ListingCard(item: items[i]),
        ));
      },
    )),
  ]);
}

class Nearby extends StatefulWidget {
  const Nearby({super.key});
  @override State<Nearby> createState() => _NearbyState();
}
class _NearbyState extends State<Nearby> {
  bool loading = false;
  String? error;
  List<YukListing>? items;
  Future<void> find() async {
    if (loading) return;
    setState(() { loading = true; error = null; });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw StateError('Telefonunda konum hizmetini etkinleştir.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw StateError('Konum izni verilmedi. Şehir bazlı arama yapabilirsin.');
      }
      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)));
      final result = await api.nearby(p.latitude, p.longitude);
      if (mounted) setState(() => items = result);
    } catch (e) {
      if (mounted) setState(() => error =
        e is StateError ? e.message : 'Konum alınamadı. Tekrar deneyebilirsin.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }
  @override Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(18), children: [
      Container(padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(color: navy, borderRadius: BorderRadius.circular(24)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.near_me_rounded, size: 32, color: yellow),
          const SizedBox(height: 12),
          const Text('Yakınımdaki ilanları bul', style: TextStyle(
            color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900)),
          const SizedBox(height: 9),
          const Text('Tek dokunuşla konumunu paylaş. Sonuçlar doğrulanmış ilan adreslerine göre yaklaşık mesafedir; henüz canlı çekici takibi değildir.',
            style: TextStyle(color: Color(0xFFCFDCE0), height: 1.5)),
          const SizedBox(height: 18),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: yellow, foregroundColor: navy),
            onPressed: loading ? null : find, icon: const Icon(Icons.my_location),
            label: Text(loading ? 'Konum aranıyor...' : 'Konumumla İlan Bul'),
          ),
        ])),
      if (loading) const Loading(),
      if (error != null) Padding(padding: const EdgeInsets.symmetric(vertical: 14),
        child: Text(error!, style: const TextStyle(color: Colors.red))),
      if (items != null) ...[
        const SizedBox(height: 23),
        Text('Yakındaki sonuçlar (' + items!.length.toString() + ')',
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: navy)),
        const SizedBox(height: 10),
        if (items!.isEmpty) const Empty('Doğrulanmış konumlu ilan bulunamadı.'),
        for (final item in items!) ListingCard(item: item),
      ],
      const SizedBox(height: 15),
      OutlinedButton.icon(
        onPressed: () => openSite(context, '/'),
        icon: const Icon(Icons.location_city),
        label: const Text('Şehre göre ara'),
      ),
    ]);
}

class Account extends StatelessWidget {
  const Account({super.key});
  @override Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(18), children: [
      const Text('Hesabım', style: TextStyle(
        color: navy, fontSize: 25, fontWeight: FontWeight.w900)),
      const SizedBox(height: 7),
      const Text('Mevcut YükVinç hesabınla devam et.',
        style: TextStyle(color: Colors.black54)),
      const SizedBox(height: 17),
      AccountLink(icon: Icons.login_rounded, title: 'Giriş Yap',
        subtitle: 'Hesabına güvenli şekilde eriş',
        onTap: () => openSite(context, '/giris/')),
      AccountLink(icon: Icons.post_add_rounded, title: 'İş İlanı Ver',
        subtitle: 'İş ve operatör ilanı oluşturma formu',
        onTap: () => openSite(context, '/ilan-ver/')),
      AccountLink(icon: Icons.add_circle_outline, title: 'Vinç veya Çekici İlanı Ver',
        subtitle: 'Araç bilgilerini ve fotoğraflarını ekle',
        onTap: () => openSite(context, '/ilan-ver/')),
      const SizedBox(height: 19),
      const Text('Sürücü Modu', style: TextStyle(
        fontSize: 21, fontWeight: FontWeight.w800, color: navy)),
      const SizedBox(height: 8),
      Card(child: Padding(padding: const EdgeInsets.all(17),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Canlı mesai sistemi henüz etkin değil',
            style: TextStyle(color: navy, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text('Arka plan GPS ve çağrı kabulü için güvenli sürücü servisi hazırlanmalı. Bu test sürümü konumunu arka planda paylaşmaz.',
            style: TextStyle(color: Colors.black54, height: 1.5)),
          const SizedBox(height: 12),
          SizedBox(width: double.infinity,
            child: FilledButton.icon(onPressed: null,
              icon: const Icon(Icons.power_settings_new),
              label: const Text('Mesaiye Başla (yakında)'))),
        ]))),
      const SizedBox(height: 16),
      const Text('YükVinç Android test sürümü 0.1.0',
        style: TextStyle(color: Colors.black45, fontSize: 12)),
    ]);
}

class AccountLink extends StatelessWidget {
  const AccountLink({super.key, required this.icon, required this.title,
    required this.subtitle, required this.onTap});
  final IconData icon; final String title, subtitle;
  final VoidCallback onTap;
  @override Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: CircleAvatar(backgroundColor: bg, child: Icon(icon, color: navy)),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
      subtitle: Text(subtitle), trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    ));
}

class ListingCard extends StatelessWidget {
  const ListingCard({super.key, required this.item});
  final YukListing item;
  String get categoryLabel => switch (item.category) {
    'crane' => 'VİNÇ', 'tow' => 'ÇEKİCİ', 'basket' => 'SEPETLİ PLATFORM',
    'mobile_tire' => 'MOBİL LASTİK', 'operator' => 'İŞ ARAYAN OPERATÖR',
    'manlift' => 'MANLİFT', 'machine' => 'İŞ MAKİNESİ', _ => 'İLAN',
  };
  @override Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: InkWell(borderRadius: BorderRadius.circular(18),
      onTap: () => showModalBottomSheet<void>(context: context, showDragHandle: true,
        isScrollControlled: true,
        builder: (sheet) => SafeArea(child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 10, 22, 24),
          child: Column(mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item.title, style: const TextStyle(fontSize: 22,
              color: navy, fontWeight: FontWeight.w900)),
            const SizedBox(height: 7),
            Text(item.city + ' / ' + item.district,
              style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 12),
            ConstrainedBox(constraints: const BoxConstraints(maxHeight: 180),
              child: SingleChildScrollView(child: Text(item.description))),
            const SizedBox(height: 16),
            SizedBox(width: double.infinity, child: FilledButton.icon(
              onPressed: () { Navigator.pop(sheet);
                openSite(context, '/ilan/' + Uri.encodeComponent(item.id) + '/'); },
              icon: const Icon(Icons.open_in_browser),
              label: const Text('İlan detayını aç'))),
          ])))),
      child: Padding(padding: const EdgeInsets.all(13),
        child: Row(children: [
          ClipRRect(borderRadius: BorderRadius.circular(12),
            child: SizedBox(width: 80, height: 80,
              child: item.photoUrl != null && item.photoUrl!.startsWith('/')
                ? Image.network(baseUrl + item.photoUrl!, fit: BoxFit.cover,
                    errorBuilder: (context, err, trace) => const ListingPlaceholder())
                : const ListingPlaceholder())),
          const SizedBox(width: 13),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
            children: [
            Text(categoryLabel, style: const TextStyle(color: green,
              fontWeight: FontWeight.w900, fontSize: 10)),
            const SizedBox(height: 5),
            Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: navy, fontWeight: FontWeight.w800)),
            const SizedBox(height: 7),
            Text(item.city + ' / ' + item.district,
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.black54, fontSize: 11)),
            if (item.distanceKm != null)
              Text('Yaklaşık ' + item.distanceKm.toString() + ' km',
                style: const TextStyle(color: green, fontSize: 11)),
          ])),
          const Icon(Icons.chevron_right, color: Colors.black38),
        ])),
    ));
}
class ListingPlaceholder extends StatelessWidget {
  const ListingPlaceholder({super.key});
  @override Widget build(BuildContext context) => Container(
    color: const Color(0xFFEAF0F1),
    child: const Icon(Icons.local_shipping_outlined, size: 32, color: navy));
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
      style: const TextStyle(color: Colors.black54))));
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
