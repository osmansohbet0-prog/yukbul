import 'package:shared_preferences/shared_preferences.dart';

class FavoritesStore {
  static const _key = 'yukvinc.favorite_listing_ids';

  static Future<Set<String>> load() async {
    final preferences = await SharedPreferences.getInstance();
    return (preferences.getStringList(_key) ?? const <String>[]).toSet();
  }

  static Future<bool> contains(String id) async => (await load()).contains(id);

  static Future<Set<String>> toggle(String id) async {
    final preferences = await SharedPreferences.getInstance();
    final ids = (preferences.getStringList(_key) ?? const <String>[]).toSet();
    if (!ids.add(id)) ids.remove(id);
    await preferences.setStringList(_key, ids.toList()..sort());
    return ids;
  }
}
