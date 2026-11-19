import 'dart:async';
import 'dart:convert';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:yukvinc_mobile/main.dart';

void main() {
  test('Listing model parses approved listing', () {
    final listing = YukListing.fromJson({
      'id': 'listing_123',
      'title': 'Konya Kiralık Vinç',
      'category': 'crane',
      'city': 'Konya',
      'district': 'Meram',
      'description': 'Vinç hizmeti',
      'photo_url': '/api/listing-photo/abc',
      'distance_km': 4.5,
    });
    expect(listing.id, 'listing_123');
    expect(listing.title, 'Konya Kiralık Vinç');
    expect(listing.distanceKm, 4.5);
  });

  test('Listing API searches using existing public contract', () async {
    final client = MockClient((request) async {
      expect(request.method, 'GET');
      expect(request.url.path, '/api/listings');
      expect(request.url.queryParameters['category'], 'tow');
      expect(request.url.queryParameters['q'], 'İstanbul');
      return http.Response.bytes(utf8.encode(jsonEncode({'items': [
        {'id': 'abc', 'title': 'İstanbul Yol Yardım', 'city': 'İstanbul',
          'district': 'Pendik', 'category': 'tow', 'description': 'Oto kurtarıcı'}
      ]})), 200, headers: {'content-type': 'application/json; charset=utf-8'});
    });
    final values = await YukApi(client: client)
        .listings(category: 'tow', query: 'İstanbul');
    expect(values.length, 1);
    expect(values.single.title, 'İstanbul Yol Yardım');
  });

  test('Nearby API sends location and selected category on explicit action', () async {
    final client = MockClient((request) async {
      expect(request.url.path, '/api/ai/nearby');
      expect(request.headers['Origin'], baseUrl);
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      expect(body['latitude'], 41.0);
      expect(body['longitude'], 29.0);
      expect(body['radius_km'], 25);
      expect(body['category'], 'tow');
      return http.Response('{"items":[]}', 200);
    });
    expect(await YukApi(client: client).nearby(
      41.0, 29.0, radiusKm: 25, category: 'tow',
    ), isEmpty);
  });

  test('Manual search sends the city and district query on the public API', () async {
    final client = MockClient((request) async {
      expect(request.url.queryParameters['city'], 'Konya');
      expect(request.url.queryParameters['q'], 'Meram');
      expect(request.url.queryParameters['category'], 'tow');
      return http.Response('{"items":[]}', 200);
    });
    expect(await YukApi(client: client).listings(
      city: 'Konya', query: 'Meram', category: 'tow',
    ), isEmpty);
  });

  test('API rejects error responses', () async {
    final client = MockClient((_) async => http.Response('{"error":"fail"}', 503));
    await expectLater(YukApi(client: client).listings(), throwsException);
  });

  test('Home and listings tabs share the initial request', () async {
    var calls = 0;
    final client = MockClient((_) async {
      calls++;
      return http.Response('{"items":[]}', 200);
    });
    final api = YukApi(client: client);
    await Future.wait([api.initialListings(), api.initialListings()]);
    expect(calls, 1);
    await api.listings(query: 'Konya');
    expect(calls, 2);
  });

  testWidgets('Legacy account path opens the native account screen',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Builder(builder: (context) => Scaffold(
        body: Center(child: TextButton(
          onPressed: () { unawaited(openSite(context, '/hesabim/')); },
          child: const Text('Hesabım'),
        )),
      )),
    ));
    await tester.tap(find.text('Hesabım'));
    await tester.pumpAndSettle();
    expect(find.text('YükVinç hesabınla uygulamadan devam et.'), findsOneWidget);
  });

  testWidgets('Account exposes native listing entry points and work requests',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: Account()),
    ));
    expect(find.text('Google ile devam et'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('İlanlarım'), 150);
    expect(find.text('İlanlarım'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('İlan ver'), 150);
    expect(find.text('İlan ver'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('İş talepleri'), 150);
    expect(find.text('İş talepleri'), findsOneWidget);
  });
}
