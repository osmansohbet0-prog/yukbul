import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:yukvinc_mobile/favorites.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('favorite ids persist across store reads', () async {
    expect(await FavoritesStore.toggle('listing_123'), {'listing_123'});
    expect(await FavoritesStore.load(), {'listing_123'});
    expect(await FavoritesStore.contains('listing_123'), isTrue);
  });

  test('toggling a saved listing removes it', () async {
    await FavoritesStore.toggle('listing_123');
    expect(await FavoritesStore.toggle('listing_123'), isEmpty);
    expect(await FavoritesStore.load(), isEmpty);
  });
}
