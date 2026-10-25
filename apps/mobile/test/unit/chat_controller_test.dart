import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:manuai_mobile/features/chat/controllers/chat_controller.dart';
import 'package:manuai_mobile/features/chat/controllers/conversation_controller.dart';
import 'package:manuai_mobile/features/chat/models/chat_message_model.dart';
import 'package:manuai_mobile/features/chat/models/chat_response_model.dart';
import 'package:manuai_mobile/features/chat/models/citation_model.dart';
import 'package:manuai_mobile/features/chat/models/conversation_model.dart';
import 'package:manuai_mobile/features/chat/repositories/chat_repository.dart';
import 'package:manuai_mobile/features/equipment/models/equipment_model.dart';

class MockChatRepository extends Mock implements ChatRepository {}

void main() {
  late MockChatRepository mockRepository;
  late ProviderContainer container;

  const testConversation = ConversationModel(
    id: 'conv-001',
    title: 'Slurry Pump Diagnostics',
    equipmentId: 'eq-100',
    equipmentName: 'Model SP-400X',
  );

  const testCitation = CitationModel(
    documentId: 'doc-sop-1',
    documentTitle: 'SP-400X Rebuild Manual',
    revision: 'Rev 5.2',
    page: 2,
    section: '4.2 Gland Assembly',
    excerpt: 'Torque gland retaining studs to 52 N·m in cross-diagonal sequence.',
  );

  const testEquipment = EquipmentModel(
    id: 'eq-100',
    name: 'Slurry Pump',
    type: 'Centrifugal',
    model: 'SP-400X',
  );

  setUp(() {
    mockRepository = MockChatRepository();

    when(() => mockRepository.getConversations())
        .thenAnswer((_) async => [testConversation]);

    container = ProviderContainer(
      overrides: [
        chatRepositoryProvider.overrideWithValue(mockRepository),
      ],
    );
  });

  tearDown(() {
    container.dispose();
  });

  group('ChatController.selectConversation', () {
    test('loads historical messages and updates activeConversation', () async {
      final historicalMessages = [
        const ChatMessageModel(
          id: 'm1',
          role: 'user',
          content: 'What is the torque for the studs?',
        ),
        const ChatMessageModel(
          id: 'm2',
          role: 'assistant',
          content: 'Torque studs to 52 N·m.',
          citations: [testCitation],
        ),
      ];

      when(() => mockRepository.getMessages('conv-001'))
          .thenAnswer((_) async => historicalMessages);

      final controller = container.read(chatControllerProvider.notifier);
      await controller.selectConversation(testConversation);

      final state = container.read(chatControllerProvider);
      expect(state.activeConversation?.id, equals('conv-001'));
      expect(state.isLoadingHistory, isFalse);
      expect(state.messages.length, equals(2));
      expect(state.messages[1].citations.length, equals(1));
    });

    test('sets historyError when loading messages fails', () async {
      when(() => mockRepository.getMessages('conv-001')).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/conversations/conv-001/messages'),
          type: DioExceptionType.connectionTimeout,
        ),
      );

      final controller = container.read(chatControllerProvider.notifier);
      await controller.selectConversation(testConversation);

      final state = container.read(chatControllerProvider);
      expect(state.isLoadingHistory, isFalse);
      expect(state.messages, isEmpty);
      expect(state.historyError, contains('Network connection'));
    });
  });

  group('ChatController.startNewConsultation', () {
    test('resets messages, activeConversation, and configures optional equipment context', () {
      final controller = container.read(chatControllerProvider.notifier);
      controller.startNewConsultation(equipment: testEquipment);

      final state = container.read(chatControllerProvider);
      expect(state.activeConversation, isNull);
      expect(state.messages, isEmpty);
      expect(state.selectedEquipment?.id, equals('eq-100'));
      expect(state.isSending, isFalse);
    });
  });

  group('ChatController.sendMessage', () {
    test('creates conversation on first message, appends user & assistant turns', () async {
      const createdConv = ConversationModel(
        id: 'conv-new-99',
        title: 'Check vibration limits on pump',
        equipmentId: 'eq-100',
      );

      when(() => mockRepository.createConversation(
            title: any(named: 'title'),
            equipmentId: any(named: 'equipmentId'),
          )).thenAnswer((_) async => createdConv);

      when(() => mockRepository.sendMessage(
            message: 'Check vibration limits on pump',
            conversationId: 'conv-new-99',
            equipmentId: 'eq-100',
          )).thenAnswer((_) async => const ChatResponseModel(
            answer: 'Vibration velocity must remain under 4.5 mm/s RMS under full load.',
            warningLevel: 'caution',
            confidenceScore: 0.91,
            citations: [testCitation],
          ));

      final controller = container.read(chatControllerProvider.notifier);
      controller.setSelectedEquipment(testEquipment);

      await controller.sendMessage('Check vibration limits on pump');

      final state = container.read(chatControllerProvider);
      expect(state.activeConversation?.id, equals('conv-new-99'));
      expect(state.messages.length, equals(2));
      expect(state.messages[0].isUser, isTrue);
      expect(state.messages[0].content, equals('Check vibration limits on pump'));
      expect(state.messages[1].isAssistant, isTrue);
      expect(state.messages[1].warningLevel, equals('caution'));
      expect(state.messages[1].citations.length, equals(1));
      expect(state.isSending, isFalse);

      verify(() => mockRepository.createConversation(
            title: 'Check vibration limits on pump',
            equipmentId: 'eq-100',
          )).called(1);

      verify(() => mockRepository.sendMessage(
            message: 'Check vibration limits on pump',
            conversationId: 'conv-new-99',
            equipmentId: 'eq-100',
          )).called(1);
    });

    test('enforces duplicate-submit prevention when already sending', () async {
      when(() => mockRepository.sendMessage(
            message: any(named: 'message'),
            conversationId: any(named: 'conversationId'),
            equipmentId: any(named: 'equipmentId'),
          )).thenAnswer((_) async {
        await Future<void>.delayed(const Duration(milliseconds: 50));
        return const ChatResponseModel(answer: 'Answer');
      });

      when(() => mockRepository.createConversation(
            title: any(named: 'title'),
            equipmentId: any(named: 'equipmentId'),
          )).thenAnswer((_) async => testConversation);

      final controller = container.read(chatControllerProvider.notifier);

      // Trigger first send
      final future1 = controller.sendMessage('First call');
      // Immediately trigger second send while first is in flight
      final future2 = controller.sendMessage('Duplicate call during in-flight');

      await Future.wait([future1, future2]);

      // Only 1 createConversation and 1 sendMessage should have been called
      verify(() => mockRepository.sendMessage(
            message: 'First call',
            conversationId: any(named: 'conversationId'),
            equipmentId: any(named: 'equipmentId'),
          )).called(1);
    });

    test('handles 429 rate limit error with human-friendly message', () async {
      when(() => mockRepository.createConversation(
            title: any(named: 'title'),
            equipmentId: any(named: 'equipmentId'),
          )).thenAnswer((_) async => testConversation);

      when(() => mockRepository.sendMessage(
            message: any(named: 'message'),
            conversationId: any(named: 'conversationId'),
            equipmentId: any(named: 'equipmentId'),
          )).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/chat'),
          response: Response(
            statusCode: 429,
            requestOptions: RequestOptions(path: '/chat'),
          ),
        ),
      );

      final controller = container.read(chatControllerProvider.notifier);
      await controller.sendMessage('Rapid question');

      final state = container.read(chatControllerProvider);
      expect(state.isSending, isFalse);
      expect(state.sendingError, contains('Rate limit reached'));

      // Test clearing sending error
      controller.clearSendingError();
      expect(container.read(chatControllerProvider).sendingError, isNull);
    });

    test('handles empty / insufficient evidence response correctly without citations', () async {
      when(() => mockRepository.createConversation(
            title: any(named: 'title'),
            equipmentId: any(named: 'equipmentId'),
          )).thenAnswer((_) async => testConversation);

      when(() => mockRepository.sendMessage(
            message: any(named: 'message'),
            conversationId: any(named: 'conversationId'),
            equipmentId: any(named: 'equipmentId'),
          )).thenAnswer((_) async => const ChatResponseModel(
            answer: 'I cannot find technical documentation supporting this inquiry in authorized plant manuals.',
            warningLevel: 'none',
            confidenceScore: 0.1,
            citations: [],
          ));

      final controller = container.read(chatControllerProvider.notifier);
      await controller.sendMessage('Out of scope question');

      final state = container.read(chatControllerProvider);
      expect(state.messages.length, equals(2));
      expect(state.messages[1].citations, isEmpty);
      expect(state.messages[1].content, contains('cannot find technical documentation'));
    });
  });
}
