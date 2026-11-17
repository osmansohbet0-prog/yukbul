import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import 'app_update.dart';

/// Downloads only the exact APK advertised by an official YükVinç release.
/// The file is not offered to Android's package installer until its SHA-256
/// matches the separate .sha256 asset published by our signing workflow.
class VerifiedAndroidInstaller {
  static const maximumApkBytes = 110 * 1024 * 1024;

  static String parseChecksum(String text, String expectedFilename) {
    for (final line in const LineSplitter().convert(text)) {
      final match = RegExp(r'^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$')
          .firstMatch(line.trim());
      if (match != null && match.group(2) == expectedFilename) {
        return match.group(1)!.toLowerCase();
      }
    }
    throw const FormatException('Güncelleme doğrulama dosyası geçersiz.');
  }

  static Future<File> downloadVerified(
    http.Client client,
    AndroidUpdate update, {
    void Function(double?)? onProgress,
  }) async {
    final checksumResponse = await client
        .get(update.checksum, headers: {'Accept': 'text/plain'})
        .timeout(const Duration(seconds: 15));
    if (checksumResponse.statusCode != 200 ||
        checksumResponse.bodyBytes.length > 1024) {
      throw const FormatException('Güncelleme imza özeti alınamadı.');
    }
    final expectedHash = parseChecksum(
        utf8.decode(checksumResponse.bodyBytes), update.apkFilename);

    final stream = await client
        .send(http.Request('GET', update.download))
        .timeout(const Duration(seconds: 20));
    if (stream.statusCode != 200 ||
        (stream.contentLength != null &&
            (stream.contentLength! <= 0 ||
                stream.contentLength! > maximumApkBytes))) {
      throw const FormatException('APK dosyası indirilemedi.');
    }

    final folder = await getTemporaryDirectory();
    final file = File('${folder.path}/${update.apkFilename}');
    final sink = file.openWrite();
    var downloaded = 0;
    var lastReported = 0;
    try {
      await for (final bytes
          in stream.stream.timeout(const Duration(seconds: 45))) {
        downloaded += bytes.length;
        if (downloaded > maximumApkBytes) {
          throw const FormatException('APK dosyası beklenenden büyük.');
        }
        sink.add(bytes);
        if (downloaded - lastReported >= 256 * 1024) {
          lastReported = downloaded;
          final length = stream.contentLength;
          onProgress?.call(length != null && length > 0
              ? (downloaded / length).clamp(0.0, 1.0).toDouble()
              : null);
        }
      }
      await sink.flush();
      await sink.close();
      if (downloaded < 1024 * 1024) {
        throw const FormatException('APK dosyası eksik indirildi.');
      }
      final actualHash =
          (await sha256.bind(file.openRead()).first).toString().toLowerCase();
      if (actualHash != expectedHash) {
        throw const FormatException(
            'APK doğrulaması başarısız. Dosya kurulmayacak.');
      }
      onProgress?.call(1.0);
      return file;
    } catch (_) {
      await sink.close();
      if (await file.exists()) await file.delete();
      rethrow;
    }
  }

  /// Starts Android's system installer. Android always requests approval.
  /// Existing app data stays in place when package ID and signing key match.
  static Future<void> requestInstall(File verifiedApk) async {
    if (!Platform.isAndroid) {
      throw const FormatException('Güncelleme yalnızca Android içindir.');
    }
    final result = await OpenFilex.open(verifiedApk.path,
        type: 'application/vnd.android.package-archive');
    if (result.type != ResultType.done) {
      throw const FormatException(
        'Android yükleyici açılamadı. Ayarlar > Özel uygulama erişimi > '
        'Bilinmeyen uygulamaları yükle bölümünden YükVinç’e izin verip yeniden dene.',
      );
    }
  }
}
