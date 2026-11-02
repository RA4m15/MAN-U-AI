import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:mocktail/mocktail.dart';
import 'package:manuai_mobile/core/network/auth_interceptor.dart';
import 'package:manuai_mobile/core/storage/secure_storage_service.dart';
import 'package:manuai_mobile/features/auth/controllers/auth_controller.dart';
import 'package:manuai_mobile/features/auth/models/auth_state.dart';
import 'package:manuai_mobile/features/auth/models/user_model.dart';
import 'package:manuai_mobile/features/documents/controllers/document_upload_controller.dart';
import 'package:manuai_mobile/features/documents/models/document_model.dart';
import 'package:manuai_mobile/features/documents/models/picked_document.dart';
import 'package:manuai_mobile/features/documents/models/upload_document_response.dart';
import 'package:manuai_mobile/features/documents/repositories/document_repository.dart';

class MockSecureStorageService extends Mock implements SecureStorageService {}
class MockDocumentRepository extends Mock implements DocumentRepository {}

class DummyAuthController extends AuthController {
  final UserModel? _initialUser;

  DummyAuthController(this._initialUser);

  @override
  AuthState build() {
    if (_initialUser != null) {
      return Authenticated(user: _initialUser, token: 'engineer-test-jwt');
    }
    return const Unauthenticated();
  }

  @override
  Future<void> checkAuthStatus() async {}

  @override
  Future<UserModel?> refreshUserProfile() async => _initialUser;

  @override
  Future<bool> login(String email, String password) async => true;

  @override
  Future<void> logout() async {
    state = const Unauthenticated();
  }

  @override
  void handleUnauthorized() {
    state = const Unauthenticated();
  }

  @override
  void clearError() {
    if (state is Unauthenticated && (state as Unauthenticated).errorMessage != null) {
      state = const Unauthenticated();
    }
  }

  @override
  Future<({bool isHealthy, String statusMessage, int? statusCode})> checkServerHealth() async {
    return (isHealthy: true, statusMessage: 'Connected', statusCode: 200);
  }

  @override
  void setServerUrl(String newUrl) {}

  @override
  Future<bool> register({
    required String name,
    required String email,
    required String password,
  }) async => true;
}

void main() {
  setUpAll(() {
    registerFallbackValue(CancelToken());
  });

  group('Engineer Role and Document DTO Serialization', () {
    test('UserModel.fromJson parses engineer account with correct role', () {
      final json = {
        'id': 'usr-eng-lead-01',
        'name': 'Alex Mercer',
        'email': 'engineer@plant.io',
        'role': 'engineer',
        'createdAt': '2026-03-15T08:00:00.000Z',
      };

      final user = UserModel.fromJson(json);

      expect(user.id, equals('usr-eng-lead-01'));
      expect(user.name, equals('Alex Mercer'));
      expect(user.email, equals('engineer@plant.io'));
      expect(user.role, equals('engineer'));
      expect(user.createdAt, isNotNull);
    });

    test('DocumentModel.fromJson parses document list DTO accurately', () {
      final json = {
        'id': 'doc-turb-101',
        'title': 'Steam Turbine Operating Procedures',
        'revision': 'Rev 3.2',
        'filename': 'st_ops_manual.pdf',
        'sizeBytes': 2048576,
        'status': 'indexed',
        'pageCount': 42,
        'processingError': null,
        'tags': ['turbine', 'powergen', 'high-pressure'],
        'equipment': 'eq-st-101',
        'createdAt': '2026-04-01T10:00:00.000Z',
        'updatedAt': '2026-04-01T10:05:00.000Z',
      };

      final doc = DocumentModel.fromJson(json);

      expect(doc.id, equals('doc-turb-101'));
      expect(doc.title, equals('Steam Turbine Operating Procedures'));
      expect(doc.revision, equals('Rev 3.2'));
      expect(doc.filename, equals('st_ops_manual.pdf'));
      expect(doc.sizeBytes, equals(2048576));
      expect(doc.status, equals('indexed'));
      expect(doc.pageCount, equals(42));
      expect(doc.equipmentId, equals('eq-st-101'));
      expect(doc.tags, contains('turbine'));
      expect(doc.tags, contains('powergen'));
    });
  });

  group('AuthInterceptor Multipart Header Preservation', () {
    late MockSecureStorageService mockStorage;

    setUp(() {
      mockStorage = MockSecureStorageService();
    });

    test('attaches Bearer token and preserves application/json for standard requests', () async {
      when(() => mockStorage.getToken()).thenAnswer((_) async => 'mock-jwt-token-xyz');

      final interceptor = AuthInterceptor(storage: mockStorage);
      final options = RequestOptions(
        path: '/api/v1/documents',
        headers: {},
      );

      final handler = RequestInterceptorHandler();
      // Invoke onRequest directly
      await interceptor.onRequest(options, handler);

      expect(options.headers['Authorization'], equals('Bearer mock-jwt-token-xyz'));
      expect(options.headers['Content-Type'], equals('application/json'));
      expect(options.headers['Accept'], equals('application/json'));
    });

    test('preserves Dio multipart boundary by NOT overriding Content-Type when data is FormData', () async {
      when(() => mockStorage.getToken()).thenAnswer((_) async => 'mock-jwt-token-xyz');

      final interceptor = AuthInterceptor(storage: mockStorage);
      final formData = FormData.fromMap({
        'title': 'Centrifugal Pump Guide',
        'file': MultipartFile.fromBytes(
          [0x25, 0x50, 0x44, 0x46],
          filename: 'pump_guide.pdf',
        ),
      });

      final options = RequestOptions(
        path: '/api/v1/documents/upload',
        data: formData,
        headers: {},
      );

      final handler = RequestInterceptorHandler();
      await interceptor.onRequest(options, handler);

      expect(options.headers['Authorization'], equals('Bearer mock-jwt-token-xyz'));
      // Vital fix verification: Content-Type must NOT be set to application/json
      expect(options.headers['Content-Type'], isNull);
      expect(options.headers['Accept'], equals('application/json'));
    });
  });

  group('DocumentRepository Client Verification and Fetching', () {
    late Dio dio;
    late DioAdapter dioAdapter;
    late DocumentRepository repository;

    setUp(() {
      dio = Dio(BaseOptions(baseUrl: 'http://localhost:4000/api/v1'));
      dioAdapter = DioAdapter(dio: dio);
      repository = DocumentRepository(dio: dio);
    });

    test('getDocuments() retrieves authorized facility documents list', () async {
      dioAdapter.onGet(
        '/documents',
        (server) => server.reply(200, {
          'success': true,
          'data': [
            {
              'id': 'doc-1',
              'title': 'Heat Exchanger Manual',
              'revision': 'Rev 1.0',
              'filename': 'hx_manual.pdf',
              'sizeBytes': 102400,
              'status': 'indexed',
              'pageCount': 12,
              'tags': ['thermal'],
              'equipment': 'eq-hx-01',
            },
            {
              'id': 'doc-2',
              'title': 'Emergency Shutdown Protocol',
              'revision': 'Rev 4.0',
              'filename': 'esd_sop.pdf',
              'sizeBytes': 204800,
              'status': 'processing',
              'pageCount': 5,
              'tags': ['safety'],
            },
          ],
        }),
      );

      final docs = await repository.getDocuments();

      expect(docs.length, equals(2));
      expect(docs[0].id, equals('doc-1'));
      expect(docs[0].title, equals('Heat Exchanger Manual'));
      expect(docs[1].id, equals('doc-2'));
      expect(docs[1].status, equals('processing'));
    });

    test('uploadDocument rejects non-PDF extension before HTTP call', () async {
      expect(
        () => repository.uploadDocument(
          fileName: 'schematic.dwg',
          bytes: [1, 2, 3, 4],
        ),
        throwsA(isA<FormatException>().having(
          (e) => e.message,
          'message',
          contains('Only PDF documents are supported'),
        )),
      );
    });

    test('uploadDocument rejects file exceeding 50MB before HTTP call', () async {
      expect(
        () => repository.uploadDocument(
          fileName: 'oversized.pdf',
          bytes: Uint8List((50 * 1024 * 1024) + 1),
        ),
        throwsA(isA<FormatException>().having(
          (e) => e.message,
          'message',
          contains('File exceeds the 50MB upload limit'),
        )),
      );
    });

    test('uploadDocument uploads genuine PDF and returns 202 UploadDocumentResponse', () async {
      final samplePdf = [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37];

      dioAdapter.onPost(
        '/documents/upload',
        (server) => server.reply(202, {
          'success': true,
          'data': {
            'id': 'doc-new-101',
            'title': 'Compressor Calibration SOP',
            'revision': 'Rev 2.0',
            'status': 'processing',
            'message': 'File uploaded and queued for ingestion',
          },
        }),
        data: Matchers.any,
      );

      final result = await repository.uploadDocument(
        fileName: 'compressor_sop.pdf',
        bytes: samplePdf,
        title: 'Compressor Calibration SOP',
        revision: 'Rev 2.0',
        equipmentId: 'eq-cmp-01',
      );

      expect(result.id, equals('doc-new-101'));
      expect(result.title, equals('Compressor Calibration SOP'));
      expect(result.revision, equals('Rev 2.0'));
      expect(result.status, equals('processing'));
      expect(result.message, contains('File uploaded and queued for ingestion'));
    });
  });

  group('DocumentUploadController Engineer Authorization Flow', () {
    late MockDocumentRepository mockRepo;

    const engineerUser = UserModel(
      id: 'usr-eng-lead-01',
      name: 'Alex Mercer',
      email: 'engineer@plant.io',
      role: 'engineer',
    );

    const viewerUser = UserModel(
      id: 'usr-viewer-01',
      name: 'Jordan Lee',
      email: 'viewer@plant.io',
      role: 'viewer',
    );

    setUp(() {
      mockRepo = MockDocumentRepository();
    });

    test('Engineer user can select document and successfully upload', () async {
      final container = ProviderContainer(
        overrides: [
          documentRepositoryProvider.overrideWithValue(mockRepo),
          authControllerProvider.overrideWith(() => DummyAuthController(engineerUser)),
        ],
      );
      addTearDown(container.dispose);

      final controller = container.read(documentUploadControllerProvider.notifier);
      final pdfBytes = Uint8List.fromList([0x25, 0x50, 0x44, 0x46, 0x2D]);

      final doc = PickedDocument(
        name: 'boiler_inspections.pdf',
        size: pdfBytes.length,
        readBytes: () async => pdfBytes,
      );

      when(() => mockRepo.uploadDocument(
            fileName: 'boiler_inspections.pdf',
            bytes: pdfBytes,
            title: 'Boiler Inspection SOP',
            revision: 'Rev 1.0',
            equipmentId: 'eq-blr-01',
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
          )).thenAnswer((_) async => const UploadDocumentResponse(
            id: 'doc-blr-99',
            title: 'Boiler Inspection SOP',
            revision: 'Rev 1.0',
            status: 'processing',
            message: 'Queued for OCR processing',
          ));

      controller.selectDocument(doc);
      expect(container.read(documentUploadControllerProvider).selectedDocument, isNotNull);

      await controller.upload(
        title: 'Boiler Inspection SOP',
        revision: 'Rev 1.0',
        equipmentId: 'eq-blr-01',
      );

      final finalState = container.read(documentUploadControllerProvider);
      expect(finalState.isUploading, isFalse);
      expect(finalState.errorMessage, isNull);
      expect(finalState.uploadProgress, equals(1.0));
      expect(finalState.successResult?.id, equals('doc-blr-99'));
    });

    test('Viewer user is prevented from uploading before network call', () async {
      final container = ProviderContainer(
        overrides: [
          documentRepositoryProvider.overrideWithValue(mockRepo),
          authControllerProvider.overrideWith(() => DummyAuthController(viewerUser)),
        ],
      );
      addTearDown(container.dispose);

      final controller = container.read(documentUploadControllerProvider.notifier);
      final pdfBytes = Uint8List.fromList([0x25, 0x50, 0x44, 0x46]);

      controller.selectDocument(PickedDocument(
        name: 'test.pdf',
        size: pdfBytes.length,
        readBytes: () async => pdfBytes,
      ));

      await controller.upload(title: 'Restricted Doc');

      final finalState = container.read(documentUploadControllerProvider);
      expect(finalState.isUploading, isFalse);
      expect(finalState.errorMessage, contains('Access denied: Only administrators and engineers'));
      verifyNever(() => mockRepo.uploadDocument(
            fileName: any(named: 'fileName'),
            bytes: any(named: 'bytes'),
            title: any(named: 'title'),
            revision: any(named: 'revision'),
            equipmentId: any(named: 'equipmentId'),
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
          ));
    });

    test('Upload diagnostics correctly parses HTTP 500 server error, stage, and request ID', () async {
      final container = ProviderContainer(
        overrides: [
          documentRepositoryProvider.overrideWithValue(mockRepo),
          authControllerProvider.overrideWith(() => DummyAuthController(engineerUser)),
        ],
      );
      addTearDown(container.dispose);

      final controller = container.read(documentUploadControllerProvider.notifier);
      final pdfBytes = Uint8List.fromList([0x25, 0x50, 0x44, 0x46]);

      controller.selectDocument(PickedDocument(
        name: 'manual.pdf',
        size: pdfBytes.length,
        readBytes: () async => pdfBytes,
      ));

      when(() => mockRepo.uploadDocument(
            fileName: any(named: 'fileName'),
            bytes: any(named: 'bytes'),
            title: any(named: 'title'),
            revision: any(named: 'revision'),
            equipmentId: any(named: 'equipmentId'),
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
          )).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/documents/upload'),
          response: Response(
            requestOptions: RequestOptions(path: '/documents/upload'),
            statusCode: 500,
            data: {
              'success': false,
              'error': {
                'code': 'STORAGE_FAILURE',
                'message': 'Failed to stream file to storage bucket.',
                'stage': 'storage_persistence',
                'requestId': 'req-test-999',
              },
            },
          ),
        ),
      );

      await controller.upload();

      final state = container.read(documentUploadControllerProvider);
      expect(state.isUploading, isFalse);
      expect(state.diagnostics?.statusCode, equals(500));
      expect(state.diagnostics?.errorCode, equals('STORAGE_FAILURE'));
      expect(state.diagnostics?.stage, equals('storage_persistence'));
      expect(state.diagnostics?.requestId, equals('req-test-999'));
      expect(state.diagnostics?.formattedDisplay, contains('[HTTP 500] STORAGE_FAILURE'));
    });
  });
}
