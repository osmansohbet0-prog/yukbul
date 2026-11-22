import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FavoritesStore {
  static const _key = 'yukvinc.favorite_listing_ids';
  static final changes = ValueNotifier<int>(0);
  static Future<void> _pending = Future<void>.value();

  static Future<List<String>> orderedLoad() async {
    final preferences = await SharedPreferences.getInstance();
    return (preferences.getStringList(_key) ?? const <String>[]).toSet().toList();
  }

  static Future<Set<String>> load() async => (await orderedLoad()).toSet();

  static Future<bool> contains(String id) async => (await load()).contains(id);

  static Future<Set<String>> toggle(String id) {
    final operation = _pending.then((_) async {
      final preferences = await SharedPreferences.getInstance();
      final ids = (preferences.getStringList(_key) ?? const <String>[]).toSet().toList();
      if (ids.remove(id)) {
        // Removing a favorite keeps the remaining order intact.
      } else {
        ids.insert(0, id);
      }
      if (!await preferences.setStringList(_key, ids)) {
        throw StateError('Favori kaydedilemedi.');
      }
      changes.value++;
      return ids.toSet();
    });
    _pending = operation.then<void>((_) {}, onError: (Object error) {});
    return operation;
  }

  static Future<void> retain(Set<String> validIds) {
    final operation = _pending.then((_) async {
      final preferences = await SharedPreferences.getInstance();
      final current = preferences.getStringList(_key) ?? const <String>[];
      final retained = current.where(validIds.contains).toSet().toList();
      if (retained.length == current.length) return;
      if (!await preferences.setStringList(_key, retained)) {
        throw StateError('Favoriler güncellenemedi.');
      }
      changes.value++;
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
    return (preferences.getStringList(_key) ?? const <String>[]).toSet().toList();
  }

  static Future<void> record(String id) {
    if (id.isEmpty) return Future<void>.value();
    final operation = _pending.then((_) async {
      final preferences = await SharedPreferences.getInstance();
      final ids = (preferences.getStringList(_key) ?? const <String>[]).toSet().toList();
      ids.remove(id);
      ids.insert(0, id);
      if (!await preferences.setStringList(_key, ids.take(12).toList())) {
        throw StateError('Görüntüleme geçmişi kaydedilemedi.');
      }
    });
    _pending = operation.then<void>((_) {}, onError: (Object error) {});
    return operation;
  }

  static Future<void> retain(Set<String> validIds) {
    final operation = _pending.then((_) async {
      final preferences = await SharedPreferences.getInstance();
      final current = preferences.getStringList(_key) ?? const <String>[];
      final retained = current.where(validIds.contains).toSet().toList();
      if (retained.length == current.length) return;
      if (!await preferences.setStringList(_key, retained)) {
        throw StateError('Görüntüleme geçmişi güncellenemedi.');
      }
    });
    _pending = operation.then<void>((_) {}, onError: (Object error) {});
    return operation;
  }

  static Future<void> clear() {
    final operation = _pending.then((_) async {
      final preferences = await SharedPreferences.getInstance();
      if (!await preferences.setStringList(_key, <String>[])) {
        throw StateError('Geçmiş silinemedi.');
      }
    });
    _pending = operation.then<void>((_) {}, onError: (Object error) {});
    return operation;
  }
}
