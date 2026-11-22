part of 'main.dart';

class Nearby extends StatefulWidget {
  const Nearby({super.key, this.onBrowse, this.roadside = false, this.client, this.locate = devicePoint});
  final VoidCallback? onBrowse;
  final bool roadside;
  final YukApi? client;
  final Future<GeoPoint> Function() locate;
  @override State<Nearby> createState() => _NearbyState();
}

class _NearbyState extends State<Nearby> {
  DistrictIndex? index;
  String city = 'Konya', district = '';
  late String category;
  String? suggestedCity;
  int radius = 100, generation = 0;
  bool locating = false, loading = true, newest = false;
  String? error, locationMessage;
  Future<bool> Function()? settings;
  GeoPoint? point;
  ServiceResults? results;

  @override void initState() {
    super.initState();
    category = widget.roadside ? 'tow' : 'all';
    unawaited(initialize());
  }

  Future<void> initialize() async {
    setState(() { loading = true; error = null; });
    try {
      final data = await DistrictIndex.load();
      try {
        final prefs = await SharedPreferences.getInstance();
        final saved = prefs.getString('service_search_city');
        if (saved != null && data.places.containsKey(saved)) city = saved;
      } catch (_) {}
      if (!mounted) return;
      setState(() => index = data);
      await search();
    } catch (_) {
      if (mounted) setState(() { loading = false; error = 'İl ve ilçe listesi yüklenemedi.'; });
    }
  }

  Future<void> search() async {
    final data = index;
    if (data == null) return;
    final token = ++generation;
    final source = ServiceSearch(widget.client ?? api, data);
    final current = point;
    setState(() { loading = true; results = null; error = null; });
    try {
      final next = current == null ? await source.region(city, district, category)
          : await source.nearby(current, radius, category);
      if (mounted && token == generation) setState(() => results = next);
    } catch (_) {
      if (mounted && token == generation) setState(() => error = 'İlanlar yüklenemedi. İnternet bağlantını kontrol et.');
    } finally {
      if (mounted && token == generation) setState(() => loading = false);
    }
  }

  Future<void> locate() async {
    if (locating) return;
    final token = ++generation;
    setState(() { locating = true; loading = false; locationMessage = null; settings = null; error = null; });
    try {
      final fix = await widget.locate();
      if (!mounted || token != generation) return;
      setState(() { point = fix; suggestedCity = index!.closestProvince(fix); locating = false; newest = false; });
      await search();
    } catch (e) {
      if (!mounted || token != generation) return;
      setState(() {
        locating = false; point = null;
        locationMessage = e is _LocationIssue ? e.message : 'Konum alınamadı. Aşağıdan il ve ilçe seçebilirsin.';
        settings = e is _LocationIssue ? e.settings : null;
      });
      await search();
    }
  }

  void manual(String province, String borough) {
    setState(() { point = null; locating = false; settings = null; locationMessage = null;
      city = province; district = borough; });
    unawaited(search());
    unawaited(SharedPreferences.getInstance().then((p) => p.setString('service_search_city', province))
        .catchError((_) => false));
  }

  @override Widget build(BuildContext context) {
    final data = index;
    final result = results;
    final hits = result?.hits.toList() ?? <ServiceHit>[];
    if (newest) hits.sort((a,b) => b.listing.createdAt.compareTo(a.listing.createdAt));
    final labels = widget.roadside ? const {'tow': 'Çekici', 'mobile_tire': 'Mobil lastikçi'} : _ListingsState.filters;
    final byGps = point != null;
    return RefreshIndicator(onRefresh: byGps ? locate : search, child: ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      itemCount: hits.length + 2,
      itemBuilder: (context, i) {
        if (i == 0) return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(widget.roadside ? 'Yol yardım' : 'Yakınımda', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 12),
          if (widget.roadside)
            Wrap(spacing: 8, children: [for (final entry in labels.entries)
              ChoiceChip(label: Text(entry.value), selected: category == entry.key,
                onSelected: data == null || locating ? null : (yes) {
                  if (yes && category != entry.key) { category = entry.key; unawaited(search()); }
                })])
          else DropdownButtonFormField<String>(initialValue: category, isExpanded: true,
            decoration: const InputDecoration(labelText: 'Kategori'),
            items: [for (final e in labels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
            onChanged: data == null || locating ? null : (v) {
              if (v != null && category != v) { category = v; unawaited(search()); }
            }),
          const SizedBox(height: 10),
          FilledButton.icon(icon: const Icon(Icons.my_location), label: Text(locating ? 'Konum alınıyor…' :
            byGps ? 'Konumumu yenile' : 'Konumumdan ara'), onPressed: data == null || locating ? null : locate),
          if (widget.roadside) OutlinedButton.icon(
            icon: const Icon(Icons.location_on_outlined), label: const Text('Konumumu göster'),
            onPressed: locating ? null : () => showRoadsidePosition(context)),
          if (locationMessage != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(locationMessage!)),
          if (settings != null) TextButton(onPressed: () async { await settings?.call(); }, child: const Text('Ayarları aç')),
          if (byGps) ...[
            Wrap(spacing: 6, children: [for (final km in [5, 10, 25, 50, 100]) ChoiceChip(
              label: Text('$km km'), selected: radius == km, onSelected: locating ? null : (yes) {
                if (yes && radius != km) { radius = km; unawaited(search()); }
              })]),
            if (suggestedCity != null) TextButton(
              onPressed: () => manual(suggestedCity!, ''),
              child: Text('${suggestedCity!} ilindeki tüm ilçelerde ara')),
            TextButton(onPressed: () => manual(city, district), child: const Text('İl ve ilçeyle ara')),
          ] else if (data != null) ...[
            DropdownButtonFormField<String>(initialValue: city, isExpanded: true,
              decoration: const InputDecoration(labelText: 'İl'),
              items: [for (final c in data.places.keys) DropdownMenuItem(value: c, child: Text(c))],
              onChanged: (c) { if (c != null) manual(c, ''); }),
            DropdownButtonFormField<String>(key: ValueKey(city), initialValue: district, isExpanded: true,
              decoration: const InputDecoration(labelText: 'İlçe'),
              items: [const DropdownMenuItem(value: '', child: Text('Tüm ilçeler')),
                for (final d in data.places[city]!.keys) DropdownMenuItem(value: d, child: Text(d))],
              onChanged: (d) { if (d != null) manual(city, d); }),
          ],
          const SizedBox(height: 16),
          if (loading || locating) const LinearProgressIndicator(),
          if (error != null) ...[Text(error!), OutlinedButton(onPressed: data == null ? initialize : search, child: const Text('Tekrar dene'))],
          if (result != null && !locating) ...[
            Text(byGps ? '$radius km içinde • ${hits.length} ilan' :
              [city, if (district.isNotEmpty) district, '${hits.length} ilan'].join(' · '),
              style: Theme.of(context).textTheme.titleMedium),
            if (byGps && hits.length > 1) SwitchListTile(contentPadding: EdgeInsets.zero,
              title: const Text('En yeni ilanlar önce'), value: newest,
              onChanged: (v) => setState(() => newest = v)),
            if (result.incomplete) TextButton.icon(icon: const Icon(Icons.refresh),
              label: const Text('Sonuçlar eksik olabilir. Yenile'), onPressed: search),
            if (hits.isEmpty && !result.incomplete) Padding(padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(byGps ? 'Bu mesafede ilan bulunamadı. Mesafeyi artırabilir veya il seçebilirsin.' :
                'Seçtiğin bölge ve kategoride ilan bulunamadı.')),
          ],
        ]);
        if (i > hits.length) return widget.onBrowse == null ? const SizedBox.shrink() :
          OutlinedButton(onPressed: widget.onBrowse, child: const Text('Tüm Türkiye ilanları'));
        final hit = hits[i-1], item = hit.listing;
        final km = hit.km;
        return Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(item.title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text([item.city, item.district].where((v) => v.isNotEmpty).join(' / ')),
            if (km != null) Text((hit.districtCenter ? 'İlçe merkezine' : 'İlan konumuna') +
              ' yaklaşık ${km.toStringAsFixed(1).replaceAll('.', ',')} km'),
            const SizedBox(height: 8),
            Wrap(spacing: 8, children: [
              if (widget.roadside || item.category == 'tow' || item.category == 'mobile_tire')
                FilledButton.tonalIcon(icon: const Icon(Icons.phone_outlined),
                  label: const Text('İletişim'), onPressed: () => showServiceContact(context, item, widget.client ?? api)),
              TextButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => ListingDetail(itemId: item.id, client: widget.client))),
                child: const Text('İlan detayı')),
            ]),
          ],
        )));
      },
    ));
  }
}
