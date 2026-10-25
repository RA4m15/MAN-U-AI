import 'package:dio/dio.dart';
import '../models/chat_message_model.dart';
import '../models/chat_response_model.dart';
import '../models/conversation_model.dart';

class ChatRepository {
  final Dio dio;

  ChatRepository({required this.dio});

  /// Fetches all conversations belonging to the authenticated user.
  Future<List<ConversationModel>> getConversations() async {
    final response = await dio.get('/conversations');
    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is List) {
      return (data['data'] as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => ConversationModel.fromJson(item))
          .toList();
    }
    return [];
  }

  /// Creates a new consultation conversation.
  Future<ConversationModel> createConversation({
    String? title,
    String? equipmentId,
  }) async {
    final payload = <String, dynamic>{
      if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
      if (equipmentId != null && equipmentId.trim().isNotEmpty)
        'equipmentId': equipmentId.trim(),
    };

    final response = await dio.post('/conversations', data: payload);
    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is Map<String, dynamic>) {
      return ConversationModel.fromJson(data['data'] as Map<String, dynamic>);
    }
    throw Exception('Malformed response when creating conversation');
  }

  /// Fetches all historical messages for a specific conversation.
  Future<List<ChatMessageModel>> getMessages(String conversationId) async {
    final response = await dio.get('/conversations/$conversationId/messages');
    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is List) {
      return (data['data'] as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => ChatMessageModel.fromJson(item))
          .toList();
    }
    return [];
  }

  /// Sends a question to the industrial RAG pipeline.
  Future<ChatResponseModel> sendMessage({
    required String message,
    String? conversationId,
    String? equipmentId,
  }) async {
    final payload = <String, dynamic>{
      'message': message.trim(),
      if (conversationId != null && conversationId.trim().isNotEmpty)
        'conversationId': conversationId.trim(),
      if (equipmentId != null && equipmentId.trim().isNotEmpty)
        'equipmentId': equipmentId.trim(),
    };

    final response = await dio.post('/chat', data: payload);
    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is Map<String, dynamic>) {
      return ChatResponseModel.fromJson(data['data'] as Map<String, dynamic>);
    }
    throw Exception('Malformed response from chat endpoint');
  }
}
