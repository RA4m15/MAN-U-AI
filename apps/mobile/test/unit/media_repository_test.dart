import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:manuai_mobile/core/config/env_config.dart';
import 'package:manuai_mobile/features/media/repositories/media_repository.dart';

void main() {
  group('MediaRepository Client URL and Multipart Payload Verification Tests', () {
    late Dio dio;
    late MediaRepository repository;

    setUp(() {
      dio = Dio(BaseOptions(
        baseUrl: EnvConfig.apiBaseUrl,
      ));
      repository = MediaRepository(dio);
    });

    test('1. Verified Dio URI composition resolves exactly to /api/v1/media/ingest', () {
      final requestOptions = RequestOptions(
        baseUrl: 'https://man-u-ai.onrender.com/api/v1',
        path: '/media/ingest',
      );

      // Verify that leading slash does not strip /api/v1 in Dio URL composition
      expect(
        requestOptions.uri.toString(),
        equals('https://man-u-ai.onrender.com/api/v1/media/ingest'),
      );
    });

    test('2. IngestMedia constructs correct multipart fields, headers and data types', () async {
      RequestOptions? capturedOptions;

      dio.httpClientAdapter = HttpClientAdapter();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            capturedOptions = options;
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 201,
                data: {
                  'success': true,
                  'data': {
                    'id': 'med-unit-test-01',
                    'title': 'Bearing Vibration Photo',
                    'description': 'Thermal and acoustic check',
                    'mediaType': 'image',
                    'originalFilename': 'inspection.jpg',
                    'mimeType': 'image/jpeg',
                    'sizeBytes': 1024,
                    'uploadedById': 'usr-eng-01',
                    'status': 'indexed',
                    'tags': ['bearing', 'overhaul'],
                    'createdAt': DateTime.now().toIso8601String(),
                    'updatedAt': DateTime.now().toIso8601String(),
                  },
                },
              ),
            );
          },
        ),
      );

      final fakeBytes = Uint8List.fromList([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02]);
      final result = await repository.ingestMedia(
        fileName: 'inspection.jpg',
        bytes: fakeBytes,
        title: 'Bearing Vibration Photo',
        description: 'Thermal and acoustic check',
        equipmentId: 'equip-p102',
        tags: ['bearing', 'overhaul'],
      );

      expect(result.id, equals('med-unit-test-01'));
      expect(result.title, equals('Bearing Vibration Photo'));

      expect(capturedOptions, isNotNull);
      expect(capturedOptions!.path, equals('/media/ingest'));
      expect(capturedOptions!.method, equals('POST'));

      // Verify FormData fields
      final formData = capturedOptions!.data as FormData;
      expect(formData.fields.any((f) => f.key == 'title' && f.value == 'Bearing Vibration Photo'), isTrue);
      expect(formData.fields.any((f) => f.key == 'description' && f.value == 'Thermal and acoustic check'), isTrue);
      expect(formData.fields.any((f) => f.key == 'equipmentId' && f.value == 'equip-p102'), isTrue);
      expect(formData.fields.any((f) => f.key == 'tags' && f.value == 'bearing,overhaul'), isTrue);

      // Verify Multipart file field
      expect(formData.files.any((f) => f.key == 'file' && f.value.filename == 'inspection.jpg'), isTrue);
    });

    test('3. FetchMediaList queries /media with optional equipmentId filter', () async {
      RequestOptions? capturedOptions;

      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            capturedOptions = options;
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'success': true,
                  'data': [
                    {
                      'id': 'med-01',
                      'title': 'Test Item',
                      'mediaType': 'image',
                      'originalFilename': 'test.jpg',
                      'mimeType': 'image/jpeg',
                      'sizeBytes': 500,
                      'uploadedById': 'usr-01',
                      'status': 'indexed',
                      'tags': [],
                      'createdAt': DateTime.now().toIso8601String(),
                    }
                  ],
                },
              ),
            );
          },
        ),
      );

      final list = await repository.fetchMediaList(equipmentId: 'equip-p102');
      expect(list.length, equals(1));
      expect(capturedOptions?.path, equals('/media'));
      expect(capturedOptions?.queryParameters['equipmentId'], equals('equip-p102'));
    });
  });
}
