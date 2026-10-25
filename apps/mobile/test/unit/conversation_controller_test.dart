import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:manuai_mobile/features/chat/controllers/conversation_controller.dart';
import 'package:manuai_mobile/features/chat/models/conversation_model.dart';
import 'package:manuai_mobile/features/chat/repositories/chat_repository.dart';

class MockChatRepository extends Mock implements ChatRepository {}

void main() {
  late MockChatRepository mockRepository;
  late ProviderContainer container;

  const initialList = [
    ConversationModel(id: 'c1', title: 'Consultation 1'),
    ConversationModel(id: 'c2', title: 'Consultation 2'),
  ];

  setUp(() {
    mockRepository = MockChatRepository();
    when(() => mockRepository.getConversations())
        .thenAnswer((_) async => initialList);

    container = ProviderContainer(
      overrides: [
        chatRepositoryProvider.overrideWithValue(mockRepository),
      ],
    );
  });

  tearDown(() {
    container.dispose();
  });

  group('ConversationListController', () {
    test('loads conversation list on initialization', () async {
      final conversations = await container.read(conversationListProvider.future);
      expect(conversations.length, equals(2));
      expect(conversations[0].id, equals('c1'));
    });

    test('createConversation creates and prepends to the existing list', () async {
      const createdConv = ConversationModel(
        id: 'c-new',
        title: 'New Investigation',
        equipmentId: 'eq-10',
      );

      when(() => mockRepository.createConversation(
            title: any(named: 'title'),
            equipmentId: any(named: 'equipmentId'),
          )).thenAnswer((_) async => createdConv);

      // Ensure initial load is settled
      await container.read(conversationListProvider.future);

      final controller = container.read(conversationListProvider.notifier);
      final result = await controller.createConversation(
        title: 'New Investigation',
        equipmentId: 'eq-10',
      );

      expect(result.id, equals('c-new'));

      final currentList = container.read(conversationListProvider).asData?.value;
      expect(currentList?.length, equals(3));
      expect(currentList?.first.id, equals('c-new'));
    });

    test('refresh re-fetches conversations from repository', () async {
      await container.read(conversationListProvider.future);

      final updatedList = [
        const ConversationModel(id: 'c-fresh', title: 'Fresh Conversation'),
      ];
      when(() => mockRepository.getConversations())
          .thenAnswer((_) async => updatedList);

      final controller = container.read(conversationListProvider.notifier);
      await controller.refresh();

      final currentList = container.read(conversationListProvider).asData?.value;
      expect(currentList?.length, equals(1));
      expect(currentList?.first.id, equals('c-fresh'));
    });
  });
}
