import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/connectivity_controller.dart';
import '../../../core/storage/local_cache_service.dart';
import '../../equipment/controllers/equipment_controller.dart';
import '../../equipment/models/equipment_model.dart';
import '../../offline/services/offline_area_storage.service.dart';
import '../models/chat_message_model.dart';
import '../models/exploded_view_model.dart';
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

  bool _isExplodedViewIntent(String text) {
    final q = text.toLowerCase().trim();
    final isSpecOrTroubleshoot = RegExp(
      r'\b(spec|specification|specs|lubrication|lubricate|temperature|vibration|pressure|torque|clearance|troubleshoot|procedure|oil|grease|schedule|interval|frequency|why|how much|how do|what is the (torque|temp|oil|pressure|spec|clearance))\b',
      caseSensitive: false,
    ).hasMatch(q);

    final isExplicit3D = RegExp(
      r'\b(exploded[\s-]view|explode\b.*(assembly|machine|model|view)|open\b.*3d|show\b.*3d|view\b.*3d|load\b.*3d|launch\b.*3d|3d\s*(cad|model|viewer|assembly))\b',
      caseSensitive: false,
    ).hasMatch(q);

    if (isSpecOrTroubleshoot && !isExplicit3D) {
      return false;
    }

    final patterns = [
      RegExp(r'\b(exploded[\s-]view|explode\b.*(assembly|machine|model|view)|show\b.*explosion)\b', caseSensitive: false),
      RegExp(r'\b(open|show|display|load|launch|inspect|view)\b.*\b(3d\s*(model|cad|viewer|assembly|mesh)|cad\s*(model|viewer|assembly))\b', caseSensitive: false),
      RegExp(r'\b(3d\s*(model|cad|viewer|assembly))\b', caseSensitive: false),
      RegExp(r'\b(show|view|inspect|display|open)\b.*\b(internal\s*structure|machine\s*assembly|assembly\s*view|assembly\s*hierarchy)\b', caseSensitive: false),
      RegExp(r'\b(let\s+me\s+inspect\s+(this|the)\s+machine|open\s+(this|the)\s+machine\s+model|inspect\s+(this|the)\s+machine)\b', caseSensitive: false),
      RegExp(r'\b(show|open|display|inspect)\b.*\b(machine\s*components|components\s*in\s*3d)\b', caseSensitive: false),
      RegExp(r'^(show|open|view|launch)\s+(exploded\s+view|3d\s+model|cad\s+model)$', caseSensitive: false),
    ];

    return patterns.any((p) => p.hasMatch(q));
  }

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

      if (_isExplodedViewIntent(trimmed)) {
        final targetEq = state.selectedEquipment;
        final bool hasCad = targetEq?.hasCadModel ?? true;
        final mId = targetEq?.id ?? 'machine_001';
        final mName = targetEq?.name ?? 'Industrial Slurry Pump P-102';

        final offlineExpView = ExplodedViewModel(
          machineId: mId,
          machineName: mName,
          modelUrl: hasCad ? (targetEq?.cadModel?.storageReference ?? '/cad/models/slurry_pump_p102.step') : '',
          title: '$mName — ${hasCad ? "3D Interactive Exploded View" : "CAD Model Pending"}',
          description: hasCad
              ? 'Interactive 3D assembly loaded in offline mode. Use step controls to inspect exploded stages.'
              : 'CAD model pending upload. Ingest a valid .STEP file to view 3D assembly.',
          conversationId: currentConv?.id,
          initialStep: hasCad ? 1 : 0,
          totalSteps: hasCad ? 4 : 0,
          isCadPending: !hasCad,
          referenceImage: targetEq?.referenceImage,
          documentation: targetEq?.documentation ?? [],
        );

        final assistantMsg = ChatMessageModel(
          role: 'assistant',
          content: hasCad
              ? 'Displaying interactive 3D exploded view for $mName (Offline Mode).'
              : 'CAD model pending for $mName. An interactive 3D assembly is not yet available for this equipment.',
          createdAt: DateTime.now(),
          conversationId: currentConv?.id,
          isOfflineFallback: true,
          messageType: 'exploded_view',
          explodedView: offlineExpView,
          machineContext: machineCtx ?? {'machineId': mId, 'machineName': mName},
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
        messageType: response.messageType,
        explodedView: response.explodedView,
        machineContext: response.machineContext ?? machineCtx,
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

/// Opens an interactive 3D exploded view for the specified machine directly in chat.
  /// Does not terminate or reset previous conversation history.
  Future<void> openExplodedViewForMachine(EquipmentModel machine) async {
    state = state.copyWith(selectedEquipment: () => machine);

    ConversationModel? currentConv = state.activeConversation;
    if (currentConv == null) {
      try {
        currentConv = await ref.read(conversationListProvider.notifier).createConversation(
              title: '${machine.name} 3D Exploration',
              equipmentId: machine.id,
            );
        state = state.copyWith(activeConversation: () => currentConv);
      } catch (_) {
        // Fallback for offline/unreachable consultation
      }
    }

    final bool hasCad = machine.hasCadModel;
    final String modelUrl = (machine.cadModel?.storageReference != null && machine.cadModel!.storageReference!.isNotEmpty)
        ? machine.cadModel!.storageReference!
        : (hasCad ? '/cad/models/slurry_pump_p102.step' : '');

    final expView = ExplodedViewModel(
      machineId: machine.id,
      machineName: machine.name,
      modelUrl: modelUrl,
      title: hasCad
          ? '${machine.name} — Interactive 3D Exploded View'
          : '${machine.name} — CAD Model Pending',
      description: hasCad
          ? 'Interactive 3D assembly loaded. Use step controls to inspect exploded stages or tap components for specifications.'
          : 'CAD model for this equipment has not been ingested yet. An actual CAD assembly (.STEP/.STP/.IGES) must be uploaded to generate 3D exploded views.',
      conversationId: currentConv?.id,
      initialStep: hasCad ? 1 : 0,
      totalSteps: hasCad ? 4 : 0,
      isCadPending: !hasCad,
      referenceImage: machine.referenceImage,
      documentation: machine.documentation,
    );

    final assistantMsg = ChatMessageModel(
      id: 'exploded_${DateTime.now().microsecondsSinceEpoch}',
      role: 'assistant',
      content: hasCad
          ? 'Displaying interactive 3D exploded view for ${machine.name}. You can navigate through sequential assembly stages, inspect individual components, or ask technical questions about any highlighted part.'
          : 'CAD model pending for ${machine.name}. An interactive 3D assembly is not yet available for this equipment. Upload an authoritative CAD model (.STEP/.STP/.IGES) to enable exploded-view inspection.',
      createdAt: DateTime.now(),
      conversationId: currentConv?.id,
      messageType: 'exploded_view',
      explodedView: expView,
      machineContext: {
        'machineId': machine.id,
        'machineName': machine.name,
      },
    );

    final newMessages = List<ChatMessageModel>.from(state.messages)..add(assistantMsg);
    state = state.copyWith(
      messages: newMessages,
      isSending: false,
      sendingError: () => null,
    );

    if (currentConv != null) {
      await ref.read(localCacheServiceProvider).cacheMessages(
            currentConv.id,
            newMessages,
          );
    }
  }
}
