import 'package:dio/dio.dart';
import '../../../core/storage/local_cache_service.dart';
import '../models/chat_message_model.dart';
import '../models/chat_response_model.dart';
import '../models/conversation_model.dart';

class ChatRepository {
  final Dio dio;
  final LocalCacheService? cache;

  ChatRepository({
    required this.dio,
    this.cache,
  });

  /// Fetches all conversations belonging to the authenticated user.
  Future<List<ConversationModel>> getConversations() async {
    try {
      final response = await dio.get('/conversations');
      final data = response.data;
      if (data is Map<String, dynamic> && data['data'] is List) {
        final list = (data['data'] as List)
            .whereType<Map<String, dynamic>>()
            .map((item) => ConversationModel.fromJson(item))
            .toList();
        if (cache != null) {
          await cache!.cacheConversations(list);
        }
        return list;
      }
      return [];
    } catch (_) {
      if (cache != null) {
        final cached = await cache!.getCachedConversations();
        if (cached.isNotEmpty) {
          return cached;
        }
      }
      rethrow;
    }
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
      final conv = ConversationModel.fromJson(data['data'] as Map<String, dynamic>);
      if (cache != null) {
        final current = await cache!.getCachedConversations();
        await cache!.cacheConversations([conv, ...current.where((c) => c.id != conv.id)]);
      }
      return conv;
    }
    throw Exception('Malformed response when creating conversation');
  }

  /// Fetches all historical messages for a specific conversation.
  Future<List<ChatMessageModel>> getMessages(String conversationId) async {
    try {
      final response = await dio.get('/conversations/$conversationId/messages');
      final data = response.data;
      if (data is Map<String, dynamic> && data['data'] is List) {
        final list = (data['data'] as List)
            .whereType<Map<String, dynamic>>()
            .map((item) => ChatMessageModel.fromJson(item))
            .toList();
        if (cache != null) {
          await cache!.cacheMessages(conversationId, list);
        }
        return list;
      }
      return [];
    } catch (_) {
      if (cache != null) {
        final cached = await cache!.getCachedMessages(conversationId);
        if (cached.isNotEmpty) {
          return cached;
        }
      }
      rethrow;
    }
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
