import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mocktail/mocktail.dart';
import 'package:dio/dio.dart';

import 'package:manuai_mobile/core/storage/local_cache_service.dart';
import 'package:manuai_mobile/core/theme/app_theme.dart';
import 'package:manuai_mobile/features/auth/controllers/auth_controller.dart';
import 'package:manuai_mobile/features/auth/models/auth_state.dart';
import 'package:manuai_mobile/features/auth/models/user_model.dart';
import 'package:manuai_mobile/features/chat/controllers/chat_controller.dart';
import 'package:manuai_mobile/features/chat/controllers/conversation_controller.dart';
import 'package:manuai_mobile/features/chat/models/conversation_model.dart';
import 'package:manuai_mobile/features/chat/repositories/chat_repository.dart';
import 'package:manuai_mobile/features/chat/views/chat_screen.dart';
import 'package:manuai_mobile/features/equipment/controllers/equipment_controller.dart';
import 'package:manuai_mobile/features/equipment/models/equipment_model.dart';
import 'package:manuai_mobile/features/equipment/repositories/equipment_repository.dart';
import 'package:manuai_mobile/features/media/controllers/media_capture_controller.dart';
import 'package:manuai_mobile/features/media/models/media_item_model.dart';
import 'package:manuai_mobile/features/media/repositories/media_repository.dart';
import 'package:manuai_mobile/features/media/views/media_capture_screen.dart';
import 'package:manuai_mobile/features/media/views/widgets/media_upload_modal.dart';
import 'package:manuai_mobile/features/tasks/controllers/task_controller.dart';
import 'package:manuai_mobile/features/tasks/repositories/task_repository.dart';

class MockChatRepository extends Mock implements ChatRepository {}
class MockEquipmentRepository extends Mock implements EquipmentRepository {}
class MockTaskRepository extends Mock implements TaskRepository {}
class MockMediaRepository extends Mock implements MediaRepository {}
class MockLocalCacheService extends Mock implements LocalCacheService {}
class MockImagePicker extends Mock implements ImagePicker {}

class TestMediaCaptureController extends MediaCaptureController {
  TestMediaCaptureController() : super(MockMediaRepository()) {
    state = const MediaCaptureState(
      isInitializing: false,
      isCameraInitialized: false,
      cameraErrorMessage:
          'Optical sensor standby: test runner has no physical camera hardware.',
    );
  }

  @override
  Future<void> initCamera() async {}
}

class _TestAuthController extends Notifier<AuthState> implements AuthController {
  final AuthState initialState;
  _TestAuthController(this.initialState);

  @override
  AuthState build() => initialState;

  @override
  Future<void> checkAuthStatus() async {}

  @override
  Future<UserModel?> refreshUserProfile() async => null;

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
  void clearError() {}

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

class _TestChatController extends Notifier<ChatState> implements ChatController {
  final ChatState initialState;
  _TestChatController(this.initialState);

  @override
  ChatState build() => initialState;

  @override
  void startNewConsultation({EquipmentModel? equipment}) {
    state = ChatState(selectedEquipment: equipment);
  }

  @override
  Future<void> selectConversation(ConversationModel conv) async {
    state = state.copyWith(activeConversation: () => conv);
  }

  @override
  void setSelectedEquipment(EquipmentModel? equipment) {
    state = state.copyWith(selectedEquipment: () => equipment);
  }

  @override
  void toggleOfflineMode() {
    state = state.copyWith(isOfflineMode: !state.isOfflineMode);
  }

  @override
  Future<bool> downloadAreaPack(String equipmentId) async => true;

  @override
  void setActiveComponentContext(dynamic context) {}

  @override
  void clearActiveComponentContext() {}

  @override
  void clearSendingError() {
    state = state.copyWith(sendingError: () => null);
  }

  @override
  Future<void> openExplodedViewForMachine(EquipmentModel machine) async {
    setSelectedEquipment(machine);
  }

  @override
  Future<void> sendMessage(String text) async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockChatRepository mockChatRepository;
  late MockEquipmentRepository mockEquipmentRepository;
  late MockTaskRepository mockTaskRepository;
  late MockMediaRepository mockMediaRepository;
  late MockLocalCacheService mockLocalCache;
  late MockImagePicker mockImagePicker;

  const testUser = UserModel(
    id: 'u-eng-1',
    name: 'Devin Vance',
    email: 'engineer@plant.io',
    role: 'engineer',
  );

  const testEquipment = EquipmentModel(
    id: 'eq-p102',
    name: 'Slurry Pump P-102',
    type: 'Centrifugal Pump',
    model: 'SP-400X',
  );

  setUp(() {
    mockChatRepository = MockChatRepository();
    mockEquipmentRepository = MockEquipmentRepository();
    mockTaskRepository = MockTaskRepository();
    mockMediaRepository = MockMediaRepository();
    mockLocalCache = MockLocalCacheService();
    mockImagePicker = MockImagePicker();

    when(() => mockTaskRepository.getTasks()).thenAnswer((_) async => []);
    when(() => mockChatRepository.getConversations()).thenAnswer((_) async => []);
    when(() => mockEquipmentRepository.getEquipment()).thenAnswer((_) async => [testEquipment]);
  });

  Widget buildChatScreenWrapper({
    ChatState? initialChatState,
  }) {
    return ProviderScope(
      overrides: [
        chatRepositoryProvider.overrideWithValue(mockChatRepository),
        equipmentRepositoryProvider.overrideWithValue(mockEquipmentRepository),
        taskRepositoryProvider.overrideWithValue(mockTaskRepository),
        mediaRepositoryProvider.overrideWithValue(mockMediaRepository),
        localCacheServiceProvider.overrideWithValue(mockLocalCache),
        mediaCaptureControllerProvider.overrideWith(
          (ref) => TestMediaCaptureController(),
        ),
        activeTasksCountProvider.overrideWithValue(0),
        authControllerProvider.overrideWith(
          () => _TestAuthController(const Authenticated(user: testUser, token: 'jwt_token')),
        ),
        if (initialChatState != null)
          chatControllerProvider.overrideWith(
            () => _TestChatController(initialChatState),
          ),
      ],
      child: MaterialApp(
        theme: AppTheme.darkTheme,
        home: const ChatScreen(),
      ),
    );
  }

  group('Chat Composer UI Cleanup & 4 Elements', () {
    testWidgets('Chat composer contains exactly 4 elements: Camera, Media Upload, Input, Send', (tester) async {
      await tester.pumpWidget(buildChatScreenWrapper());
      await tester.pumpAndSettle();

      // Camera button is present
      expect(find.byKey(const Key('composer_camera_button')), findsOneWidget);

      // Media Upload button is present
      expect(find.byKey(const Key('composer_media_upload_button')), findsOneWidget);

      // Message input field is present
      expect(find.byKey(const Key('chat_message_input')), findsOneWidget);

      // Send button is present
      expect(find.byKey(const Key('chat_send_button')), findsOneWidget);

      // Robotic-arm / equipment picker button is ABSENT from chat composer
      expect(find.byKey(const Key('pick_equipment_button')), findsNothing);

      // Old paperclip attachment button is ABSENT from chat composer
      expect(find.byKey(const Key('attach_document_button')), findsNothing);
    });

    testWidgets('Header and composer have zero pixel overflow on narrow 360x640 Android screen', (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(buildChatScreenWrapper());
      await tester.pumpAndSettle();

      // Verify no RenderFlex overflow exception
      expect(tester.takeException(), isNull);

      // Verify all AppBar icons and network telemetry are visible
      expect(find.byKey(const Key('open_drawer_button')), findsOneWidget);
      expect(find.byKey(const Key('toggle_offline_mode_button')), findsOneWidget);
      expect(find.byKey(const Key('open_glossary_button')), findsOneWidget);
      expect(find.byKey(const Key('open_diagram_button')), findsOneWidget);
      expect(find.byKey(const Key('appbar_shift_tasks_button')), findsOneWidget);
      expect(find.byKey(const Key('appbar_new_consultation_button')), findsOneWidget);

      // Verify all composer elements visible on narrow screen
      expect(find.byKey(const Key('composer_camera_button')), findsOneWidget);
      expect(find.byKey(const Key('composer_media_upload_button')), findsOneWidget);
      expect(find.byKey(const Key('chat_message_input')), findsOneWidget);
      expect(find.byKey(const Key('chat_send_button')), findsOneWidget);
    });

    testWidgets('Header and composer have zero pixel overflow on ultra-narrow 320x568 screen', (tester) async {
      tester.view.physicalSize = const Size(320, 568);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(buildChatScreenWrapper());
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byKey(const Key('toggle_offline_mode_button')), findsOneWidget);
      expect(find.byKey(const Key('composer_camera_button')), findsOneWidget);
      expect(find.byKey(const Key('composer_media_upload_button')), findsOneWidget);
      expect(find.byKey(const Key('chat_message_input')), findsOneWidget);
      expect(find.byKey(const Key('chat_send_button')), findsOneWidget);
    });

    testWidgets('Composer layout works when keyboard is open (viewInsets.bottom > 0)', (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      tester.view.viewInsets = const FakeViewPadding(bottom: 250);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);

      await tester.pumpWidget(buildChatScreenWrapper());
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byKey(const Key('composer_camera_button')), findsOneWidget);
      expect(find.byKey(const Key('composer_media_upload_button')), findsOneWidget);
      expect(find.byKey(const Key('chat_message_input')), findsOneWidget);
      expect(find.byKey(const Key('chat_send_button')), findsOneWidget);
    });

    testWidgets('Camera button in composer opens MediaCaptureScreen', (tester) async {
      await tester.pumpWidget(buildChatScreenWrapper());
      await tester.pumpAndSettle();

      final cameraBtn = find.byKey(const Key('composer_camera_button'));
      expect(cameraBtn, findsOneWidget);

      await tester.tap(cameraBtn);
      await tester.pumpAndSettle();

      // Should open MediaCaptureScreen
      expect(find.byType(MediaCaptureScreen), findsOneWidget);
    });

    testWidgets('Media Upload button opens MediaUploadModal bottom sheet', (tester) async {
      await tester.pumpWidget(buildChatScreenWrapper());
      await tester.pumpAndSettle();

      final mediaBtn = find.byKey(const Key('composer_media_upload_button'));
      expect(mediaBtn, findsOneWidget);

      await tester.tap(mediaBtn);
      await tester.pumpAndSettle();

      // Should open MediaUploadModal
      expect(find.byType(MediaUploadModal), findsOneWidget);
      expect(find.byKey(const Key('pick_photos_button')), findsOneWidget);
      expect(find.byKey(const Key('pick_video_button')), findsOneWidget);
      expect(find.byKey(const Key('submit_media_upload_button')), findsOneWidget);
    });
  });

  group('MediaUploadModal Features & Validation', () {
    testWidgets('Allows selecting multiple images and previews filename and size', (tester) async {
      final fakePhoto1 = XFile.fromData(
        Uint8List.fromList([1, 2, 3, 4]),
        path: 'bearing_crack.jpg',
        name: 'bearing_crack.jpg',
        mimeType: 'image/jpeg',
      );
      final fakePhoto2 = XFile.fromData(
        Uint8List.fromList([5, 6, 7, 8, 9]),
        path: 'seal_wear.png',
        name: 'seal_wear.png',
        mimeType: 'image/png',
      );

      when(() => mockImagePicker.pickMultiImage(
            maxWidth: any(named: 'maxWidth'),
            maxHeight: any(named: 'maxHeight'),
            imageQuality: any(named: 'imageQuality'),
            limit: any(named: 'limit'),
          )).thenAnswer((_) async => [fakePhoto1, fakePhoto2]);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            mediaRepositoryProvider.overrideWithValue(mockMediaRepository),
            localCacheServiceProvider.overrideWithValue(mockLocalCache),
            equipmentRepositoryProvider.overrideWithValue(mockEquipmentRepository),
          ],
          child: MaterialApp(
            theme: AppTheme.darkTheme,
            home: Scaffold(
              body: MediaUploadModal(
                picker: mockImagePicker,
                initialEquipment: testEquipment,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap select photos
      await tester.tap(find.byKey(const Key('pick_photos_button')));
      await tester.pumpAndSettle();

      // Verify both items appear in preview
      expect(find.byKey(const Key('selected_media_card_0')), findsOneWidget);
      expect(find.byKey(const Key('selected_media_card_1')), findsOneWidget);
      expect(find.text('bearing_crack.jpg'), findsOneWidget);
      expect(find.text('seal_wear.png'), findsOneWidget);
    });

    testWidgets('Allows removing a selected media item', (tester) async {
      final fakePhoto1 = XFile.fromData(
        Uint8List.fromList([1, 2, 3]),
        name: 'photo_1.jpg',
        mimeType: 'image/jpeg',
      );
      final fakePhoto2 = XFile.fromData(
        Uint8List.fromList([4, 5, 6]),
        name: 'photo_2.jpg',
        mimeType: 'image/jpeg',
      );

      final initialItems = [
        SelectedMediaItem(
          file: fakePhoto1,
          name: 'photo_1.jpg',
          sizeBytes: 1024,
          mimeType: 'image/jpeg',
          mediaType: 'image',
        ),
        SelectedMediaItem(
          file: fakePhoto2,
          name: 'photo_2.jpg',
          sizeBytes: 2048,
          mimeType: 'image/jpeg',
          mediaType: 'image',
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            mediaRepositoryProvider.overrideWithValue(mockMediaRepository),
            localCacheServiceProvider.overrideWithValue(mockLocalCache),
            equipmentRepositoryProvider.overrideWithValue(mockEquipmentRepository),
          ],
          child: MaterialApp(
            theme: AppTheme.darkTheme,
            home: Scaffold(
              body: MediaUploadModal(
                initialItems: initialItems,
                initialEquipment: testEquipment,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('photo_1.jpg'), findsOneWidget);
      expect(find.text('photo_2.jpg'), findsOneWidget);

      // Remove photo_1
      await tester.tap(find.byKey(const Key('remove_media_item_0')));
      await tester.pumpAndSettle();

      // photo_1 removed, only photo_2 remains
      expect(find.text('photo_1.jpg'), findsNothing);
      expect(find.text('photo_2.jpg'), findsOneWidget);
    });

    testWidgets('Rejects unsupported file format with informative error banner', (tester) async {
      final invalidFile = XFile.fromData(
        Uint8List.fromList([1, 2, 3]),
        path: 'script.exe',
        name: 'script.exe',
        mimeType: 'application/octet-stream',
      );

      when(() => mockImagePicker.pickMultiImage(
            maxWidth: any(named: 'maxWidth'),
            maxHeight: any(named: 'maxHeight'),
            imageQuality: any(named: 'imageQuality'),
            limit: any(named: 'limit'),
          )).thenAnswer((_) async => [invalidFile]);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            mediaRepositoryProvider.overrideWithValue(mockMediaRepository),
            localCacheServiceProvider.overrideWithValue(mockLocalCache),
            equipmentRepositoryProvider.overrideWithValue(mockEquipmentRepository),
          ],
          child: MaterialApp(
            theme: AppTheme.darkTheme,
            home: Scaffold(
              body: MediaUploadModal(
                picker: mockImagePicker,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('pick_photos_button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('media_upload_error_banner')), findsOneWidget);
      expect(find.textContaining('Unsupported image format'), findsOneWidget);
    });

    testWidgets('Submits selected media to MediaRepository and shows success', (tester) async {
      final fakePhoto = XFile.fromData(
        Uint8List.fromList([1, 2, 3, 4]),
        name: 'hydraulic_leak.jpg',
        mimeType: 'image/jpeg',
      );

      final initialItems = [
        SelectedMediaItem(
          file: fakePhoto,
          name: 'hydraulic_leak.jpg',
          sizeBytes: 4096,
          mimeType: 'image/jpeg',
          mediaType: 'image',
        ),
      ];

      when(() => mockMediaRepository.ingestMedia(
            fileName: any(named: 'fileName'),
            bytes: any(named: 'bytes'),
            title: any(named: 'title'),
            description: any(named: 'description'),
            equipmentId: any(named: 'equipmentId'),
            tags: any(named: 'tags'),
            onSendProgress: any(named: 'onSendProgress'),
            cancelToken: any(named: 'cancelToken'),
          )).thenAnswer((_) async => const MediaItemModel(
            id: 'media-123',
            title: 'Hydraulic Leak Inspection',
            mediaType: 'image',
            originalFilename: 'hydraulic_leak.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 4096,
            uploadedById: 'u-eng-1',
            status: 'uploaded',
          ));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            mediaRepositoryProvider.overrideWithValue(mockMediaRepository),
            localCacheServiceProvider.overrideWithValue(mockLocalCache),
            equipmentRepositoryProvider.overrideWithValue(mockEquipmentRepository),
          ],
          child: MaterialApp(
            theme: AppTheme.darkTheme,
            home: Scaffold(
              body: MediaUploadModal(
                initialItems: initialItems,
                initialEquipment: testEquipment,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Scroll to submit button and tap
      final submitBtn = find.byKey(const Key('submit_media_upload_button'));
      expect(submitBtn, findsOneWidget);
      await tester.ensureVisible(submitBtn);
      await tester.pumpAndSettle();

      await tester.tap(submitBtn);
      await tester.pump(); // Start upload

      verify(() => mockMediaRepository.ingestMedia(
            fileName: 'hydraulic_leak.jpg',
            bytes: any(named: 'bytes'),
            title: any(named: 'title'),
            description: any(named: 'description'),
            equipmentId: any(named: 'equipmentId'),
            tags: any(named: 'tags'),
            onSendProgress: any(named: 'onSendProgress'),
          )).called(1);

      await tester.pumpAndSettle();
      expect(find.byKey(const Key('media_upload_success_banner')), findsOneWidget);

      // Advance past Future.delayed timer
      await tester.pump(const Duration(milliseconds: 1500));
    });

    testWidgets('Displays upload error message when backend returns failure', (tester) async {
      final fakePhoto = XFile.fromData(
        Uint8List.fromList([1, 2, 3]),
        name: 'fault.jpg',
        mimeType: 'image/jpeg',
      );

      final initialItems = [
        SelectedMediaItem(
          file: fakePhoto,
          name: 'fault.jpg',
          sizeBytes: 2048,
          mimeType: 'image/jpeg',
          mediaType: 'image',
        ),
      ];

      when(() => mockMediaRepository.ingestMedia(
            fileName: any(named: 'fileName'),
            bytes: any(named: 'bytes'),
            title: any(named: 'title'),
            description: any(named: 'description'),
            equipmentId: any(named: 'equipmentId'),
            tags: any(named: 'tags'),
            onSendProgress: any(named: 'onSendProgress'),
            cancelToken: any(named: 'cancelToken'),
          )).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/media/ingest'),
          response: Response(
            requestOptions: RequestOptions(path: '/media/ingest'),
            statusCode: 400,
            data: {'error': {'message': 'File signature does not match declared MIME'}},
          ),
          message: 'File signature does not match declared MIME',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            mediaRepositoryProvider.overrideWithValue(mockMediaRepository),
            localCacheServiceProvider.overrideWithValue(mockLocalCache),
            equipmentRepositoryProvider.overrideWithValue(mockEquipmentRepository),
          ],
          child: MaterialApp(
            theme: AppTheme.darkTheme,
            home: Scaffold(
              body: MediaUploadModal(
                initialItems: initialItems,
                initialEquipment: testEquipment,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final submitBtn = find.byKey(const Key('submit_media_upload_button'));
      expect(submitBtn, findsOneWidget);
      await tester.ensureVisible(submitBtn);
      await tester.pumpAndSettle();

      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('media_upload_error_banner')), findsOneWidget);
      expect(find.textContaining('Upload failed'), findsOneWidget);
    });
  });
}
