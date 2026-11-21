import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:yukvinc_mobile/main.dart';

http.Response ok(Object value) => http.Response.bytes(utf8.encode(jsonEncode(value)), 200);
Map<String, String> row(String id, String district, String category, {String city = 'Konya'}) =>
    {'id': id, 'title': 'Hizmet $id', 'city': city, 'district': district, 'category': category};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late DistrictIndex index;
  setUpAll(() async { index = await DistrictIndex.load(); });
  setUp(() { SharedPreferences.setMockInitialValues({}); });

  test('Meram search includes Selçuklu tow listings without a GPS pin and excludes unrelated items', () async {
    final api = YukApi(client: MockClient((request) async {
      if (request.method == 'POST') return ok({'items': []});
      if (request.url.queryParameters['city'] != 'Konya') return ok({'items': []});
      return ok({'items': [row('tow1','Selçuklu','tow'), row('tow2','SELCUKLU','tow'),
        row('tire','Karatay','mobile_tire'), row('other','Merkez','tow',city:'Ankara')]});
    }));
    final search = ServiceSearch(api, index);
    final result = await search.nearby(index.places['Konya']!['Meram']!,100,'tow');
    expect(result.hits.map((v) => v.listing.id), unorderedEquals(['tow1','tow2']));
    expect(result.hits.every((v) => v.districtCenter && v.km! > 0), isTrue);
    expect((await search.nearby(index.places['Konya']!['Meram']!,5,'tow')).hits,isEmpty);
    expect(index.places.length,81);
    expect(index.places.values.fold<int>(0,(count, entries)=>count + entries.length),973);
  });

  test('publication without category-aware GPS still uses listing areas and prefers measured distances', () async {
    final calls = <String>[];
    final api = YukApi(client: MockClient((request) async {
      if (request.method == 'POST') {
        final body = jsonDecode(request.body) as Map;
        calls.add(body.containsKey('category') ? 'new' : 'legacy');
        if (body.containsKey('category')) return http.Response('{}',400);
        return ok({'items': [
          {...row('both','Selçuklu','tow'),'distance_km': 2.1},
          {...row('foreign','Karatay','mobile_tire'),'distance_km': 0.5},
        ]});
      }
      if (request.url.queryParameters['city'] != 'Konya') return ok({'items': []});
      return ok({'items': [row('both','Selçuklu','tow'),row('approx','Selçuklu','tow')]});
    }));
    final result = await ServiceSearch(api,index).nearby(index.places['Konya']!['Meram']!,100,'tow');
    expect(result.hits.map((v)=>v.listing.id),['both','approx']);
    expect(result.hits.first.districtCenter,isFalse);
    expect(result.hits.first.km,2.1);
    expect(calls,['new','legacy']);
  });

  test('manual search keeps city, district and category on subsequent pages', () async {
    final api = YukApi(client: MockClient((r) async {
      expect(r.url.queryParameters['city'],'Konya');
      expect(r.url.queryParameters['q'],'Selçuklu');
      if (r.url.queryParameters['cursor'] == null) return ok({'items':[row('first','Selçuklu','tow')],'next_cursor':'second'});
      return ok({'items':[row('second','SELCUKLU','tow'),row('first','Selçuklu','tow'),
        row('elsewhere','Meram','tow')], 'next_cursor':null});
    }));
    final result = await ServiceSearch(api,index).region('Konya','Selçuklu','tow');
    expect(result.hits.map((r)=>r.listing.id), unorderedEquals(['first','second']));
    expect(result.hits.every((r)=>r.km==null),isTrue);
  });

  testWidgets('roadside can switch services and still search manually when GPS is unavailable', (tester) async {
    final api = YukApi(client: MockClient((r) async {
      final category = r.url.queryParameters['category']!;
      return ok({'items':[row(category,'Selçuklu',category)]});
    }));
    Future<void> waitForText(Finder target) async {
      // Platform preferences and the cached asset future can complete on the real event loop.
      for (var frame = 0; frame < 80 && target.evaluate().isEmpty; frame++) {
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 10)));
        await tester.pump(const Duration(milliseconds: 25));
      }
      expect(target, findsOneWidget);
    }
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: Nearby(roadside:true, client:api,
      locate: () async => throw StateError('GPS unavailable')))));
    await waitForText(find.text('Hizmet tow'));
    await tester.tap(find.text('Konumumdan ara'));
    await waitForText(find.textContaining('Konum alınamadı'));
    await tester.tap(find.text('Mobil lastikçi'));
    await waitForText(find.text('Hizmet mobile_tire'));
    expect(find.text('Hizmet tow'),findsNothing);
  });

  test('phone lookup reads only the public call action of the matching listing', () async {
    final item=YukListing.fromJson(row('konya_01','Selçuklu','tow'));
    final api=YukApi(client:MockClient((r) async {
      expect(r.url.host,'yukvinc.com.tr');
      if (r.url.path=='/ilan/konya_01/') return http.Response('',301,headers:{'location':'/ilan/konya_01/test/'});
      return http.Response('<link rel="canonical" href="https://yukvinc.com.tr/ilan/konya_01/test/">'
        '<a href="tel:03120000000">Merkez</a><a data-metric="phone" href="tel:05550000001">Ara</a>',200);
    }));
    expect(await publicServiceNumber(api,item),'905550000001');
    final unrelated=YukApi(client:MockClient((r) async => http.Response('',302,headers:{'location':'https://example.org/'})));
    await expectLater(publicServiceNumber(unrelated,item), throwsStateError);
  });
}
