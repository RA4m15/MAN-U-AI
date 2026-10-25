import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/core/config/env_config.dart';

void main() {
  group('EnvConfig Tests', () {
    tearDown(() {
      EnvConfig.clearRuntimeOverride();
    });

    test('defaultBaseUrl uses verified deployed HTTPS URL for physical devices and release', () {
      expect(EnvConfig.productionApiBaseUrl, equals('https://man-u-ai.onrender.com/api/v1'));
      // In the absence of --dart-define, apiBaseUrl should point to production, never 10.0.2.2 or 127.0.0.1
      expect(EnvConfig.apiBaseUrl, equals('https://man-u-ai.onrender.com/api/v1'));
      expect(EnvConfig.apiBaseUrl, isNot(contains('10.0.2.2')));
      expect(EnvConfig.apiBaseUrl, isNot(contains('127.0.0.1')));
    });

    test('normalizeApiBaseUrl appends /api/v1 when missing', () {
      expect(
        EnvConfig.normalizeApiBaseUrl('https://man-u-ai.onrender.com'),
        equals('https://man-u-ai.onrender.com/api/v1'),
      );
      expect(
        EnvConfig.normalizeApiBaseUrl('https://man-u-ai.onrender.com/'),
        equals('https://man-u-ai.onrender.com/api/v1'),
      );
    });

    test('normalizeApiBaseUrl preserves existing /api/v1 without duplicate prefixes', () {
      expect(
        EnvConfig.normalizeApiBaseUrl('https://man-u-ai.onrender.com/api/v1'),
        equals('https://man-u-ai.onrender.com/api/v1'),
      );
      expect(
        EnvConfig.normalizeApiBaseUrl('https://man-u-ai.onrender.com/api/v1/'),
        equals('https://man-u-ai.onrender.com/api/v1'),
      );
    });

    test('normalizeApiBaseUrl handles /api prefix by appending /v1', () {
      expect(
        EnvConfig.normalizeApiBaseUrl('https://man-u-ai.onrender.com/api'),
        equals('https://man-u-ai.onrender.com/api/v1'),
      );
      expect(
        EnvConfig.normalizeApiBaseUrl('https://man-u-ai.onrender.com/api/'),
        equals('https://man-u-ai.onrender.com/api/v1'),
      );
    });

    test('normalizeApiBaseUrl handles physical device LAN IPs with port', () {
      expect(
        EnvConfig.normalizeApiBaseUrl('http://192.168.1.50:4000'),
        equals('http://192.168.1.50:4000/api/v1'),
      );
      expect(
        EnvConfig.normalizeApiBaseUrl('http://192.168.1.50:4000/api/v1'),
        equals('http://192.168.1.50:4000/api/v1'),
      );
    });

    test('validateBaseUrl enforces security constraints in release builds', () {
      // Loopback addresses rejected in release
      expect(
        EnvConfig.validateBaseUrl('http://127.0.0.1:4000/api/v1', isRelease: true),
        contains('Production builds cannot target local loopback'),
      );
      expect(
        EnvConfig.validateBaseUrl('http://10.0.2.2:4000/api/v1', isRelease: true),
        contains('Production builds cannot target local loopback'),
      );
      expect(
        EnvConfig.validateBaseUrl('http://localhost:4000/api/v1', isRelease: true),
        contains('Production builds cannot target local loopback'),
      );

      // Cleartext HTTP rejected in release
      expect(
        EnvConfig.validateBaseUrl('http://api.plant.io/api/v1', isRelease: true),
        contains('Production builds require secure TLS'),
      );

      // Valid HTTPS allowed in release
      expect(
        EnvConfig.validateBaseUrl('https://man-u-ai.onrender.com/api/v1', isRelease: true),
        isNull,
      );
    });

    test('validateBaseUrl permits local HTTP development in debug builds', () {
      expect(
        EnvConfig.validateBaseUrl('http://10.0.2.2:4000/api/v1', isRelease: false),
        isNull,
      );
      expect(
        EnvConfig.validateBaseUrl('http://192.168.1.42:4000/api/v1', isRelease: false),
        isNull,
      );
    });

    test('runtime override updates apiBaseUrl and clearRuntimeOverride restores default', () {
      EnvConfig.setRuntimeOverride('http://192.168.0.10:4000');
      expect(EnvConfig.apiBaseUrl, equals('http://192.168.0.10:4000/api/v1'));

      EnvConfig.clearRuntimeOverride();
      expect(EnvConfig.apiBaseUrl, equals('https://man-u-ai.onrender.com/api/v1'));
    });

    test('timeouts accommodate Render cold-starts and RAG generation', () {
      expect(EnvConfig.connectTimeout.inSeconds, greaterThanOrEqualTo(30));
      expect(EnvConfig.receiveTimeout.inSeconds, greaterThanOrEqualTo(45));
      expect(EnvConfig.sendTimeout.inSeconds, greaterThanOrEqualTo(30));
    });
  });
}
