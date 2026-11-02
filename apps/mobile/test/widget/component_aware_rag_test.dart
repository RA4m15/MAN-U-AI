import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';
import 'package:manuai_mobile/features/chat/models/cad_component_selection_state.dart';
import 'package:manuai_mobile/features/chat/models/cad_bridge_message.dart';
import 'package:manuai_mobile/features/chat/models/chat_message_model.dart';
import 'package:manuai_mobile/features/chat/models/chat_response_model.dart';
import 'package:manuai_mobile/features/chat/models/conversation_model.dart';
import 'package:manuai_mobile/features/chat/models/exploded_view_model.dart';
import 'package:manuai_mobile/features/chat/repositories/chat_repository.dart';
import 'package:manuai_mobile/features/chat/controllers/chat_controller.dart';
import 'package:manuai_mobile/features/chat/controllers/conversation_controller.dart';
import 'package:manuai_mobile/features/chat/views/widgets/chat_composer.dart';
import 'package:manuai_mobile/features/chat/views/widgets/chat_bubble.dart';
import 'package:manuai_mobile/features/chat/views/widgets/exploded_view_chat_message.dart';
import 'package:manuai_mobile/features/chat/services/cad_viewer_bridge_service.dart';
import 'package:manuai_mobile/core/storage/local_cache_service.dart';

class MockChatRepository extends Mock implements ChatRepository {}
class MockLocalCacheService extends Mock implements LocalCacheService {}

void main() {
  setUpAll(() {
    registerFallbackValue(const ConversationModel(id: 'fallback', title: 'Fallback'));
    registerFallbackValue(const ChatMessageModel(role: 'user', content: 'Fallback'));
  });

  group('Task 5 — Mobile Component-Aware RAG Integration Tests', () {
    testWidgets('1. ChatComposer renders component context badge and handles clear', (tester) async {
      bool cleared = false;
      const selectedComponent = CadComponentSelectionState(
        machineId: 'slurry_pump_9',
        selectedPartId: 'bearing_assembly_01',
        selectedPartName: 'Bearing Assembly',
        parentId: 'rotor_assembly',
        currentStep: 2,
        totalSteps: 4,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ChatComposer(
              isSending: false,
              activeComponentContext: selectedComponent,
              onClearComponentContext: () {
                cleared = true;
              },
              onSend: (_) {},
            ),
          ),
        ),
      );

      expect(find.byKey(const Key('composer_active_component_badge')), findsOneWidget);
      expect(find.text('BEARING ASSEMBLY (rotor_assembly)'), findsOneWidget);

      final clearBtn = find.byKey(const Key('composer_clear_component_button'));
      expect(clearBtn, findsOneWidget);
      await tester.tap(clearBtn);
      await tester.pump();

      expect(cleared, isTrue);
    });

    testWidgets('2. ChatComposer hides badge when no component is selected', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ChatComposer(
              isSending: false,
              activeComponentContext: null,
              onSend: (_) {},
            ),
          ),
        ),
      );

      expect(find.byKey(const Key('composer_active_component_badge')), findsNothing);
    });

    test('3. ChatController passes active machineContext in sendMessage payload', () async {
      final mockRepo = MockChatRepository();
      final mockCache = MockLocalCacheService();

      when(() => mockCache.cacheMessages(any(), any())).thenAnswer((_) async {});
      when(() => mockCache.getCachedMessages(any())).thenAnswer((_) async => []);

      const conv = ConversationModel(
        id: 'conv_test_123',
        title: 'Slurry Pump Inspection',
        equipmentId: 'slurry_pump_9',
      );

      when(() => mockRepo.getMessages('conv_test_123')).thenAnswer((_) async => []);
      when(() => mockRepo.sendMessage(
            message: any(named: 'message'),
            conversationId: any(named: 'conversationId'),
            equipmentId: any(named: 'equipmentId'),
            machineContext: any(named: 'machineContext'),
          )).thenAnswer(
        (_) async => const ChatResponseModel(
          answer: 'Component inspected successfully based on approved manual Section 4.2.',
          citations: [],
          warningLevel: 'none',
          confidenceScore: 0.95,
          provider: 'gemini-3.8-flash',
        ),
      );

      final container = ProviderContainer(
        overrides: [
          chatRepositoryProvider.overrideWithValue(mockRepo),
          localCacheServiceProvider.overrideWithValue(mockCache),
        ],
      );
      addTearDown(container.dispose);

      final controller = container.read(chatControllerProvider.notifier);
      await controller.selectConversation(conv);

      const compState = CadComponentSelectionState(
        machineId: 'slurry_pump_9',
        selectedPartId: 'ceramic_seal_04',
        selectedPartName: 'Ceramic Mechanical Seal',
        parentId: 'shaft_housing',
        currentStep: 3,
        totalSteps: 5,
      );
      controller.setActiveComponentContext(compState);

      expect(container.read(chatControllerProvider).activeComponentContext, equals(compState));

      await controller.sendMessage('What is the maximum pressure limit for this seal?');

      final captured = verify(() => mockRepo.sendMessage(
            message: 'What is the maximum pressure limit for this seal?',
            conversationId: 'conv_test_123',
            equipmentId: 'slurry_pump_9',
            machineContext: captureAny(named: 'machineContext'),
          )).captured;

      expect(captured.isNotEmpty, isTrue);
      final ctx = captured.first as Map<String, dynamic>;
      expect(ctx['machineId'], equals('slurry_pump_9'));
      expect(ctx['selectedPartId'], equals('ceramic_seal_04'));
      expect(ctx['selectedPartName'], equals('Ceramic Mechanical Seal'));
      expect(ctx['parentAssemblyId'], equals('shaft_housing'));
      expect(ctx['currentExplosionStep'], equals(3));

      final messages = container.read(chatControllerProvider).messages;
      expect(messages.length, equals(2));
      expect(messages[0].isUser, isTrue);
      expect(messages[0].machineContext!['selectedPartId'], equals('ceramic_seal_04'));
      expect(messages[1].isAssistant, isTrue);
      expect(messages[1].machineContext!['selectedPartId'], equals('ceramic_seal_04'));
    });

    test('4. Clearing active component returns to machine-wide context', () async {
      final mockRepo = MockChatRepository();
      final mockCache = MockLocalCacheService();

      when(() => mockCache.cacheMessages(any(), any())).thenAnswer((_) async {});
      when(() => mockCache.getCachedMessages(any())).thenAnswer((_) async => []);

      const conv = ConversationModel(
        id: 'conv_test_456',
        title: 'Slurry Pump General',
        equipmentId: 'slurry_pump_9',
      );

      when(() => mockRepo.getMessages('conv_test_456')).thenAnswer((_) async => []);
      when(() => mockRepo.sendMessage(
            message: any(named: 'message'),
            conversationId: any(named: 'conversationId'),
            equipmentId: any(named: 'equipmentId'),
            machineContext: any(named: 'machineContext'),
          )).thenAnswer(
        (_) async => const ChatResponseModel(
          answer: 'General pump maintenance checks.',
          citations: [],
          warningLevel: 'none',
          confidenceScore: 0.9,
          provider: 'gemini-3.8-flash',
        ),
      );

      final container = ProviderContainer(
        overrides: [
          chatRepositoryProvider.overrideWithValue(mockRepo),
          localCacheServiceProvider.overrideWithValue(mockCache),
        ],
      );
      addTearDown(container.dispose);

      final controller = container.read(chatControllerProvider.notifier);
      await controller.selectConversation(conv);

      controller.setActiveComponentContext(const CadComponentSelectionState(
        machineId: 'slurry_pump_9',
        selectedPartId: 'impeller_01',
      ));
      controller.clearActiveComponentContext();

      expect(container.read(chatControllerProvider).activeComponentContext, isNull);

      await controller.sendMessage('What are the daily operating checks?');

      final captured = verify(() => mockRepo.sendMessage(
            message: 'What are the daily operating checks?',
            conversationId: 'conv_test_456',
            equipmentId: 'slurry_pump_9',
            machineContext: captureAny(named: 'machineContext'),
          )).captured;

      expect(captured.first, isNull);
    });

    testWidgets('5. ChatBubble displays component badge for component-aware responses', (tester) async {
      const msg = ChatMessageModel(
        role: 'assistant',
        content: 'Check radial clearance every 2,000 hours. Max wear: 0.12 mm.',
        confidenceScore: 0.92,
        machineContext: {
          'machineId': 'slurry_pump_9',
          'selectedPartId': 'bearing_assembly_01',
          'selectedPartName': 'Bearing Assembly',
        },
      );

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: ChatBubble(message: msg),
            ),
          ),
        ),
      );

      expect(find.byKey(const Key('bubble_component_badge')), findsOneWidget);
      expect(find.text('BEARING ASSEMBLY'), findsOneWidget);
      expect(find.text('Check radial clearance every 2,000 hours. Max wear: 0.12 mm.'), findsOneWidget);
    });

    testWidgets('6. ExplodedViewChatMessage notifies onComponentSelected when bridge updates', (tester) async {
      CadComponentSelectionState? capturedState;
      final bridgeService = CadViewerBridgeService(
        machineId: 'slurry_pump_9',
        initialStep: 1,
        totalSteps: 4,
      );

      const payload = ExplodedViewModel(
        machineId: 'slurry_pump_9',
        machineName: 'Industrial Slurry Pump P-102',
        title: 'Exploded View',
        description: 'Machine assembly exploded view',
        modelUrl: 'https://cdn.manuai.plant.internal/cad/slurry_pump.step',
        initialStep: 1,
        totalSteps: 4,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ExplodedViewChatMessage(
                payload: payload,
                bridgeService: bridgeService,
                onComponentSelected: (state) {
                  capturedState = state;
                },
              ),
            ),
          ),
        ),
      );

      final inbound = CadBridgeMessage(
        version: 1,
        type: 'event',
        event: 'componentSelected',
        requestId: 'req_002',
        machineId: 'slurry_pump_9',
        payload: {
          'partId': 'bearing_assembly_01',
          'partName': 'Bearing Assembly',
          'parentId': 'rotor_assembly',
          'assemblyPath': ['Root', 'rotor_assembly', 'bearing_assembly_01'],
        },
      );
      bridgeService.handleInboundRawMessage(inbound.toJsonString());
      await tester.pump();

      expect(capturedState, isNotNull);
      expect(capturedState!.selectedPartId, equals('bearing_assembly_01'));
      expect(capturedState!.selectedPartName, equals('Bearing Assembly'));
      expect(capturedState!.parentId, equals('rotor_assembly'));
    });
  });
}
