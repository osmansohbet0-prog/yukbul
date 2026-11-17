import 'package:flutter_test/flutter_test.dart';
import 'package:yukvinc_mobile/verified_android_installer.dart';

void main() {
  const digest =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  test('accepts a checksum only for the exact trusted APK filename', () {
    const checksum = '$digest  YukVinc-Android-0.6.0.apk\n';
    expect(
      VerifiedAndroidInstaller.parseChecksum(
          checksum, 'YukVinc-Android-0.6.0.apk'),
      digest,
    );
  });

  test('does not accept a checksum for another APK or malformed hash', () {
    expect(
      () => VerifiedAndroidInstaller.parseChecksum(
        '$digest  YukVinc-Android-0.6.0.apk\n',
        'YukVinc-Android-0.7.0.apk',
      ),
      throwsFormatException,
    );
    expect(
      () => VerifiedAndroidInstaller.parseChecksum(
        'malformed  YukVinc-Android-0.6.0.apk',
        'YukVinc-Android-0.6.0.apk',
      ),
      throwsFormatException,
    );
  });

  test('limits downloaded installer size to a single APK', () {
    expect(VerifiedAndroidInstaller.maximumApkBytes, 110 * 1024 * 1024);
  });
}
