import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/controllers/auth_controller.dart';
import '../models/conversation_model.dart';
import '../repositories/chat_repository.dart';

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return ChatRepository(dio: dio);
});

final conversationListProvider =
    AsyncNotifierProvider<ConversationListController, List<ConversationModel>>(
  ConversationListController.new,
);

class ConversationListController extends AsyncNotifier<List<ConversationModel>> {
  late final ChatRepository _repository;

  @override
  Future<List<ConversationModel>> build() async {
    _repository = ref.watch(chatRepositoryProvider);
    return _fetchConversations();
  }

  Future<List<ConversationModel>> _fetchConversations() async {
    return await _repository.getConversations();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchConversations());
  }

  Future<ConversationModel> createConversation({
    String? title,
    String? equipmentId,
  }) async {
    final newConv = await _repository.createConversation(
      title: title,
      equipmentId: equipmentId,
    );

    final currentList = state.asData?.value ?? [];
    state = AsyncData([newConv, ...currentList]);
    return newConv;
  }
}
