import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/controllers/auth_controller.dart';
import '../../features/chat/controllers/conversation_controller.dart';
import '../../features/chat/repositories/chat_repository.dart';
import '../../features/media/repositories/media_repository.dart';
import '../storage/local_cache_service.dart';
import 'connectivity_controller.dart';

class SyncState {
  final bool isSyncing;
  final int pendingMediaCount;
  final int pendingMessagesCount;
  final DateTime? lastSyncTime;
  final String? lastSyncError;

  const SyncState({
    this.isSyncing = false,
    this.pendingMediaCount = 0,
    this.pendingMessagesCount = 0,
    this.lastSyncTime,
    this.lastSyncError,
  });

  SyncState copyWith({
    bool? isSyncing,
    int? pendingMediaCount,
    int? pendingMessagesCount,
    DateTime? lastSyncTime,
    String? lastSyncError,
  }) {
    return SyncState(
      isSyncing: isSyncing ?? this.isSyncing,
      pendingMediaCount: pendingMediaCount ?? this.pendingMediaCount,
      pendingMessagesCount:
          pendingMessagesCount ?? this.pendingMessagesCount,
      lastSyncTime: lastSyncTime ?? this.lastSyncTime,
      lastSyncError: lastSyncError ?? this.lastSyncError,
    );
  }
}

final syncManagerProvider = NotifierProvider<SyncManager, SyncState>(() {
  return SyncManager();
});

class SyncManager extends Notifier<SyncState> {
  late final LocalCacheService _cache;
  late final MediaRepository _mediaRepo;
  late final ChatRepository _chatRepo;

  @override
  SyncState build() {
    _cache = ref.watch(localCacheServiceProvider);
    _mediaRepo = ref.watch(mediaRepositoryProvider);
    _chatRepo = ref.watch(chatRepositoryProvider);

    // Listen to network transitions into reconnecting
    ref.listen<NetworkState>(connectivityControllerProvider, (prev, next) {
      if (next.status == NetworkStatus.reconnecting && !state.isSyncing) {
        syncPendingData();
      }
    });

    // Refresh pending counts
    Future.microtask(() => refreshPendingCounts());

    return const SyncState();
  }

  Future<void> refreshPendingCounts() async {
    final pendingMedia = await _cache.getPendingMedia();
    final pendingMsgs = await _cache.getPendingMessages();
    state = state.copyWith(
      pendingMediaCount: pendingMedia.length,
      pendingMessagesCount: pendingMsgs.length,
    );
  }

  Future<void> syncPendingData() async {
    if (state.isSyncing) return;
    state = state.copyWith(isSyncing: true, lastSyncError: null);

    try {
      // 1. Re-validate authentication session & permissions via /auth/me
      await ref.read(authControllerProvider.notifier).refreshUserProfile();

      // 2. Upload pending offline media (inspection photos & videos)
      final pendingMedia = await _cache.getPendingMedia();
      for (final item in pendingMedia) {
        final file = File(item.filePath);
        if (await file.exists()) {
          try {
            final bytes = await file.readAsBytes();
            await _mediaRepo.ingestMedia(
              fileName: item.fileName,
              bytes: bytes,
              title: item.title,
              description: item.description,
              equipmentId: item.equipmentId,
              tags: item.tags,
            );
            // Ingest succeeded, remove from pending queue
            await _cache.removePendingMedia(item.id);
          } catch (e) {
            // Keep in queue for next sync retry
            await _cache.updatePendingMediaStatus(item.id, 'failed: $e');
          }
        } else {
          // File was deleted or moved, remove invalid record
          await _cache.removePendingMedia(item.id);
        }
      }

      // 3. Dispatch queued offline messages
      final pendingMessages = await _cache.getPendingMessages();
      for (final msg in pendingMessages) {
        try {
          await _chatRepo.sendMessage(
            message: msg.message,
            conversationId: msg.conversationId,
            equipmentId: msg.equipmentId,
          );
          await _cache.removePendingMessage(msg.id);
        } catch (_) {
          // If sending fails, retain in pending queue
        }
      }

      // 4. Invalidate & refresh cached active queries
      ref.invalidate(conversationListProvider);

      state = state.copyWith(
        isSyncing: false,
        lastSyncTime: DateTime.now(),
      );

      await refreshPendingCounts();

      // Notify connectivity controller that sync completed successfully
      ref.read(connectivityControllerProvider.notifier).completeSync();
    } catch (e) {
      state = state.copyWith(
        isSyncing: false,
        lastSyncError: e.toString(),
      );
      // Even if sync encountered partial errors, transition to online so user can interact
      ref.read(connectivityControllerProvider.notifier).completeSync();
    }
  }
}
