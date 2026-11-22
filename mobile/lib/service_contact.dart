part of 'main.dart';

String _serviceNumber(String value) {
  if (!RegExp(r'^[+0-9 ()-]+$').hasMatch(value)) return '';
  final digits = value.replaceAll(RegExp(r'\D'), '');
  return switch (digits.length) {
    10 => '90$digits',
    11 when digits.startsWith('0') => '90${digits.substring(1)}',
    12 when digits.startsWith('90') => digits,
    _ => '',
  };
}

bool _listingPage(Uri uri, String id) {
  final segments = uri.pathSegments.where((part) => part.isNotEmpty).toList();
  return uri.origin == baseUrl && uri.userInfo.isEmpty &&
      (segments.length == 2 || segments.length == 3) && segments.first == 'ilan' && segments[1] == id;
}

Future<String> publicServiceNumber(YukApi source, YukListing item) async {
  final available = _serviceNumber(item.phone);
  if (available.isNotEmpty) return available;
  // The live JSON feed omits phone numbers. Read only the listing's public call button on demand.
  var page = Uri.parse('$baseUrl/ilan/${Uri.encodeComponent(item.id)}/');
  for (var attempt = 0; attempt < 3; attempt++) {
    final request = http.Request('GET', page)..followRedirects = false;
    request.headers['Accept'] = 'text/html';
    final reply = await source.client.send(request).timeout(const Duration(seconds: 8));
    if ([301,302,303,307,308].contains(reply.statusCode)) {
      final location = reply.headers['location'];
      await reply.stream.listen((_) {}).cancel();
      if (location == null) break;
      final next = page.resolve(location);
      if (!next.isScheme('https') || !_listingPage(next, item.id)) break;
      page = next;
      continue;
    }
    if (reply.statusCode != 200) {
      await reply.stream.listen((_) {}).cancel();
      if (reply.statusCode == 404) throw ListingUnavailable();
      break;
    }
    final bytes = BytesBuilder(copy: false);
    await for (final chunk in reply.stream.timeout(const Duration(seconds: 8))) {
      if (bytes.length + chunk.length > 1024 * 1024) throw const FormatException('İlan sayfası çok büyük.');
      bytes.add(chunk);
    }
    final document = html.parse(utf8.decode(bytes.takeBytes()));
    final canonical = document.querySelector('link[rel="canonical"]')?.attributes['href'];
    if (canonical == null || !_listingPage(page.resolve(canonical), item.id)) break;
    final link = document.querySelector('a[data-metric="phone"][href^="tel:"]');
    if (link == null) return '';
    return _serviceNumber(link.attributes['href']!.substring(4));
  }
  throw StateError('İletişim bilgisi alınamadı.');
}

Future<void> showServiceContact(BuildContext context, YukListing item, YukApi source) async {
  var future = publicServiceNumber(source, item);
  await showModalBottomSheet<void>(context: context, isScrollControlled: true, useSafeArea: true,
    builder: (_) => StatefulBuilder(builder: (sheet, change) => SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(item.title, style: Theme.of(sheet).textTheme.titleLarge),
        Text([item.city, item.district].where((v) => v.isNotEmpty).join(' / ')),
        if (item.category == 'tow' || item.category == 'mobile_tire')
          TextButton.icon(icon: const Icon(Icons.location_on_outlined), label: const Text('Konumumu göster'),
            onPressed: () => showRoadsidePosition(sheet)),
        const SizedBox(height: 16),
        FutureBuilder<String>(future: future, builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const LinearProgressIndicator();
          if (snapshot.hasError) return Column(children: [
            Text(snapshot.error is ListingUnavailable ? 'Bu ilan artık yayında değil.' : 'İletişim bilgisi alınamadı.'),
            TextButton(onPressed: () => change(() { future = publicServiceNumber(source, item); }), child: const Text('Tekrar dene')),
          ]);
          final number = snapshot.data ?? '';
          if (number.isEmpty) return const Text('İlan sahibi telefon numarası paylaşmamış.');
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SelectableText('+$number', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 6, children: [
              FilledButton.icon(icon: const Icon(Icons.call_outlined), label: const Text('Telefonla ara'),
                onPressed: () => ListingCard(item: item).contact(context, Uri(scheme: 'tel', path: '+$number'))),
              OutlinedButton.icon(icon: const Icon(Icons.copy), label: const Text('Numarayı kopyala'),
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: '+$number'));
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Numara kopyalandı.')));
                }),
              TextButton(onPressed: () => ListingCard(item: item).contact(context,
                Uri(scheme: 'whatsapp', host: 'send', queryParameters: {'phone': number})), child: const Text('WhatsApp')),
            ]),
          ]);
        }),
      ]),
    )));
}
