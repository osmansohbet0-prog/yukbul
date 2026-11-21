part of 'main.dart';

typedef GeoPoint = ({double latitude, double longitude});

String regionKey(String value) => value.trim().toLowerCase()
    .replaceAll('\u0307', '').replaceAll('ı', 'i').replaceAll('ş', 's')
    .replaceAll('ğ', 'g').replaceAll('ü', 'u').replaceAll('ö', 'o').replaceAll('ç', 'c');

double _distanceKm(GeoPoint from, GeoPoint to) {
  const radians = math.pi / 180;
  final lat = (to.latitude - from.latitude) * radians / 2;
  final lon = (to.longitude - from.longitude) * radians / 2;
  final h = math.pow(math.sin(lat), 2) + math.cos(from.latitude * radians) *
      math.cos(to.latitude * radians) * math.pow(math.sin(lon), 2);
  return 12742 * math.asin(math.sqrt(h.clamp(0, 1)));
}

class DistrictIndex {
  DistrictIndex._(this.places);
  final Map<String, Map<String, GeoPoint>> places;
  static Future<DistrictIndex>? _loaded;
  static Future<DistrictIndex> load() => _loaded ??= _read().catchError((Object e, StackTrace st) {
    _loaded = null;
    Error.throwWithStackTrace(e, st);
  });

  static Future<DistrictIndex> _read() async {
    final rows = jsonDecode(await rootBundle.loadString('assets/turkey-locations.json')) as List;
    return DistrictIndex._({
      for (final province in rows.cast<Map>())
        province['name'] as String: {
          for (final district in (province['districts'] as List).cast<Map>())
            district['name'] as String: (
              latitude: (district['latitude'] as num).toDouble(),
              longitude: (district['longitude'] as num).toDouble(),
            ),
        },
    });
  }

  String? closestProvince(GeoPoint point) {
    String? candidate;
    var best = 80.0;
    for (final city in places.entries) {
      for (final center in city.value.values) {
        final km = _distanceKm(point, center);
        if (km < best) { best = km; candidate = city.key; }
      }
    }
    return candidate;
  }

  Map<String, Map<String, double>> within(GeoPoint point, int radiusKm) {
    final matches = <String, Map<String, double>>{};
    for (final city in places.entries) {
      final distances = <String, double>{};
      for (final district in city.value.entries) {
        final km = _distanceKm(point, district.value);
        if (km <= radiusKm) distances[regionKey(district.key)] = km;
      }
      if (distances.isNotEmpty) matches[city.key] = distances;
    }
    return matches;
  }
}

typedef ServiceHit = ({YukListing listing, double? km, bool districtCenter});
typedef ServiceResults = ({List<ServiceHit> hits, bool incomplete});

class ServiceSearch {
  ServiceSearch(this.api, this.index);
  final YukApi api;
  final DistrictIndex index;

  Future<ServiceResults> region(String city, String district, String category) async {
    final cityKey = regionKey(city);
    final districtKey = regionKey(district);
    final found = <String, ServiceHit>{};
    final seenCursors = <String>{};
    String? cursor;
    var incomplete = false;
    do {
      final args = {'city': city, 'limit': '50',
        if (district.isNotEmpty) 'q': district,
        if (category != 'all') 'category': category,
        'cursor': ?cursor,
      };
      final response = await api.client.get(Uri.parse('$baseUrl/api/listings').replace(queryParameters: args),
          headers: const {'Accept': 'application/json'}).timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) throw StateError('Bölgedeki ilanlar yüklenemedi.');
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (body is! Map || body['items'] is! List) throw const FormatException('İlan listesi geçersiz.');
      final rows = body['items'] as List;
      for (final row in rows.whereType<Map>()) {
        final item = YukListing.fromJson(Map<String, dynamic>.from(row));
        if (item.id.isEmpty || item.title.isEmpty || regionKey(item.city) != cityKey) continue;
        if (category != 'all' && item.category != category) continue;
        if (districtKey.isNotEmpty && regionKey(item.district) != districtKey) continue;
        found[item.id] = (listing: item, km: null, districtCenter: false);
      }
      final next = body['next_cursor'];
      cursor = next is String && next.isNotEmpty ? next : null;
      if ((cursor != null && (!seenCursors.add(cursor) || seenCursors.length >= 20)) ||
          (!body.containsKey('next_cursor') && rows.length >= 100)) {
        incomplete = true;
        break;
      }
    } while (cursor != null);
    final hits = found.values.toList()..sort((a,b) => b.listing.createdAt.compareTo(a.listing.createdAt));
    return (hits: hits, incomplete: incomplete);
  }

  Future<ServiceResults> nearby(GeoPoint point, int radiusKm, String category) async {
    final cities = index.within(point, radiusKm).entries.toList();
    final estimates = <String, ServiceHit>{};
    final pins = <String, ServiceHit>{};
    var incomplete = false;
    var successful = 0;
    Future<void> loadPins() async {
      try {
        final items = await api.nearby(point.latitude, point.longitude, radiusKm: radiusKm, category: category);
        for (final item in items) {
          final km = item.distanceKm?.toDouble();
          if (km == null || !km.isFinite || km < 0 || km > radiusKm) continue;
          if (category != 'all' && item.category != category) continue;
          pins[item.id] = (listing: item, km: km, districtCenter: false);
        }
        successful++;
      } catch (_) { incomplete = true; }
    }
    Future<void> loadCity(MapEntry<String, Map<String, double>> city) async {
      try {
        final batch = await region(city.key, '', category);
        for (final hit in batch.hits) {
          final km = city.value[regionKey(hit.listing.district)];
          if (km != null) estimates[hit.listing.id] = (listing: hit.listing, km: km, districtCenter: true);
        }
        successful++;
        if (batch.incomplete) incomplete = true;
      } catch (_) { incomplete = true; }
    }
    final verified = loadPins();
    for (var offset = 0; offset < cities.length; offset += 4) {
      await Future.wait(cities.skip(offset).take(4).map(loadCity));
    }
    await verified;
    if (successful == 0) throw StateError('İlanlar yüklenemedi. Bağlantını kontrol edip tekrar dene.');
    final hits = {...estimates, ...pins}.values.toList()..sort((a,b) {
      final order = a.km!.compareTo(b.km!);
      return order == 0 ? b.listing.createdAt.compareTo(a.listing.createdAt) : order;
    });
    return (hits: hits, incomplete: incomplete);
  }
}

class _LocationIssue implements Exception {
  const _LocationIssue(this.message, [this.settings]);
  final String message;
  final Future<bool> Function()? settings;
}

Future<GeoPoint> devicePoint() async {
  if (!await Geolocator.isLocationServiceEnabled()) {
    throw const _LocationIssue('Telefonda konum kapalı. İl seçerek arayabilirsin.', Geolocator.openLocationSettings);
  }
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
  if (permission == LocationPermission.deniedForever) {
    throw const _LocationIssue('Konum izni kapalı. İl seçebilir veya ayarlardan izin verebilirsin.', Geolocator.openAppSettings);
  }
  if (permission != LocationPermission.whileInUse && permission != LocationPermission.always) {
    throw const _LocationIssue('Konum izni verilmedi. İl seçerek arayabilirsin.');
  }
  final fix = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(
    accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 10)));
  return (latitude: fix.latitude, longitude: fix.longitude);
}
