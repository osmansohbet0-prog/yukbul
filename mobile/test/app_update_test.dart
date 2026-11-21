import 'package:flutter_test/flutter_test.dart';
import 'package:yukvinc_mobile/app_update.dart';

Map<String, dynamic> release(String version,
    {bool pre = false, bool draft = false, bool hasApk = true}) => {
  'tag_name': 'yukvinc-android-v$version',
  'prerelease': pre,
  'draft': draft,
  'body': 'Sürüm notları',
  'assets': [
    if (hasApk) {
      'name': 'YukVinc-Android-$version.apk',
      'size': 1200,
      'state': 'uploaded',
      'browser_download_url': 'https://example.org/ignored.apk',
    },
    if (hasApk) {
      'name': 'YukVinc-Android-$version.apk.sha256',
      'size': 92,
      'state': 'uploaded',
    },
  ],
};

void main() {
  test('selects newest compatible release and builds the trusted APK URL', () {
    final update = AndroidUpdates.newest([
      release('0.4.2'), release('0.11.0'), release('0.12.0', pre: true),
      release('0.12.1', draft: true), release('0.13.0', hasApk: false),
      {'tag_name': 'yukvinc-android-test-0.99.0'},
    ], '0.3.0');
    expect(update!.version, '0.11.0');
    expect(update.notes, 'Sürüm notları');
    expect(update.download.host, 'github.com');
    expect(update.download.path, endsWith('YukVinc-Android-0.11.0.apk'));
    expect(update.checksum.path,
        endsWith('YukVinc-Android-0.11.0.apk.sha256'));
  });

  test('uses the published asset digest, size and official API id', () {
    final entry = release('1.3.1');
    final asset = (entry['assets'] as List).first as Map;
    final hash = 'ab' * 32;
    asset['id'] = 478;
    asset['digest'] = 'sha256:$hash';
    final update = AndroidUpdates.newest([entry], '1.2.1')!;
    expect(update.sha256Hex, hash);
    expect(update.bytes, 1200);
    expect(update.assetDownload.toString(),
        'https://api.github.com/repos/osmansohbet0-prog/yukbul/releases/assets/478');
  });

  test('ignores releases missing the verification file', () {
    final result = AndroidUpdates.newest([{
      ...release('0.9.0'),
      'assets': [
        {'name': 'YukVinc-Android-0.9.0.apk', 'state': 'uploaded', 'size': 9999},
      ],
    }], '0.5.0');
    expect(result, isNull);
  });

  test('ignores installed and older releases', () {
    expect(AndroidUpdates.newest([release('0.3.0'), release('0.2.0')], '0.3.0'), isNull);
  });
}
