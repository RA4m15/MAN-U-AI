import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/connectivity_controller.dart';
import '../../../core/storage/local_cache_service.dart';
import '../../equipment/controllers/equipment_controller.dart';
import '../../equipment/models/equipment_model.dart';
import '../../offline/services/offline_area_storage.service.dart';
import '../models/chat_message_model.dart';
import '../models/cad_component_selection_state.dart';
import '../models/conversation_model.dart';
import '../repositories/chat_repository.dart';
import 'conversation_controller.dart';

class ChatState {
  final ConversationModel? activeConversation;
  final EquipmentModel? selectedEquipment;
  final List<ChatMessageModel> messages;
  final bool isLoadingHistory;
  final bool isSending;
  final String? historyError;
  final String? sendingError;
  final bool isOfflineMode;
  final CadComponentSelectionState? activeComponentContext;

  const ChatState({
    this.activeConversation,
    this.selectedEquipment,
    this.messages = const [],
    this.isLoadingHistory = false,
    this.isSending = false,
    this.historyError,
    this.sendingError,
    this.isOfflineMode = false,
    this.activeComponentContext,
  });

  ChatState copyWith({
    ConversationModel? Function()? activeConversation,
    EquipmentModel? Function()? selectedEquipment,
    List<ChatMessageModel>? messages,
    bool? isLoadingHistory,
    bool? isSending,
    String? Function()? historyError,
    String? Function()? sendingError,
    bool? isOfflineMode,
    CadComponentSelectionState? Function()? activeComponentContext,
  }) {
    return ChatState(
      activeConversation: activeConversation != null
          ? activeConversation()
          : this.activeConversation,
      selectedEquipment: selectedEquipment != null
          ? selectedEquipment()
          : this.selectedEquipment,
      messages: messages ?? this.messages,
      isLoadingHistory: isLoadingHistory ?? this.isLoadingHistory,
      isSending: isSending ?? this.isSending,
      historyError: historyError != null ? historyError() : this.historyError,
      sendingError: sendingError != null ? sendingError() : this.sendingError,
      isOfflineMode: isOfflineMode ?? this.isOfflineMode,
      activeComponentContext: activeComponentContext != null
          ? activeComponentContext()
          : this.activeComponentContext,
    );
  }
}

final chatControllerProvider =
    NotifierProvider<ChatController, ChatState>(ChatController.new);

class ChatController extends Notifier<ChatState> {
  late ChatRepository _chatRepository;

  @override
  ChatState build() {
    _chatRepository = ref.watch(chatRepositoryProvider);
    final isDeadZone = ref.watch(isDeadZoneProvider);
    return ChatState(isOfflineMode: isDeadZone);
  }

  /// Toggles Dead-Zone Offline Mode explicitly
  void toggleOfflineMode() {
    state = state.copyWith(isOfflineMode: !state.isOfflineMode);
  }

  /// Downloads and caches the Area Pack for the target equipment for offline dead zone use.
  Future<bool> downloadAreaPack(String equipmentId) async {
    try {
      final equipmentRepo = ref.read(equipmentRepositoryProvider);
      final pack = await equipmentRepo.getOfflinePack(equipmentId);
      await ref.read(offlineAreaStorageServiceProvider).saveAreaPack(pack);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Sets up an empty consultation, optionally bound to a piece of plant equipment.
  void startNewConsultation({EquipmentModel? equipment}) {
    final isDeadZone = ref.read(isDeadZoneProvider);
    state = ChatState(selectedEquipment: equipment, isOfflineMode: isDeadZone, activeComponentContext: null);
  }

  /// Selects an existing conversation and loads its historical messages.
  Future<void> selectConversation(ConversationModel conv) async {
    final isDeadZone = ref.read(isDeadZoneProvider);
    state = state.copyWith(
      activeConversation: () => conv,
      selectedEquipment: () => null,
      messages: [],
      isLoadingHistory: true,
      historyError: () => null,
      sendingError: () => null,
      isOfflineMode: isDeadZone,
    );

    try {
      final messages = await _chatRepository.getMessages(conv.id);
      state = state.copyWith(
        messages: messages,
        isLoadingHistory: false,
      );
    } catch (err) {
      final message = _parseError(err, 'Failed to load conversation history');
      state = state.copyWith(
        isLoadingHistory: false,
        historyError: () => message,
      );
    }
  }

  /// Updates the pre-selected equipment for a pending new consultation.
  void setSelectedEquipment(EquipmentModel? equipment) {
    state = state.copyWith(selectedEquipment: () => equipment);
  }

  /// Updates active 3D CAD component selection context for component-aware RAG.
  void setActiveComponentContext(CadComponentSelectionState? context) {
    state = state.copyWith(activeComponentContext: () => context);
  }

  /// Clears the active component selection context, returning to machine-wide RAG.
  void clearActiveComponentContext() {
    state = state.copyWith(activeComponentContext: () => null);
  }

  /// Clears the active sending error banner.
  void clearSendingError() {
    state = state.copyWith(sendingError: () => null);
  }

  /// Sends a question to the industrial RAG pipeline, falling back to local Dead-Zone retrieval on network loss.
  Future<void> sendMessage(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || state.isSending) {
      return;
    }

    state = state.copyWith(sendingError: () => null);

    ConversationModel? currentConv = state.activeConversation;
    final targetEquipmentId = currentConv?.equipmentId ?? state.selectedEquipment?.id;
    final Map<String, dynamic>? machineCtx = state.activeComponentContext?.toMachineContext(
      machineName: state.selectedEquipment?.name,
    );

    // 1. If Dead-Zone offline mode is active, run local retrieval immediately and queue pending
    if (state.isOfflineMode) {
      final userMsg = ChatMessageModel(
        role: 'user',
        content: trimmed,
        createdAt: DateTime.now(),
        conversationId: currentConv?.id,
        machineContext: machineCtx,
      );
      state = state.copyWith(
        messages: List<ChatMessageModel>.from(state.messages)..add(userMsg),
        isSending: true,
      );

      // Save user message in local cache pending queue for automatic sync
      await ref.read(localCacheServiceProvider).addPendingMessage(
            PendingMessage(
              id: 'pending_msg_${DateTime.now().microsecondsSinceEpoch}',
              conversationId: currentConv?.id,
              message: trimmed,
              equipmentId: targetEquipmentId,
              createdAt: DateTime.now(),
            ),
          );

      final offlineResp = await ref.read(offlineAreaStorageServiceProvider).searchOfflinePassages(
            targetEquipmentId ?? 'equip-drypix-6000',
            trimmed,
            equipmentName: state.selectedEquipment?.name ?? 'Plant Equipment',
          );

      final assistantMsg = ChatMessageModel(
        role: 'assistant',
        content: offlineResp.answer,
        citations: offlineResp.citations,
        warningLevel: offlineResp.warningLevel,
        confidenceScore: offlineResp.confidenceScore,
        provider: offlineResp.provider,
        safetyPreconditions: offlineResp.safetyPreconditions,
        suggestedTicket: offlineResp.suggestedTicket,
        createdAt: DateTime.now(),
        conversationId: currentConv?.id,
        isOfflineFallback: true,
        machineContext: machineCtx,
      );

      final newMessages = List<ChatMessageModel>.from(state.messages)..add(assistantMsg);
      state = state.copyWith(
        messages: newMessages,
        isSending: false,
      );

      if (currentConv != null) {
        await ref.read(localCacheServiceProvider).cacheMessages(
              currentConv.id,
              newMessages,
            );
      }
      return;
    }

    // 2. Ensure conversation exists before sending message
    if (currentConv == null) {
      try {
        final title = trimmed.length > 45 ? '${trimmed.substring(0, 42)}...' : trimmed;
        currentConv = await ref.read(conversationListProvider.notifier).createConversation(
              title: title,
              equipmentId: state.selectedEquipment?.id,
            );
        state = state.copyWith(activeConversation: () => currentConv);
      } catch (err) {
        final errText = _parseError(err, 'Failed to initialize consultation session');
        state = state.copyWith(sendingError: () => errText);
        return;
      }
    }

    // 3. Append user message optimistically
    final userMsg = ChatMessageModel(
      role: 'user',
      content: trimmed,
      createdAt: DateTime.now(),
      conversationId: currentConv.id,
      machineContext: machineCtx,
    );

    final updatedMessages = List<ChatMessageModel>.from(state.messages)..add(userMsg);
    state = state.copyWith(
      messages: updatedMessages,
      isSending: true,
      sendingError: () => null,
    );

    // 4. Dispatch to backend with automatic Dead-Zone fallback
    try {
      final response = await _chatRepository.sendMessage(
        message: trimmed,
        conversationId: currentConv.id,
        equipmentId: currentConv.equipmentId ?? state.selectedEquipment?.id,
        machineContext: machineCtx,
      );

      final assistantMsg = ChatMessageModel(
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        warningLevel: response.warningLevel,
        confidenceScore: response.confidenceScore,
        provider: response.provider,
        safetyPreconditions: response.safetyPreconditions,
        suggestedTicket: response.suggestedTicket,
        expandedTerms: response.expandedTerms,
        createdAt: DateTime.now(),
        conversationId: currentConv.id,
        machineContext: machineCtx,
      );

      final finalMessages = List<ChatMessageModel>.from(state.messages)..add(assistantMsg);
      state = state.copyWith(
        messages: finalMessages,
        isSending: false,
      );

      // Persist conversation messages to local cache
      await ref.read(localCacheServiceProvider).cacheMessages(
            currentConv.id,
            finalMessages,
          );

      ref.read(conversationListProvider.notifier).refresh();
    } catch (err) {
      final isConnectionIssue = err is DioException &&
          (err.type == DioExceptionType.connectionTimeout ||
              err.type == DioExceptionType.sendTimeout ||
              err.type == DioExceptionType.connectionError ||
              err.response == null);

      if (isConnectionIssue) {
        // Trigger connectivity reachability re-check
        ref.read(connectivityControllerProvider.notifier).checkReachability();

        // Queue in pending messages
        await ref.read(localCacheServiceProvider).addPendingMessage(
              PendingMessage(
                id: 'pending_msg_${DateTime.now().microsecondsSinceEpoch}',
                conversationId: currentConv.id,
                message: trimmed,
                equipmentId: targetEquipmentId,
                createdAt: DateTime.now(),
              ),
            );

        try {
          final offlineResp = await ref.read(offlineAreaStorageServiceProvider).searchOfflinePassages(
                targetEquipmentId ?? 'equip-drypix-6000',
                trimmed,
                equipmentName: state.selectedEquipment?.name ?? 'Plant Equipment',
              );

          final offlineMsg = ChatMessageModel(
            role: 'assistant',
            content: offlineResp.answer,
            citations: offlineResp.citations,
            warningLevel: offlineResp.warningLevel,
            confidenceScore: offlineResp.confidenceScore,
            provider: offlineResp.provider,
            safetyPreconditions: offlineResp.safetyPreconditions,
            suggestedTicket: offlineResp.suggestedTicket,
            createdAt: DateTime.now(),
            conversationId: currentConv.id,
            isOfflineFallback: true,
          );

          final newMessages = List<ChatMessageModel>.from(state.messages)..add(offlineMsg);
          state = state.copyWith(
            messages: newMessages,
            isSending: false,
            sendingError: () => null,
            isOfflineMode: true,
          );

          await ref.read(localCacheServiceProvider).cacheMessages(
                currentConv.id,
                newMessages,
              );
          return;
        } catch (_) {}
      }

      final errText = _parseError(err, 'Unable to get response from industrial assistant');
      state = state.copyWith(
        isSending: false,
        sendingError: () => errText,
      );
    }
  }

  String _parseError(dynamic err, String fallback) {
    if (err is DioException) {
      final statusCode = err.response?.statusCode;
      if (statusCode == 429) {
        return 'Rate limit reached. Please wait a moment before sending another question.';
      }
      if (statusCode == 403) {
        return 'Access denied. You do not have permission to query this equipment or conversation.';
      }
      if (statusCode == 404) {
        return 'Referenced conversation or equipment not found.';
      }
      if (statusCode == 400) {
        final data = err.response?.data;
        if (data is Map && data['error'] is Map && data['error']['message'] != null) {
          return data['error']['message'].toString();
        }
        return 'Invalid message parameters.';
      }
      if (statusCode != null && statusCode >= 500) {
        return 'Industrial database or RAG service encountered an error ($statusCode). Please retry shortly.';
      }
      if (err.type == DioExceptionType.receiveTimeout) {
        return 'Analysis timed out. Model generation or document retrieval took longer than expected. Please retry.';
      }
      if (err.type == DioExceptionType.connectionTimeout ||
          err.type == DioExceptionType.sendTimeout ||
          err.type == DioExceptionType.connectionError) {
        return 'Network connection to plant copilot failed or timed out. Switched to offline dead-zone cache if available.';
      }
    }
    return fallback;
  }
}
