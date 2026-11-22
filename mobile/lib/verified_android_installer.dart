import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import 'app_update.dart';

class _DownloadFailure implements Exception {
  const _DownloadFailure(this.message);
  final String message;
}

class VerifiedAndroidInstaller {
  static const maximumApkBytes = 110 * 1024 * 1024;
  static const _channel = MethodChannel('tr.com.yukvinc/updates');

  static String parseChecksum(String text, String expectedFilename) {
    for (final line in const LineSplitter().convert(text)) {
      final match = RegExp(r'^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$').firstMatch(line.trim());
      if (match != null && match.group(2) == expectedFilename) return match.group(1)!.toLowerCase();
    }
    throw const FormatException('Güncelleme doğrulama dosyası geçersiz.');
  }

  static Future<Directory> _directory() async {
    final path = await _channel.invokeMethod<String>('directory');
    if (path == null || path.isEmpty) throw const FormatException('Güncelleme klasörü açılamadı.');
    return Directory(path);
  }

  static Future<File> downloadVerified(http.Client client, AndroidUpdate update, {
    void Function(double?)? onProgress,
    Future<Directory> Function() directory = _directory,
  }) async {
    final expectedSize = update.bytes;
    if (expectedSize != null && (expectedSize < 1024 * 1024 || expectedSize > maximumApkBytes)) {
      throw const FormatException('Yayımlanan APK boyutu geçersiz.');
    }
    final expected = update.sha256Hex ?? await _legacyHash(client, update);
    final folder = await directory();
    final file = File('${folder.path}/${update.apkFilename}');
    final cachedSize = await file.exists() ? await file.length() : 0;
    if (cachedSize >= 1024 * 1024 && cachedSize <= maximumApkBytes &&
        (expectedSize == null || expectedSize == cachedSize) && await _hash(file) == expected) {
      onProgress?.call(1.0);
      return file;
    }

    final partial = await File('${file.path}.part').create();
    final fallback = update.assetDownload;
    final candidates = [update.download, ?fallback];
    try {
      for (final url in candidates) {
        try {
          onProgress?.call(0.0);
          await _transfer(client, url, partial, expectedSize, onProgress);
          break;
        } on _DownloadFailure catch (e) {
          if (url == candidates.last) throw FormatException(e.message);
        } on TimeoutException {
          if (url == candidates.last) rethrow;
        } on http.ClientException {
          if (url == candidates.last) rethrow;
        } on IOException catch (e) {
          if (e is FileSystemException || url == candidates.last) rethrow;
        }
      }
      if (await _hash(partial) != expected) {
        throw const FormatException('APK yayımlanan SHA-256 değeriyle eşleşmedi. Yeniden indir.');
      }
      final verified = await partial.rename(file.path);
      // Keep space for the next update. Clean up only files owned by this updater.
      try {
        final oldApk = RegExp(r'^YukVinc-Android-\d+\.\d+\.\d+\.apk$');
        await for (final entry in folder.list(followLinks: false)) {
          if (entry is File && entry.path != verified.path && oldApk.hasMatch(entry.uri.pathSegments.last)) {
            await entry.delete();
          }
        }
      } on FileSystemException { /* Cleanup can be retried after a later download. */ }
      onProgress?.call(1.0);
      return verified;
    } finally {
      if (await partial.exists()) await partial.delete();
    }
  }

  static Future<String> _legacyHash(http.Client client, AndroidUpdate update) async {
    final r = await client.get(update.checksum, headers: {'Accept': 'application/octet-stream'})
        .timeout(const Duration(seconds: 30));
    if (r.statusCode != 200 || r.bodyBytes.length > 1024) {
      throw FormatException('Güncellemenin doğrulama dosyası alınamadı (HTTP ${r.statusCode}).');
    }
    return parseChecksum(utf8.decode(r.bodyBytes), update.apkFilename);
  }

  static Future<String> _hash(File file) async => (await sha256.bind(file.openRead()).first).toString();

  static Future<void> _transfer(http.Client client, Uri url, File partial, int? expectedSize,
      void Function(double?)? progress) async {
    final request = http.Request('GET', url)..headers['Accept'] = 'application/octet-stream';
    final res = await client.send(request).timeout(const Duration(seconds: 30));
    if (res.statusCode != 200) {
      await res.stream.listen((_) {}).cancel();
      throw _DownloadFailure('APK sunucusu HTTP ${res.statusCode} döndürdü. Biraz sonra tekrar dene.');
    }
    final length = expectedSize ?? res.contentLength;
    if (res.contentLength != null && (res.contentLength! > maximumApkBytes ||
        (expectedSize != null && res.contentLength != expectedSize))) {
      await res.stream.listen((_) {}).cancel();
      throw const _DownloadFailure('İndirme sunucusu APK için farklı bir boyut bildirdi.');
    }
    var received = 0, reported = 0;
    final sink = partial.openWrite();
    try {
      await sink.addStream(res.stream.timeout(const Duration(seconds: 60)).map((chunk) {
        received += chunk.length;
        if (received > maximumApkBytes || (length != null && received > length)) {
          throw const _DownloadFailure('APK dosyasının boyutu yayımlanan boyutu aştı.');
        }
        if (received - reported >= 256 * 1024) {
          reported = received;
          progress?.call(length == null || length == 0 ? null : received / length);
        }
        return chunk;
      }));
    } finally {
      await sink.close();
    }
    if (received < 1024 * 1024 || (length != null && received != length)) {
      throw const _DownloadFailure('APK indirmesi yarıda kesildi. Tekrar dene.');
    }
  }

  static Future<bool> mayInstall() async => await _channel.invokeMethod<bool>('canInstall') == true;
  static Future<bool> openSettings() async => await _channel.invokeMethod<bool>('settings') == true;
  static Future<void> requestInstall(File apk) => _channel.invokeMethod<void>('install', apk.uri.pathSegments.last);

  static String describe(Object error, {required bool download, required bool installer}) {
    if (error is FormatException) return error.message;
    if (error is FileSystemException || (error is PlatformException && error.code == 'storage')) {
      return 'Güncelleme dosyası telefona yazılamadı. Depolama alanını kontrol et.';
    }
    if (error is PlatformException) {
      if (error.code == 'permission') return 'Android, YükVinç için yükleme iznini kapalı gösteriyor.';
      if (error.code == 'missing') return 'İndirilmiş APK bulunamadı. Güncellemeyi tekrar başlat.';
      if (error.code == 'blocked') return 'Android cihaz ilkesi kurulum işlemini engelledi.';
      return error.message ?? 'Android kurulum ekranı açılamadı.';
    }
    if (installer) return 'Doğrulanmış APK için Android kurulum ekranı açılamadı. Güncellemeyi tekrar başlat.';
    final step = download ? 'APK indirmesi' : 'Sürüm kontrolü';
    if (error is TimeoutException) return '$step zaman aşımına uğradı. Tekrar dene.';
    if (error is http.ClientException || error is IOException) return '$step sırasında güncelleme sunucusuna ulaşılamadı.';
    return '$step tamamlanamadı. Tekrar dene.';
  }
}
