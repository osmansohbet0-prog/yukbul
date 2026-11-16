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
  });

  test('ignores installed and older releases', () {
    expect(AndroidUpdates.newest([release('0.3.0'), release('0.2.0')], '0.3.0'), isNull);
  });
}
