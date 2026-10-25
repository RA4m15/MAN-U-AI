import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../equipment/models/equipment_model.dart';
import '../models/chat_message_model.dart';
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

  const ChatState({
    this.activeConversation,
    this.selectedEquipment,
    this.messages = const [],
    this.isLoadingHistory = false,
    this.isSending = false,
    this.historyError,
    this.sendingError,
  });

  ChatState copyWith({
    ConversationModel? Function()? activeConversation,
    EquipmentModel? Function()? selectedEquipment,
    List<ChatMessageModel>? messages,
    bool? isLoadingHistory,
    bool? isSending,
    String? Function()? historyError,
    String? Function()? sendingError,
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
    );
  }
}

final chatControllerProvider =
    NotifierProvider<ChatController, ChatState>(ChatController.new);

class ChatController extends Notifier<ChatState> {
  late final ChatRepository _chatRepository;

  @override
  ChatState build() {
    _chatRepository = ref.watch(chatRepositoryProvider);
    return const ChatState();
  }

  /// Sets up an empty consultation, optionally bound to a piece of plant equipment.
  void startNewConsultation({EquipmentModel? equipment}) {
    state = ChatState(selectedEquipment: equipment);
  }

  /// Selects an existing conversation and loads its historical messages.
  Future<void> selectConversation(ConversationModel conv) async {
    state = state.copyWith(
      activeConversation: () => conv,
      selectedEquipment: () => null,
      messages: [],
      isLoadingHistory: true,
      historyError: () => null,
      sendingError: () => null,
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

  /// Clears the active sending error banner.
  void clearSendingError() {
    state = state.copyWith(sendingError: () => null);
  }

  /// Sends a question to the industrial RAG pipeline.
  /// Enforces duplicate-submit prevention and creates conversation if needed.
  Future<void> sendMessage(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || state.isSending) {
      return;
    }

    // Clear previous error
    state = state.copyWith(sendingError: () => null);

    ConversationModel? currentConv = state.activeConversation;

    // 1. Ensure conversation exists before sending message
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

    // 2. Append user message optimistically
    final userMsg = ChatMessageModel(
      role: 'user',
      content: trimmed,
      createdAt: DateTime.now(),
      conversationId: currentConv.id,
    );

    final updatedMessages = List<ChatMessageModel>.from(state.messages)..add(userMsg);
    state = state.copyWith(
      messages: updatedMessages,
      isSending: true,
      sendingError: () => null,
    );

    // 3. Dispatch to backend
    try {
      final response = await _chatRepository.sendMessage(
        message: trimmed,
        conversationId: currentConv.id,
        equipmentId: currentConv.equipmentId ?? state.selectedEquipment?.id,
      );

      final assistantMsg = ChatMessageModel(
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        warningLevel: response.warningLevel,
        confidenceScore: response.confidenceScore,
        provider: response.provider,
        createdAt: DateTime.now(),
        conversationId: currentConv.id,
      );

      state = state.copyWith(
        messages: List<ChatMessageModel>.from(state.messages)..add(assistantMsg),
        isSending: false,
      );

      // Refresh list in background to update lastMessageAt
      ref.read(conversationListProvider.notifier).refresh();
    } catch (err) {
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
        return 'Network connection to plant copilot failed or timed out. Please check your connectivity or server address.';
      }
    }
    return fallback;
  }
}
