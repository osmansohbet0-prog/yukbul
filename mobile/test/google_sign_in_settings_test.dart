import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:yukvinc_mobile/main.dart';

void main() {
  test('reads the Android Google web client from the live public settings endpoint', () {
    expect(GoogleSignInSettings.endpoint.path, '/api/public-settings');
    const clientId = '123456789-valid_client.apps.googleusercontent.com';
    final response = http.Response.bytes(
      utf8.encode(jsonEncode({'settings': {'brand_name': 'YükVinç'}, 'google_client_id': clientId})),
      200,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
    expect(GoogleSignInSettings.clientIdFrom(response), clientId);
  });

  test('shows clear errors when the settings endpoint or OAuth client is missing', () {
    expect(
      () => GoogleSignInSettings.clientIdFrom(http.Response('{}', 404)),
      throwsA(isA<StateError>()),
    );
    expect(
      () => GoogleSignInSettings.clientIdFrom(http.Response('{"google_client_id":""}', 200)),
      throwsA(isA<StateError>()),
    );
    expect(
      () => GoogleSignInSettings.clientIdFrom(http.Response('not json', 200)),
      throwsFormatException,
    );
  });
}
