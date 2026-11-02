import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/core/network/connectivity_controller.dart';
import 'package:manuai_mobile/core/network/sync_manager.dart';
import 'package:manuai_mobile/core/storage/local_cache_service.dart';
import 'package:manuai_mobile/features/auth/controllers/auth_controller.dart';
import 'package:manuai_mobile/features/auth/models/auth_state.dart';
import 'package:manuai_mobile/features/auth/models/user_model.dart';
import 'package:manuai_mobile/features/auth/repositories/auth_repository.dart';
import 'package:manuai_mobile/features/chat/controllers/chat_controller.dart';
import 'package:manuai_mobile/features/chat/controllers/conversation_controller.dart';
import 'package:manuai_mobile/features/chat/models/chat_message_model.dart';
import 'package:manuai_mobile/features/chat/models/chat_response_model.dart';
import 'package:manuai_mobile/features/chat/models/conversation_model.dart';
import 'package:manuai_mobile/features/chat/repositories/chat_repository.dart';
import 'package:manuai_mobile/features/media/repositories/media_repository.dart';
import 'package:mocktail/mocktail.dart';

class MockAuthRepository extends Mock implements AuthRepository {}
class MockChatRepository extends Mock implements ChatRepository {}
class MockMediaRepository extends Mock implements MediaRepository {}
class MockConnectivity extends Mock implements Connectivity {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const testUser = UserModel(
    id: 'usr-offline-1',
    name: 'Field Engineer',
    email: 'engineer@plant.io',
    role: 'engineer',
  );

  const adminUser = UserModel(
    id: 'usr-admin-1',
    name: 'Plant Admin',
    email: 'admin@plant.io',
    role: 'admin',
  );

  group('LocalCacheService Offline Persistence & Queues', () {
    late LocalCacheService cache;

    setUp(() {
      cache = LocalCacheService();
    });

    tearDown(() async {
      await cache.clearUserCache();
    });

    test('caches and retrieves conversations and messages correctly', () async {
      const conv = ConversationModel(
        id: 'conv-cache-1',
        title: 'Cached Pump Maintenance',
        equipmentId: 'equip-p102',
      );

      await cache.cacheConversations([conv]);
      final cachedConvs = await cache.getCachedConversations();
      expect(cachedConvs.length, equals(1));
      expect(cachedConvs.first.id, equals('conv-cache-1'));

      final msg = ChatMessageModel(
        role: 'user',
        content: 'Check pump bearing tolerance',
        createdAt: DateTime.now(),
        conversationId: 'conv-cache-1',
      );

      await cache.cacheMessages('conv-cache-1', [msg]);
      final cachedMsgs = await cache.getCachedMessages('conv-cache-1');
      expect(cachedMsgs.length, equals(1));
      expect(cachedMsgs.first.content, equals('Check pump bearing tolerance'));
    });

    test('enqueues, retrieves, and dequeues pending messages', () async {
      final pendingMsg = PendingMessage(
        id: 'pending-1',
        conversationId: 'conv-100',
        message: 'Report vibration anomaly on Conveyor Belt A61',
        equipmentId: 'equip-cb-a61',
        createdAt: DateTime.now(),
      );

      await cache.addPendingMessage(pendingMsg);
      var pendingList = await cache.getPendingMessages();
      expect(pendingList.length, equals(1));
      expect(pendingList.first.message, equals('Report vibration anomaly on Conveyor Belt A61'));

      await cache.removePendingMessage('pending-1');
      pendingList = await cache.getPendingMessages();
      expect(pendingList, isEmpty);
    });

    test('enqueues, updates status, and dequeues pending media items', () async {
      final pendingMedia = PendingMediaItem(
        id: 'media-1',
        filePath: 'memory://test_photo.jpg',
        fileName: 'test_photo.jpg',
        title: 'Bearing crack evidence',
        equipmentId: 'equip-p102',
        mediaType: 'image',
        tags: const ['crack', 'bearing'],
        createdAt: DateTime.now(),
        status: 'pending',
      );

      await cache.addPendingMedia(pendingMedia);
      var mediaList = await cache.getPendingMedia();
      expect(mediaList.length, equals(1));
      expect(mediaList.first.title, equals('Bearing crack evidence'));

      await cache.updatePendingMediaStatus('media-1', 'uploading');
      mediaList = await cache.getPendingMedia();
      expect(mediaList.first.status, equals('uploading'));

      await cache.removePendingMedia('media-1');
      mediaList = await cache.getPendingMedia();
      expect(mediaList, isEmpty);
    });

    test('caches and detects document PDF files', () async {
      final pdfBytes = [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]; // %PDF-1.4
      final path = await cache.cacheDocumentPdf('doc-p102-manual', pdfBytes);
      expect(path, isNotEmpty);

      final isCached = await cache.isDocumentPdfCached('doc-p102-manual');
      expect(isCached, isTrue);

      final notCached = await cache.isDocumentPdfCached('doc-nonexistent');
      expect(notCached, isFalse);
    });
  });

  group('ConnectivityController Network State Transitions', () {
    test('transitions through reconnecting to online on recovery', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final controller = container.read(connectivityControllerProvider.notifier);

      // Start online
      expect(container.read(connectivityControllerProvider).status, equals(NetworkStatus.online));

      // Simulate dead zone
      controller.setTestStatus(NetworkStatus.offline);
      expect(container.read(isDeadZoneProvider), isTrue);

      // Trigger reachability test mock probe returning true
      controller.mockReachabilityProbe = () async => true;
      await controller.checkReachability();

      // Should transition to reconnecting first
      expect(container.read(connectivityControllerProvider).status, equals(NetworkStatus.reconnecting));

      // Completing sync marks online
      controller.completeSync();
      expect(container.read(connectivityControllerProvider).status, equals(NetworkStatus.online));
      expect(container.read(isDeadZoneProvider), isFalse);
    });

    test('transitions to serverUnreachable when probe fails', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final controller = container.read(connectivityControllerProvider.notifier);
      controller.mockReachabilityProbe = () async => false;

      await controller.checkReachability();
      expect(container.read(connectivityControllerProvider).status, equals(NetworkStatus.serverUnreachable));
      expect(container.read(isDeadZoneProvider), isTrue);
    });
  });

  group('AuthController Offline Session Restoration (Dead-Zone Mode)', () {
    late MockAuthRepository mockAuthRepo;

    setUp(() {
      mockAuthRepo = MockAuthRepository();
      when(() => mockAuthRepo.logout()).thenAnswer((_) async {});
    });

    test('restores valid cached session within 72 hours when backend unreachable', () async {
      when(() => mockAuthRepo.getStoredToken()).thenAnswer((_) async => 'stored-valid-token');
      when(() => mockAuthRepo.getCurrentUser()).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/me'),
          type: DioExceptionType.connectionError,
        ),
      );
      when(() => mockAuthRepo.getStoredUser()).thenAnswer((_) async => testUser);
      when(() => mockAuthRepo.getLastAuthTime()).thenAnswer(
        (_) async => DateTime.now().subtract(const Duration(hours: 12)),
      );

      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(mockAuthRepo),
        ],
      );
      addTearDown(container.dispose);

      container.read(authControllerProvider.notifier);
      await Future<void>.delayed(Duration.zero);

      final state = container.read(authControllerProvider);
      expect(state, isA<Authenticated>());
      final auth = state as Authenticated;
      expect(auth.user.email, equals('engineer@plant.io'));
      expect(auth.token, equals('stored-valid-token'));
    });

    test('expires offline session if last online authentication exceeds 72 hours', () async {
      when(() => mockAuthRepo.getStoredToken()).thenAnswer((_) async => 'expired-offline-token');
      when(() => mockAuthRepo.getCurrentUser()).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/me'),
          type: DioExceptionType.connectionError,
        ),
      );
      when(() => mockAuthRepo.getStoredUser()).thenAnswer((_) async => testUser);
      when(() => mockAuthRepo.getLastAuthTime()).thenAnswer(
        (_) async => DateTime.now().subtract(const Duration(hours: 73)),
      );

      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(mockAuthRepo),
        ],
      );
      addTearDown(container.dispose);

      container.read(authControllerProvider.notifier);
      await Future<void>.delayed(Duration.zero);

      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauth = state as Unauthenticated;
      expect(unauth.errorMessage, contains('Offline session expired'));
      verify(() => mockAuthRepo.logout()).called(1);
    });

    test('rejects admin cached account in offline dead-zone restoration', () async {
      when(() => mockAuthRepo.getStoredToken()).thenAnswer((_) async => 'admin-token');
      when(() => mockAuthRepo.getCurrentUser()).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/me'),
          type: DioExceptionType.connectionError,
        ),
      );
      when(() => mockAuthRepo.getStoredUser()).thenAnswer((_) async => adminUser);
      when(() => mockAuthRepo.getLastAuthTime()).thenAnswer(
        (_) async => DateTime.now().subtract(const Duration(hours: 1)),
      );

      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(mockAuthRepo),
        ],
      );
      addTearDown(container.dispose);

      container.read(authControllerProvider.notifier);
      await Future<void>.delayed(Duration.zero);

      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauth = state as Unauthenticated;
      expect(unauth.errorMessage, equals('Admin accounts must use the MAN-U-AI Admin Panel.'));
      verify(() => mockAuthRepo.logout()).called(1);
    });

    test('allows offline login with previously authenticated credentials when network unreachable', () async {
      when(() => mockAuthRepo.login(email: 'engineer@plant.io', password: 'Password123!'))
          .thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/login'),
          type: DioExceptionType.connectionError,
        ),
      );
      when(() => mockAuthRepo.getStoredUser()).thenAnswer((_) async => testUser);
      when(() => mockAuthRepo.getStoredToken()).thenAnswer((_) async => 'stored-token-123');
      when(() => mockAuthRepo.getLastAuthTime()).thenAnswer(
        (_) async => DateTime.now().subtract(const Duration(hours: 5)),
      );

      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(mockAuthRepo),
        ],
      );
      addTearDown(container.dispose);

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.login('engineer@plant.io', 'Password123!');

      expect(success, isTrue);
      final state = container.read(authControllerProvider);
      expect(state, isA<Authenticated>());
    });
  });

  group('SyncManager Offline Queue Synchronization', () {
    test('uploads pending items on reconnection and invalidates conversation cache', () async {
      final mockMedia = MockMediaRepository();
      final mockChat = MockChatRepository();
      final mockAuth = MockAuthRepository();

      when(() => mockAuth.getStoredToken()).thenAnswer((_) async => 'sync-token');
      when(() => mockAuth.getCurrentUser()).thenAnswer((_) async => testUser);
      when(() => mockChat.sendMessage(
            message: any(named: 'message'),
            conversationId: any(named: 'conversationId'),
            equipmentId: any(named: 'equipmentId'),
          )).thenAnswer((_) async => const ChatResponseModel(
            answer: 'Synced answer',
          ));

      final container = ProviderContainer(
        overrides: [
          mediaRepositoryProvider.overrideWithValue(mockMedia),
          chatRepositoryProvider.overrideWithValue(mockChat),
          authRepositoryProvider.overrideWithValue(mockAuth),
        ],
      );
      addTearDown(container.dispose);

      final cache = container.read(localCacheServiceProvider);
      await cache.addPendingMessage(PendingMessage(
        id: 'msg-sync-1',
        conversationId: 'conv-100',
        message: 'Synchronized field note',
        createdAt: DateTime.now(),
      ));

      expect((await cache.getPendingMessages()).length, equals(1));

      // Trigger sync
      final syncManager = container.read(syncManagerProvider.notifier);
      await syncManager.syncPendingData();

      // Verify pending message was dispatched and removed from queue
      verify(() => mockChat.sendMessage(
            message: 'Synchronized field note',
            conversationId: 'conv-100',
            equipmentId: any(named: 'equipmentId'),
          )).called(1);

      expect(await cache.getPendingMessages(), isEmpty);
    });
  });

  group('ChatController Dead-Zone Mode Interaction', () {
    test('enqueues pending message and returns local offline fallback when in dead zone', () async {
      final mockChat = MockChatRepository();
      final container = ProviderContainer(
        overrides: [
          chatRepositoryProvider.overrideWithValue(mockChat),
        ],
      );
      addTearDown(container.dispose);

      // Set dead zone active
      container.read(connectivityControllerProvider.notifier).setTestStatus(NetworkStatus.offline);

      final chatCtrl = container.read(chatControllerProvider.notifier);
      expect(container.read(chatControllerProvider).isOfflineMode, isTrue);

      await chatCtrl.sendMessage('What is the bearing lubrication schedule for P-102?');

      final state = container.read(chatControllerProvider);
      expect(state.messages.length, equals(2));
      expect(state.messages.first.role, equals('user'));
      expect(state.messages.last.role, equals('assistant'));
      expect(state.messages.last.isOfflineFallback, isTrue);

      // Verify pending message was queued for synchronization
      final cache = container.read(localCacheServiceProvider);
      final pending = await cache.getPendingMessages();
      expect(pending.length, equals(1));
      expect(pending.first.message, equals('What is the bearing lubrication schedule for P-102?'));
    });
  });
}
