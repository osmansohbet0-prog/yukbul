part of 'main.dart';

typedef RoadsideFix = ({GeoPoint point, DateTime measuredAt, double accuracyMeters});

Future<RoadsideFix> _readRoadsideFix() async {
  final position = await _devicePosition(LocationAccuracy.high);
  return (
    point: (latitude: position.latitude, longitude: position.longitude),
    measuredAt: position.timestamp,
    accuracyMeters: position.accuracy,
  );
}

Future<void> showRoadsidePosition(BuildContext context) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  builder: (_) => const RoadsidePositionSheet(),
);

class RoadsidePositionSheet extends StatefulWidget {
  const RoadsidePositionSheet({super.key, this.read = _readRoadsideFix});
  final Future<RoadsideFix> Function() read;
  @override
  State<RoadsidePositionSheet> createState() => _RoadsidePositionSheetState();
}

class _RoadsidePositionSheetState extends State<RoadsidePositionSheet> {
  RoadsideFix? fix;
  bool reading = false;
  String? error, clipboardMessage;
  Future<bool> Function()? settings;

  @override
  void initState() {
    super.initState();
    unawaited(refresh());
  }

  Future<void> refresh() async {
    if (reading) return;
    setState(() { reading = true; fix = null; error = null; settings = null; clipboardMessage = null; });
    try {
      final value = await widget.read();
      if (mounted) setState(() { reading = false; fix = value; });
    } catch (e) {
      if (mounted) setState(() {
        reading = false;
        error = e is _LocationIssue ? e.message :
            'Konum alınamadı. Telefonun konum ayarını kontrol edip tekrar deneyebilirsin.';
        settings = e is _LocationIssue ? e.settings : null;
      });
    }
  }

  Future<void> copyCoordinates(String coordinates) async {
    try {
      await Clipboard.setData(ClipboardData(text: coordinates));
      if (mounted) setState(() => clipboardMessage = 'Koordinatlar kopyalandı.');
    } catch (_) {
      if (mounted) setState(() => clipboardMessage = 'Kopyalama başarısız. Koordinatları basılı tutarak seçebilirsin.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final location = fix;
    final coordinates = location == null ? '' :
        '${location.point.latitude.toStringAsFixed(5)}, ${location.point.longitude.toStringAsFixed(5)}';
    final measured = location?.measuredAt.toLocal();
    final theme = Theme.of(context).textTheme;
    return SafeArea(top: false, child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: Text('Yol yardım için konumum', style: theme.titleLarge)),
          IconButton(tooltip: 'Kapat', icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).pop()),
        ]),
        const SizedBox(height: 12),
        if (reading) ...[const LinearProgressIndicator(), const SizedBox(height: 8), const Text('Telefon konumunu alıyor…')],
        if (error != null) Text(error!),
        if (settings != null) TextButton(onPressed: () async { await settings?.call(); }, child: const Text('Ayarları aç')),
        if (location != null) ...[
          Text('Enlem, boylam', style: theme.labelLarge),
          SelectableText(coordinates, style: theme.headlineSmall),
          const SizedBox(height: 8),
          if (measured != null) Text('Ölçüm zamanı · ${measured.day}.${measured.month}.${measured.year} '
              '${MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(measured), alwaysUse24HourFormat: true)}'),
          if (location.accuracyMeters.isFinite && location.accuracyMeters > 0)
            Text('Telefonun bildirdiği hassasiyet · yaklaşık ${location.accuracyMeters.ceil()} m'),
          const SizedBox(height: 12),
          FilledButton.icon(onPressed: () => copyCoordinates(coordinates), icon: const Icon(Icons.copy),
            label: const Text('Koordinatları kopyala')),
          if (clipboardMessage != null) Semantics(liveRegion: true, child: Text(clipboardMessage!)),
        ],
        if (!reading) OutlinedButton.icon(icon: const Icon(Icons.my_location), onPressed: refresh,
          label: Text(location == null ? 'Tekrar dene' : 'Konumumu yenile')),
      ]),
    ));
  }
}
