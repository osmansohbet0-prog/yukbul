import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:yukvinc_mobile/app_update.dart';
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

  test('uses the official asset API after a failed download, verifies and reuses the cached APK', () async {
    final dir = await Directory.systemTemp.createTemp('yv-update-');
    addTearDown(() => dir.delete(recursive: true));
    final bytes = Uint8List(1024 * 1024)..[0] = 19;
    final update = AndroidUpdate('1.2.3', '', sha256Hex: sha256.convert(bytes).toString(),
        bytes: bytes.length, assetId: 9);
    final hosts = <String>[];
    final client = MockClient((request) async {
      hosts.add(request.url.host);
      if (request.url == update.download) return http.Response('expired', 503);
      expect(request.url, update.assetDownload);
      expect(request.headers['accept'], 'application/octet-stream');
      return http.Response.bytes(bytes, 200);
    });
    final file = await VerifiedAndroidInstaller.downloadVerified(client, update, directory: () async => dir);
    expect(await file.length(), bytes.length);
    expect(hosts, ['github.com', 'api.github.com']);
    await VerifiedAndroidInstaller.downloadVerified(client, update, directory: () async => dir);
    expect(hosts.length, 2);
    // A modified local file must be downloaded and verified again.
    await file.writeAsBytes(Uint8List(bytes.length));
    await VerifiedAndroidInstaller.downloadVerified(client, update, directory: () async => dir);
    expect(hosts.length, 4);
  });

  test('legacy checksum still rejects corrupted APK and removes the partial download', () async {
    final dir = await Directory.systemTemp.createTemp('yv-update-');
    addTearDown(() => dir.delete(recursive: true));
    const update = AndroidUpdate('1.3.0', '');
    final client = MockClient((r) async => r.url == update.checksum
        ? http.Response.bytes(utf8.encode('$digest  ${update.apkFilename}\n'), 200)
        : http.Response.bytes(Uint8List(1024 * 1024), 200));
    await expectLater(VerifiedAndroidInstaller.downloadVerified(client, update, directory: () async => dir),
        throwsFormatException);
    expect(await dir.list().isEmpty, isTrue);
  });
}