import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
  testWidgets('listing details keep contact in the app and remove WhatsApp sharing',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final api = YukApi(client: MockClient((request) async {
      expect(request.url.path, '/api/listings/listing_123');
      return http.Response(jsonEncode({
        'listing': {
          'id': 'listing_123',
          'title': 'Konya çekici hizmeti',
          'category': 'tow',
          'city': 'Konya',
          'district': 'Meram',
          'description': 'Şehir içi ve şehirler arası yol yardım.',
          'price_amount': 3200,
          'price_unit': 'başlangıç',
          'business_name': 'Meram Yol Yardım',
          'view_count': 12,
        },
        'photos': [],
      }), 200);
    }));
    await tester.pumpWidget(MaterialApp(
      home: ListingDetail(itemId: 'listing_123', client: api),
    ));
    await tester.pumpAndSettle();
    expect(find.text('İlan sahibine ulaş'), findsOneWidget);
    expect(find.text('WhatsApp’ta paylaş'), findsNothing);
    expect(find.text('Meram Yol Yardım'), findsOneWidget);
    expect(find.text('₺3.200'), findsOneWidget);
    expect(find.textContaining('12 görüntülenme'), findsOneWidget);
  });

}
