import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:yukvinc_mobile/appearance.dart';
import 'package:yukvinc_mobile/favorites.dart';
import 'package:yukvinc_mobile/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    AppAppearance.mode.value = ThemeMode.system;
  });

  test('concurrent favorites writes retain both selections', () async {
    await Future.wait([FavoritesStore.toggle('listing_a'), FavoritesStore.toggle('listing_b')]);
    expect(await FavoritesStore.load(), {'listing_a', 'listing_b'});
  });

  test('recent history is ordered, unique, bounded and clearable', () async {
    await Future.wait(List.generate(15, (i) => RecentListingsStore.record('id_$i')));
    await RecentListingsStore.record('id_5');
    final ids = await RecentListingsStore.load();
    expect(ids.length, 12);
    expect(ids.first, 'id_5');
    expect(ids.toSet().length, 12);
    expect(ids, isNot(contains('id_0')));
    await RecentListingsStore.clear();
    expect(await RecentListingsStore.load(), isEmpty);
  });

  test('appearance restores saved preference', () async {
    await AppAppearance.save(ThemeMode.dark);
    AppAppearance.mode.value = ThemeMode.system;
    await AppAppearance.load();
    expect(AppAppearance.mode.value, ThemeMode.dark);
  });

  for (final brightness in Brightness.values) {
    testWidgets('listing card supports large text in ${brightness.name}', (tester) async {
      await tester.pumpWidget(MaterialApp(
        theme: AppAppearance.theme(brightness),
        home: Scaffold(body: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2)),
          child: const SingleChildScrollView(child: SizedBox(width: 320,
            child: ListingCard(item: YukListing(
              id: 'listing_a', title: 'Konya Meram uzun başlıklı kiralık vinç',
              city: 'Konya', district: 'Meram', category: 'crane', description: '',
            )),
          )),
        )),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.runAsync(() async {
        await tester.tap(find.byTooltip('Favorilere ekle'));
        await Future<void>.delayed(Duration.zero);
        expect(await FavoritesStore.contains('listing_a'), isTrue);
      });
      await tester.pumpAndSettle();
      expect(find.byTooltip('Favorilerden kaldır'), findsOneWidget);
    });
  }
}
