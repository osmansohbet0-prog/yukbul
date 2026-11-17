import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:yukvinc_mobile/main.dart';

void main() {
  test('detail loads current listing and all gallery photos', () async {
    final api = YukApi(client: MockClient((request) async {
      expect(request.url.path, '/api/listings/listing_123');
      return http.Response( jsonEncode({
        'listing': {'id': 'listing_123', 'title': 'Konya crane',
          'description': 'Current description'},
        'photos': ['/api/listing-photo/a', '/api/listing-photo/b',
          'https://untrusted.example/photo', '/api/listing-photo/../bad'],
      }), 200);
    }));
    final result = await api.detail('listing_123');
    expect(result.listing.description, 'Current description');
    expect(result.photos, ['/api/listing-photo/a', '/api/listing-photo/b']);
  });

  test('removed listings are not displayed from stale cards', () async {
    final api = YukApi(client: MockClient((_) async => http.Response('{}', 404)));
    await expectLater(api.detail('listing_123'), throwsStateError);
  });

  test('mismatched listing responses are rejected', () async {
    final api = YukApi(client: MockClient((_) async => http.Response(
      '{"listing":{"id":"other","title":"Wrong"},"photos":[]}', 200)));
    await expectLater(api.detail('listing_123'), throwsFormatException);
  });
}
