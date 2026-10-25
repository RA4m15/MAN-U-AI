import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:manuai_mobile/features/auth/controllers/auth_controller.dart';
import 'package:manuai_mobile/features/auth/models/auth_state.dart';
import 'package:manuai_mobile/features/auth/models/user_model.dart';
import 'package:manuai_mobile/features/documents/controllers/document_upload_controller.dart';
import 'package:manuai_mobile/features/documents/models/picked_document.dart';
import 'package:manuai_mobile/features/documents/models/upload_document_response.dart';
import 'package:manuai_mobile/features/documents/repositories/document_repository.dart';

class MockDocumentRepository extends Mock implements DocumentRepository {}

void main() {
  late MockDocumentRepository mockRepo;
  late ProviderContainer container;

  const engineerUser = UserModel(
    id: 'usr-eng-01',
    name: 'Sarah Connor',
    email: 'sarah@plant.io',
    role: 'engineer',
  );

  const viewerUser = UserModel(
    id: 'usr-view-01',
    name: 'John Viewer',
    email: 'viewer@plant.io',
    role: 'viewer',
  );

  const adminUser = UserModel(
    id: 'usr-admin-01',
    name: 'Admin Boss',
    email: 'admin@plant.io',
    role: 'admin',
  );

  setUpAll(() {
    registerFallbackValue(CancelToken());
  });

  setUp(() {
    mockRepo = MockDocumentRepository();
  });

  tearDown(() {
    container.dispose();
  });

  ProviderContainer createContainer({UserModel? currentUser}) {
    return ProviderContainer(
      overrides: [
        documentRepositoryProvider.overrideWithValue(mockRepo),
        authControllerProvider.overrideWith(() => DummyAuthController(currentUser)),
      ],
    );
  }

  group('DocumentUploadController.selectDocument', () {
    test('accepts valid PDF under 50MB and clears previous errors', () {
      container = createContainer(currentUser: engineerUser);
      final controller = container.read(documentUploadControllerProvider.notifier);

      final validDoc = PickedDocument(
        name: 'pump_specifications.pdf',
        size: 1024 * 500, // 500KB
        readBytes: () async => Uint8List.fromList([0x25, 0x50, 0x44, 0x46]),
      );

      controller.selectDocument(validDoc);

      final state = container.read(documentUploadControllerProvider);
      expect(state.selectedDocument, equals(validDoc));
      expect(state.errorMessage, isNull);
      expect(state.isUploading, isFalse);
    });

    test('rejects non-PDF files and sets error message', () {
      container = createContainer(currentUser: engineerUser);
      final controller = container.read(documentUploadControllerProvider.notifier);

      final invalidDoc = PickedDocument(
        name: 'manual.docx',
        size: 1024 * 100,
        readBytes: () async => Uint8List.fromList([1, 2, 3]),
      );

      controller.selectDocument(invalidDoc);

      final state = container.read(documentUploadControllerProvider);
      expect(state.selectedDocument, isNull);
      expect(state.errorMessage, contains('Only PDF documents are supported'));
    });

    test('rejects files larger than 50MB limit', () {
      container = createContainer(currentUser: engineerUser);
      final controller = container.read(documentUploadControllerProvider.notifier);

      final oversizedDoc = PickedDocument(
        name: 'huge_cad_export.pdf',
        size: (50 * 1024 * 1024) + 100, // > 50MB
        readBytes: () async => Uint8List(0),
      );

      controller.selectDocument(oversizedDoc);

      final state = container.read(documentUploadControllerProvider);
      expect(state.selectedDocument, isNull);
      expect(state.errorMessage, contains('File exceeds the 50MB upload limit'));
    });

    test('clearSelection resets state to default', () {
      container = createContainer(currentUser: engineerUser);
      final controller = container.read(documentUploadControllerProvider.notifier);

      controller.selectDocument(PickedDocument(
        name: 'test.pdf',
        size: 100,
        readBytes: () async => Uint8List(0),
      ));
      expect(container.read(documentUploadControllerProvider).selectedDocument, isNotNull);

      controller.clearSelection();
      expect(container.read(documentUploadControllerProvider).selectedDocument, isNull);
    });
  });

  group('DocumentUploadController.upload role authorization and dispatch', () {
    test('blocks Viewer role from uploading and displays permission error without calling backend', () async {
      container = createContainer(currentUser: viewerUser);
      final controller = container.read(documentUploadControllerProvider.notifier);

      controller.selectDocument(PickedDocument(
        name: 'bearing_protocol.pdf',
        size: 1024,
        readBytes: () async => Uint8List.fromList([0x25, 0x50, 0x44, 0x46]),
      ));

      await controller.upload(title: 'Bearing Protocol');

      final state = container.read(documentUploadControllerProvider);
      expect(state.isUploading, isFalse);
      expect(state.errorMessage, contains('Access denied: Only administrators and engineers'));
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

    test('permits Engineer role to upload and records success result on 202', () async {
      container = createContainer(currentUser: engineerUser);
      final controller = container.read(documentUploadControllerProvider.notifier);

      final pdfBytes = Uint8List.fromList([0x25, 0x50, 0x44, 0x46]);
      final validDoc = PickedDocument(
        name: 'sp400_manual.pdf',
        size: pdfBytes.length,
        readBytes: () async => pdfBytes,
      );

      when(() => mockRepo.uploadDocument(
            fileName: 'sp400_manual.pdf',
            bytes: pdfBytes,
            title: 'SP-400 Manual',
            revision: 'Rev 2.0',
            equipmentId: 'eq-sp-400',
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
          )).thenAnswer((_) async => const UploadDocumentResponse(
            id: 'doc-uploaded-1',
            title: 'SP-400 Manual',
            revision: 'Rev 2.0',
            status: 'processing',
            message: 'Queued for OCR processing',
          ));

      controller.selectDocument(validDoc);
      await controller.upload(
        title: 'SP-400 Manual',
        revision: 'Rev 2.0',
        equipmentId: 'eq-sp-400',
      );

      final state = container.read(documentUploadControllerProvider);
      expect(state.isUploading, isFalse);
      expect(state.uploadProgress, equals(1.0));
      expect(state.errorMessage, isNull);
      expect(state.successResult?.id, equals('doc-uploaded-1'));
      expect(state.successResult?.status, equals('processing'));
    });

    test('permits Admin role to upload successfully', () async {
      container = createContainer(currentUser: adminUser);
      final controller = container.read(documentUploadControllerProvider.notifier);

      final pdfBytes = Uint8List.fromList([0x25, 0x50, 0x44, 0x46]);
      final validDoc = PickedDocument(
        name: 'plant_safety.pdf',
        size: pdfBytes.length,
        readBytes: () async => pdfBytes,
      );

      when(() => mockRepo.uploadDocument(
            fileName: any(named: 'fileName'),
            bytes: any(named: 'bytes'),
            title: any(named: 'title'),
            revision: any(named: 'revision'),
            equipmentId: any(named: 'equipmentId'),
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
          )).thenAnswer((_) async => const UploadDocumentResponse(
            id: 'doc-admin-01',
            title: 'Plant Safety SOP',
            revision: 'Rev 1.0',
            status: 'processing',
            message: 'Queued for OCR processing',
          ));

      controller.selectDocument(validDoc);
      await controller.upload(title: 'Plant Safety SOP');

      final state = container.read(documentUploadControllerProvider);
      expect(state.isUploading, isFalse);
      expect(state.successResult?.id, equals('doc-admin-01'));
    });

    test('maps DioException 403 Forbidden to actionable permission message', () async {
      container = createContainer(currentUser: engineerUser);
      final controller = container.read(documentUploadControllerProvider.notifier);

      final pdfBytes = Uint8List.fromList([0x25, 0x50, 0x44, 0x46]);
      controller.selectDocument(PickedDocument(
        name: 'spec.pdf',
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
            statusCode: 403,
          ),
        ),
      );

      await controller.upload();

      final state = container.read(documentUploadControllerProvider);
      expect(state.isUploading, isFalse);
      expect(state.errorMessage, contains('Access denied: Only administrators and engineers'));
    });

    test('maps DioException 413 Payload Too Large to file size limit message', () async {
      container = createContainer(currentUser: engineerUser);
      final controller = container.read(documentUploadControllerProvider.notifier);

      final pdfBytes = Uint8List.fromList([0x25, 0x50, 0x44, 0x46]);
      controller.selectDocument(PickedDocument(
        name: 'spec.pdf',
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
            statusCode: 413,
          ),
        ),
      );

      await controller.upload();

      final state = container.read(documentUploadControllerProvider);
      expect(state.isUploading, isFalse);
      expect(state.errorMessage, contains('File exceeds the 50MB upload limit'));
    });

    test('maps DioException 429 Too Many Requests to rate limit message', () async {
      container = createContainer(currentUser: engineerUser);
      final controller = container.read(documentUploadControllerProvider.notifier);

      final pdfBytes = Uint8List.fromList([0x25, 0x50, 0x44, 0x46]);
      controller.selectDocument(PickedDocument(
        name: 'spec.pdf',
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
            statusCode: 429,
          ),
        ),
      );

      await controller.upload();

      final state = container.read(documentUploadControllerProvider);
      expect(state.isUploading, isFalse);
      expect(state.errorMessage, contains('Upload rate limit reached'));
    });

    test('maps network connection timeout error to actionable connectivity message', () async {
      container = createContainer(currentUser: engineerUser);
      final controller = container.read(documentUploadControllerProvider.notifier);

      final pdfBytes = Uint8List.fromList([0x25, 0x50, 0x44, 0x46]);
      controller.selectDocument(PickedDocument(
        name: 'spec.pdf',
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
          type: DioExceptionType.connectionTimeout,
        ),
      );

      await controller.upload();

      final state = container.read(documentUploadControllerProvider);
      expect(state.isUploading, isFalse);
      expect(state.errorMessage, contains('Network connection to facility server timed out'));
    });
  });
}

class DummyAuthController extends Notifier<AuthState> implements AuthController {
  final UserModel? _initialUser;
  DummyAuthController(this._initialUser);

  @override
  AuthState build() {
    if (_initialUser != null) {
      return Authenticated(user: _initialUser, token: 'fake-jwt');
    }
    return const Unauthenticated();
  }

  @override
  Future<void> checkAuthStatus() async {}

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
    return (isHealthy: true, statusMessage: 'Connected to MAN-U-AI Server', statusCode: 200);
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
