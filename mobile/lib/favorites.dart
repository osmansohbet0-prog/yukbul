import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FavoritesStore {
  static const _key = 'yukvinc.favorite_listing_ids';
  static final changes = ValueNotifier<int>(0);
  static Future<void> _pending = Future<void>.value();

  static Future<Set<String>> load() async {
    final preferences = await SharedPreferences.getInstance();
    return (preferences.getStringList(_key) ?? const <String>[]).toSet();
  }

  static Future<bool> contains(String id) async => (await load()).contains(id);

  static Future<Set<String>> toggle(String id) {
    final operation = _pending.then((_) async {
      final preferences = await SharedPreferences.getInstance();
      final ids = (preferences.getStringList(_key) ?? const <String>[]).toSet();
      if (!ids.add(id)) ids.remove(id);
      final saved = await preferences.setStringList(_key, ids.toList()..sort());
      if (!saved) throw StateError('Favori kaydedilemedi.');
      changes.value++;
      return ids;
    });
    _pending = operation.then<void>((_) {}, onError: (Object error) {});
    return operation;
  }
}

class RecentListingsStore {
  static const _key = 'yukvinc.recent_listing_ids';
  static Future<void> _pending = Future<void>.value();

  static Future<List<String>> load() async {
    final preferences = await SharedPreferences.getInstance();
    return preferences.getStringList(_key) ?? const <String>[];
  }

  static Future<void> record(String id) {
    final operation = _pending.then((_) async {
      final preferences = await SharedPreferences.getInstance();
      final ids = preferences.getStringList(_key) ?? <String>[];
      ids.remove(id);
      ids.insert(0, id);
      if (!await preferences.setStringList(_key, ids.take(12).toList())) {
        throw StateError('Görüntüleme geçmişi kaydedilemedi.');
      }
    });
    _pending = operation.catchError((Object error) {});
    return operation;
  }

  static Future<void> clear() {
    final operation = _pending.then((_) async {
      final preferences = await SharedPreferences.getInstance();
      if (!await preferences.remove(_key)) throw StateError('Geçmiş silinemedi.');
    });
    _pending = operation.catchError((Object error) {});
    return operation;
  }
}
