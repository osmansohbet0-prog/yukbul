import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:yukvinc_mobile/main.dart';

void main() {
  testWidgets('coordinates are displayed locally and copied only on tap', (tester) async {
    String? copied;
    final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String;
      return null;
    });
    addTearDown(() => messenger.setMockMethodCallHandler(SystemChannels.platform, null));
    var samples = 0;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: RoadsidePositionSheet(read: () async {
      samples++;
      return (
        point: (latitude: samples == 1 ? 37.865123 : 37.865678, longitude: 32.485432),
        measuredAt: DateTime(2026, 11, 21, 13, 7), accuracyMeters: 14.2,
      );
    }))));
    await tester.pumpAndSettle();
    expect(find.text('37.86512, 32.48543'), findsOneWidget);
    expect(find.textContaining('yaklaşık 15 m'), findsOneWidget);
    expect(find.textContaining('21.11.2026 13:07'), findsOneWidget);
    expect(copied, isNull);
    await tester.tap(find.text('Koordinatları kopyala'));
    await tester.pumpAndSettle();
    expect(copied, '37.86512, 32.48543');
    expect(find.text('Koordinatlar kopyalandı.'), findsOneWidget);
    await tester.tap(find.text('Konumumu yenile'));
    await tester.pumpAndSettle();
    expect(find.text('37.86568, 32.48543'), findsOneWidget);
    expect(find.text('Koordinatlar kopyalandı.'), findsNothing);
    expect(copied, '37.86512, 32.48543');
  });

  testWidgets('a failed location can be retried without keeping an old fix', (tester) async {
    var attempts = 0;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: RoadsidePositionSheet(read: () async {
      attempts++;
      if (attempts == 2) throw StateError('no fix');
      return (point: (latitude: 38.0, longitude: 32.0), measuredAt: DateTime(2026), accuracyMeters: 0.0);
    }))));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Konumumu yenile'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Konum alınamadı'), findsOneWidget);
    expect(find.text('38.00000, 32.00000'), findsNothing);
    expect(find.text('Koordinatları kopyala'), findsNothing);
    await tester.tap(find.text('Tekrar dene'));
    await tester.pumpAndSettle();
    expect(find.text('38.00000, 32.00000'), findsOneWidget);
    expect(attempts, 3);
  });
}
