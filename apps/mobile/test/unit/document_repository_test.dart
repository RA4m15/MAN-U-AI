import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:manuai_mobile/features/documents/repositories/document_repository.dart';

void main() {
  late Dio dio;
  late DioAdapter dioAdapter;
  late DocumentRepository repository;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'http://localhost:4000/api/v1'));
    dioAdapter = DioAdapter(dio: dio);
    repository = DocumentRepository(dio: dio);
  });

  group('DocumentRepository.getFigureImageBytes', () {
    const docId = 'doc-eng-101';
    const figId = 'fig-sch-01';

    test('successfully retrieves genuine image bytes on 200 OK', () async {
      final sampleBytes = Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header

      dioAdapter.onGet(
        '/documents/$docId/figures/$figId/image',
        (server) => server.reply(200, sampleBytes),
      );

      final result = await repository.getFigureImageBytes(
        documentId: docId,
        figureId: figId,
      );

      expect(result, equals(sampleBytes));
    });

    test('throws DioException on 401 Unauthorized', () async {
      dioAdapter.onGet(
        '/documents/$docId/figures/$figId/image',
        (server) => server.reply(401, {'error': 'Unauthorized'}),
      );

      expect(
        () => repository.getFigureImageBytes(documentId: docId, figureId: figId),
        throwsA(isA<DioException>().having(
          (e) => e.response?.statusCode,
          'status',
          401,
        )),
      );
    });

    test('throws DioException on 403 Forbidden when user lacks document access', () async {
      dioAdapter.onGet(
        '/documents/$docId/figures/$figId/image',
        (server) => server.reply(403, {'error': 'Forbidden access to technical diagram'}),
      );

      expect(
        () => repository.getFigureImageBytes(documentId: docId, figureId: figId),
        throwsA(isA<DioException>().having(
          (e) => e.response?.statusCode,
          'status',
          403,
        )),
      );
    });

    test('throws DioException on 404 Not Found when figure does not exist', () async {
      dioAdapter.onGet(
        '/documents/$docId/figures/$figId/image',
        (server) => server.reply(404, {'error': 'Figure not found'}),
      );

      expect(
        () => repository.getFigureImageBytes(documentId: docId, figureId: figId),
        throwsA(isA<DioException>().having(
          (e) => e.response?.statusCode,
          'status',
          404,
        )),
      );
    });
  });

  group('DocumentRepository.getDocumentFigures', () {
    const docId = 'doc-eng-101';

    test('parses figure metadata list on 200 OK', () async {
      dioAdapter.onGet(
        '/documents/$docId/figures',
        (server) => server.reply(200, {
          'success': true,
          'data': [
            {
              'id': 'fig-01',
              'figureId': 'fig-01',
              'title': 'Motor Cross Section',
              'caption': 'Exploded view of stator and rotor',
              'page': 14,
              'storagePath': 'figures/doc-eng-101/fig-01.png',
              'mimeType': 'image/png',
              'sizeBytes': 204800,
            },
            {
              'id': 'fig-02',
              'figureId': 'fig-02',
              'title': 'Bearing Clearance Chart',
              'page': 18,
              'storagePath': 'figures/doc-eng-101/fig-02.png',
              'mimeType': 'image/png',
            }
          ],
        }),
      );

      final figures = await repository.getDocumentFigures(documentId: docId);

      expect(figures.length, equals(2));
      expect(figures[0].id, equals('fig-01'));
      expect(figures[0].title, equals('Motor Cross Section'));
      expect(figures[0].page, equals(14));
      expect(figures[1].caption, isNull);
    });

    test('passes page query parameter when provided', () async {
      dioAdapter.onGet(
        '/documents/$docId/figures',
        (server) => server.reply(200, {'success': true, 'data': []}),
        queryParameters: {'page': 5},
      );

      final figures = await repository.getDocumentFigures(documentId: docId, page: 5);
      expect(figures, isEmpty);
    });
  });

  group('DocumentRepository.uploadDocument', () {
    test('successfully uploads valid PDF document on 202 Accepted', () async {
      dioAdapter.onPost(
        '/documents/upload',
        (server) => server.reply(202, {
          'success': true,
          'data': {
            'id': 'doc-new-202',
            'title': 'Hydraulic Pump Manual',
            'revision': 'Rev C',
            'status': 'processing',
            'message': 'Document uploaded successfully and queued for OCR processing',
          },
        }),
        data: Matchers.any,
      );

      final fakeBytes = [0x25, 0x50, 0x44, 0x46]; // %PDF
      final response = await repository.uploadDocument(
        fileName: 'hydraulic_manual.pdf',
        bytes: fakeBytes,
        title: 'Hydraulic Pump Manual',
        revision: 'Rev C',
        equipmentId: 'eq-hyd-01',
      );

      expect(response.id, equals('doc-new-202'));
      expect(response.title, equals('Hydraulic Pump Manual'));
      expect(response.revision, equals('Rev C'));
      expect(response.status, equals('processing'));
      expect(response.message, contains('queued for OCR processing'));
    });

    test('rejects non-PDF files client-side before network dispatch', () async {
      expect(
        () => repository.uploadDocument(
          fileName: 'equipment_spec.docx',
          bytes: [1, 2, 3, 4],
        ),
        throwsA(isA<FormatException>().having(
          (e) => e.message,
          'message',
          contains('Only PDF documents are supported'),
        )),
      );
    });

    test('rejects files larger than 50MB limit client-side before dispatch', () async {
      final oversizedBytes = Uint8List(DocumentRepository.maxUploadSizeBytes + 1);

      expect(
        () => repository.uploadDocument(
          fileName: 'massive_schematic.pdf',
          bytes: oversizedBytes,
        ),
        throwsA(isA<FormatException>().having(
          (e) => e.message,
          'message',
          contains('File exceeds the 50MB upload limit'),
        )),
      );
    });

    test('propagates HTTP 403 Forbidden when unauthorized role attempts upload', () async {
      dioAdapter.onPost(
        '/documents/upload',
        (server) => server.reply(403, {
          'success': false,
          'error': {
            'code': 'FORBIDDEN',
            'message': 'Access denied: Only administrators and engineers can upload facility documents.',
          },
        }),
        data: Matchers.any,
      );

      expect(
        () => repository.uploadDocument(
          fileName: 'standard_operating_procedure.pdf',
          bytes: [0x25, 0x50, 0x44, 0x46],
        ),
        throwsA(isA<DioException>().having(
          (e) => e.response?.statusCode,
          'status',
          403,
        )),
      );
    });

    test('propagates HTTP 413 Payload Too Large when backend limits kick in', () async {
      dioAdapter.onPost(
        '/documents/upload',
        (server) => server.reply(413, {
          'success': false,
          'error': {
            'code': 'FILE_TOO_LARGE',
            'message': 'File size exceeds maximum permitted limit of 50MB.',
          },
        }),
        data: Matchers.any,
      );

      expect(
        () => repository.uploadDocument(
          fileName: 'large_manual.pdf',
          bytes: [0x25, 0x50, 0x44, 0x46],
        ),
        throwsA(isA<DioException>().having(
          (e) => e.response?.statusCode,
          'status',
          413,
        )),
      );
    });

    test('propagates HTTP 429 Too Many Requests when rate limited', () async {
      dioAdapter.onPost(
        '/documents/upload',
        (server) => server.reply(429, {
          'success': false,
          'error': {
            'code': 'RATE_LIMIT_EXCEEDED',
            'message': 'Too many upload attempts. Please try again later.',
          },
        }),
        data: Matchers.any,
      );

      expect(
        () => repository.uploadDocument(
          fileName: 'spares_catalog.pdf',
          bytes: [0x25, 0x50, 0x44, 0x46],
        ),
        throwsA(isA<DioException>().having(
          (e) => e.response?.statusCode,
          'status',
          429,
        )),
      );
    });
  });
}
