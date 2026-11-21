import 'dart:convert';

import 'package:http/http.dart' as http;

const installedVersion = String.fromEnvironment('YV_VERSION', defaultValue: '1.3.0');

class AndroidUpdate {
  const AndroidUpdate(this.version, this.notes);
  final String version;
  final String notes;

  String get apkFilename => 'YukVinc-Android-$version.apk';

  Uri get download => Uri.https('github.com',
      '/osmansohbet0-prog/yukbul/releases/download/yukvinc-android-v$version/$apkFilename');

  Uri get checksum => Uri.https('github.com',
      '/osmansohbet0-prog/yukbul/releases/download/yukvinc-android-v$version/$apkFilename.sha256');
}

class AndroidUpdates {
  static final _version = RegExp(r'^([0-9]{1,5})\.([0-9]{1,5})\.([0-9]{1,5})$');
  static const _prefix = 'yukvinc-android-v';

  static int _order(String version) {
    final value = _version.firstMatch(version);
    if (value == null) return -1;
    return (int.parse(value[1]!) * 100000 + int.parse(value[2]!)) * 100000 +
        int.parse(value[3]!);
  }

  static Future<AndroidUpdate?> check(http.Client client) async {
    final uri = Uri.https('api.github.com',
        '/repos/osmansohbet0-prog/yukbul/releases', {'per_page': '30'});
    final response = await client.get(uri, headers: {
      'Accept': 'application/vnd.github+json',
    }).timeout(const Duration(seconds: 5));
    if (response.statusCode != 200) throw const FormatException('Sürüm bilgisi alınamadı.');
    return newest(jsonDecode(utf8.decode(response.bodyBytes)), installedVersion);
  }

  static AndroidUpdate? newest(Object? releases, String current) {
    if (releases is! List) throw const FormatException('Sürüm yanıtı geçersiz.');
    var best = _order(current);
    if (best < 0) return null;
    AndroidUpdate? result;
    for (final entry in releases.whereType<Map<String, dynamic>>()) {
      final tag = entry['tag_name'];
      final assets = entry['assets'];
      if (entry['draft'] != false || entry['prerelease'] != false ||
          tag is! String || !tag.startsWith(_prefix) || assets is! List) {
        continue;
      }
      final version = tag.substring(_prefix.length);
      final code = _order(version);
      if (code <= best) continue;
      final apkName = 'YukVinc-Android-$version.apk';
      if (!assets.whereType<Map<String, dynamic>>().any((asset) =>
          asset['name'] == apkName && asset['state'] == 'uploaded' &&
          asset['size'] is int && (asset['size'] as int) > 0) ||
          !assets.whereType<Map<String, dynamic>>().any((asset) =>
          asset['name'] == '$apkName.sha256' &&
          asset['state'] == 'uploaded' &&
          asset['size'] is int && (asset['size'] as int) > 0)) {
        continue;
      }
      final notes = entry['body'];
      result = AndroidUpdate(version, notes is String && notes.trim().isNotEmpty
          ? String.fromCharCodes(notes.trim().runes.take(1500))
          : 'Yeni YükVinç sürümü indirilmeye hazır.');
      best = code;
    }
    return result;
  }
}
