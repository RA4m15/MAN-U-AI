import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:manuai_mobile/core/theme/app_theme.dart';
import 'package:manuai_mobile/features/auth/controllers/auth_controller.dart';
import 'package:manuai_mobile/features/auth/models/auth_state.dart';
import 'package:manuai_mobile/features/auth/models/user_model.dart';
import 'package:manuai_mobile/features/documents/controllers/document_upload_controller.dart';
import 'package:manuai_mobile/features/documents/models/picked_document.dart';
import 'package:manuai_mobile/features/documents/models/upload_document_response.dart';
import 'package:manuai_mobile/features/documents/repositories/document_repository.dart';
import 'package:manuai_mobile/features/documents/views/widgets/authenticated_figure_viewer.dart';
import 'package:manuai_mobile/features/documents/views/widgets/document_upload_modal.dart';
import 'package:manuai_mobile/features/documents/views/widgets/full_screen_figure_viewer.dart';
import 'package:manuai_mobile/features/equipment/controllers/equipment_controller.dart';
import 'package:manuai_mobile/features/equipment/models/equipment_model.dart';
import 'package:manuai_mobile/features/equipment/repositories/equipment_repository.dart';

class MockDocumentRepository extends Mock implements DocumentRepository {}
class MockEquipmentRepository extends Mock implements EquipmentRepository {}

// Valid 1x1 transparent PNG bytes for Flutter image decoder in test environment
final Uint8List validPngBytes = Uint8List.fromList([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
]);

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

void main() {
  late MockDocumentRepository mockDocRepo;
  late MockEquipmentRepository mockEquipmentRepo;

  const engineerUser = UserModel(
    id: 'u-eng',
    name: 'Sarah Connor',
    email: 'sarah@plant.io',
    role: 'engineer',
  );

  const viewerUser = UserModel(
    id: 'u-view',
    name: 'John Viewer',
    email: 'viewer@plant.io',
    role: 'viewer',
  );

  setUp(() {
    mockDocRepo = MockDocumentRepository();
    mockEquipmentRepo = MockEquipmentRepository();
    when(() => mockEquipmentRepo.getEquipment()).thenAnswer((_) async => [
          const EquipmentModel(
            id: 'eq-101',
            name: 'Slurry Pump SP-400X',
            type: 'Pump',
            model: 'SP-400X',
            location: 'Building B - Slurry Bay',
          ),
        ]);
  });

  Widget buildTestableWidget({
    required Widget child,
    UserModel? currentUser,
    List<dynamic> extraOverrides = const [],
  }) {
    return ProviderScope(
      overrides: [
        documentRepositoryProvider.overrideWithValue(mockDocRepo),
        equipmentRepositoryProvider.overrideWithValue(mockEquipmentRepo),
        authControllerProvider.overrideWith(() => DummyAuthController(currentUser)),
        ...extraOverrides.cast(),
      ],
      child: MaterialApp(
        theme: AppTheme.darkTheme,
        home: Scaffold(body: child),
      ),
    );
  }

  group('AuthenticatedFigureViewer widget', () {
    testWidgets('displays loading state while image is being retrieved', (tester) async {
      when(() => mockDocRepo.getFigureImageBytes(
            documentId: any(named: 'documentId'),
            figureId: any(named: 'figureId'),
          )).thenAnswer((_) => Future<Uint8List>.delayed(
            const Duration(seconds: 1),
            () => validPngBytes,
          ));

      await tester.pumpWidget(buildTestableWidget(
        child: const AuthenticatedFigureViewer(
          documentId: 'doc-101',
          figureId: 'fig-01',
          documentTitle: 'Pump Rebuild Manual',
          page: 12,
        ),
      ));

      expect(find.text('Loading technical figure...'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      await tester.pumpAndSettle();
    });

    testWidgets('renders image and figure metadata on successful byte retrieval', (tester) async {
      when(() => mockDocRepo.getFigureImageBytes(
            documentId: 'doc-101',
            figureId: 'fig-01',
          )).thenAnswer((_) async => validPngBytes);

      await tester.pumpWidget(buildTestableWidget(
        child: const AuthenticatedFigureViewer(
          documentId: 'doc-101',
          figureId: 'fig-01',
          documentTitle: 'Pump Rebuild Manual',
          page: 12,
          caption: 'Exploded view of gland packing assembly',
        ),
      ));

      await tester.pumpAndSettle();

      expect(find.byKey(const Key('figure_preview_fig-01')), findsOneWidget);
      expect(find.text('Exploded view of gland packing assembly'), findsOneWidget);
      expect(find.text('Tap to inspect'), findsOneWidget);
    });

    testWidgets('displays error state and retry button on 403 Forbidden', (tester) async {
      when(() => mockDocRepo.getFigureImageBytes(
            documentId: 'doc-101',
            figureId: 'fig-01',
          )).thenAnswer((_) => Future.error(DioException(
        requestOptions: RequestOptions(path: '/documents/101/figures/fig-01/image'),
        response: Response(
          requestOptions: RequestOptions(path: '/documents/101/figures/fig-01/image'),
          statusCode: 403,
        ),
      )));

      await tester.pumpWidget(buildTestableWidget(
        child: const AuthenticatedFigureViewer(
          documentId: 'doc-101',
          figureId: 'fig-01',
          documentTitle: 'Pump Rebuild Manual',
          page: 12,
        ),
      ));

      await tester.pumpAndSettle();

      expect(find.text('Access restricted: Figure viewing unauthorized'), findsOneWidget);
      expect(find.byIcon(Icons.refresh_rounded), findsOneWidget);
    });

    testWidgets('tapping image preview navigates to FullScreenFigureViewer', (tester) async {
      when(() => mockDocRepo.getFigureImageBytes(
            documentId: 'doc-101',
            figureId: 'fig-01',
          )).thenAnswer((_) async => validPngBytes);

      await tester.pumpWidget(buildTestableWidget(
        child: const AuthenticatedFigureViewer(
          documentId: 'doc-101',
          figureId: 'fig-01',
          documentTitle: 'Pump Rebuild Manual',
          page: 12,
          caption: 'Exploded view of gland packing assembly',
        ),
      ));

      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('figure_preview_fig-01')));
      await tester.pumpAndSettle();

      expect(find.byType(FullScreenFigureViewer), findsOneWidget);
      expect(find.byType(InteractiveViewer), findsOneWidget);
      expect(find.text('Close full screen'), findsNothing); // Tooltip only
      expect(find.byIcon(Icons.close_rounded), findsOneWidget);
      expect(find.byIcon(Icons.restart_alt_rounded), findsOneWidget);
    });
  });

  group('FullScreenFigureViewer widget', () {
    testWidgets('renders InteractiveViewer with zoom reset and caption footer', (tester) async {
      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.darkTheme,
        home: FullScreenFigureViewer(
          imageBytes: validPngBytes,
          title: 'Pump Rebuild Manual',
          page: 12,
          caption: 'Exploded view of gland packing assembly',
        ),
      ));

      expect(find.byType(InteractiveViewer), findsOneWidget);
      expect(find.text('Pump Rebuild Manual'), findsOneWidget);
      expect(find.text('Page 12 • Technical Diagram'), findsOneWidget);
      expect(find.text('Exploded view of gland packing assembly'), findsOneWidget);

      // Verify reset zoom button is interactive
      await tester.tap(find.byIcon(Icons.restart_alt_rounded));
      await tester.pump();
    });
  });

  group('DocumentUploadModal role awareness and workflows', () {
    testWidgets('shows restricted banner when logged in as Viewer', (tester) async {
      await tester.pumpWidget(buildTestableWidget(
        currentUser: viewerUser,
        child: const DocumentUploadModal(),
      ));

      await tester.pumpAndSettle();

      expect(find.text('Document Ingestion Restricted'), findsOneWidget);
      expect(find.textContaining('Your account has VIEWER permissions'), findsOneWidget);
      expect(find.byKey(const Key('pick_pdf_button')), findsNothing);
      expect(find.byKey(const Key('submit_upload_button')), findsNothing);
    });

    testWidgets('shows file picker and upload inputs when logged in as Engineer', (tester) async {
      await tester.pumpWidget(buildTestableWidget(
        currentUser: engineerUser,
        child: const DocumentUploadModal(),
      ));

      await tester.pumpAndSettle();

      expect(find.text('Document Ingestion Restricted'), findsNothing);
      expect(find.byKey(const Key('pick_pdf_button')), findsOneWidget);
      expect(find.text('Select PDF Document'), findsOneWidget);
      expect(find.textContaining('Upload PDF equipment manuals, blueprints, and SOPs'), findsOneWidget);
    });

    testWidgets('displays selected file card, title input, and submit button when document is selected', (tester) async {
      final validDoc = PickedDocument(
        name: 'motor_maintenance_sop.pdf',
        size: 1024 * 250, // 250 KB
        readBytes: () async => validPngBytes,
      );

      final container = ProviderContainer(
        overrides: [
          documentRepositoryProvider.overrideWithValue(mockDocRepo),
          equipmentRepositoryProvider.overrideWithValue(mockEquipmentRepo),
          authControllerProvider.overrideWith(() => DummyAuthController(engineerUser)),
        ],
      );

      // Pre-select document in controller state
      container.read(documentUploadControllerProvider.notifier).selectDocument(validDoc);

      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.darkTheme,
          home: const Scaffold(body: DocumentUploadModal()),
        ),
      ));

      await tester.pumpAndSettle();

      expect(find.byKey(const Key('selected_file_card')), findsOneWidget);
      expect(find.text('motor_maintenance_sop.pdf'), findsOneWidget);
      expect(find.text('250.0 KB'), findsOneWidget);
      expect(find.byKey(const Key('upload_title_input')), findsOneWidget);
      expect(find.byKey(const Key('upload_revision_input')), findsOneWidget);
      expect(find.byKey(const Key('submit_upload_button')), findsOneWidget);
      expect(find.text('Upload & Ingest Document'), findsOneWidget);
    });

    testWidgets('shows progress bar during active upload', (tester) async {
      final validDoc = PickedDocument(
        name: 'motor_maintenance_sop.pdf',
        size: 1024 * 250,
        readBytes: () async => validPngBytes,
      );

      final container = ProviderContainer(
        overrides: [
          documentRepositoryProvider.overrideWithValue(mockDocRepo),
          equipmentRepositoryProvider.overrideWithValue(mockEquipmentRepo),
          authControllerProvider.overrideWith(() => DummyAuthController(engineerUser)),
        ],
      );

      // Pre-select document
      container.read(documentUploadControllerProvider.notifier).selectDocument(validDoc);

      when(() => mockDocRepo.uploadDocument(
            fileName: any(named: 'fileName'),
            bytes: any(named: 'bytes'),
            title: any(named: 'title'),
            revision: any(named: 'revision'),
            equipmentId: any(named: 'equipmentId'),
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
          )).thenAnswer((_) => Future<UploadDocumentResponse>.delayed(
            const Duration(seconds: 2),
            () => const UploadDocumentResponse(
              id: 'doc-uploaded-1',
              title: 'Motor SOP',
              revision: 'Rev 1.0',
              status: 'processing',
              message: 'Queued for OCR processing',
            ),
          ));

      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.darkTheme,
          home: const Scaffold(body: DocumentUploadModal()),
        ),
      ));

      await tester.pumpAndSettle();

      // Tap submit upload button
      await tester.tap(find.byKey(const Key('submit_upload_button')));
      await tester.pump(); // Start upload animation frame

      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      expect(find.textContaining('Uploading PDF:'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);

      await tester.pumpAndSettle(); // Settle completion
      expect(find.byKey(const Key('upload_success_banner')), findsOneWidget);
      expect(find.text('Document Queued for Ingestion'), findsOneWidget);
    });
  });
}
