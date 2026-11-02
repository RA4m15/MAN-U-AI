import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:manuai_mobile/core/network/connectivity_controller.dart';
import 'package:manuai_mobile/core/storage/local_cache_service.dart';
import 'package:manuai_mobile/core/theme/app_theme.dart';
import 'package:manuai_mobile/features/chat/controllers/chat_controller.dart';
import 'package:manuai_mobile/features/chat/controllers/conversation_controller.dart';
import 'package:manuai_mobile/features/chat/models/chat_message_model.dart';
import 'package:manuai_mobile/features/chat/models/chat_response_model.dart';
import 'package:manuai_mobile/features/chat/models/conversation_model.dart';
import 'package:manuai_mobile/features/chat/models/exploded_view_model.dart';
import 'package:manuai_mobile/features/chat/repositories/chat_repository.dart';
import 'package:manuai_mobile/features/chat/views/widgets/chat_bubble.dart';
import 'package:manuai_mobile/features/chat/views/widgets/exploded_view_chat_message.dart';
import 'package:manuai_mobile/features/equipment/controllers/equipment_controller.dart';
import 'package:manuai_mobile/features/equipment/models/equipment_model.dart';
import 'package:manuai_mobile/features/equipment/views/machine_catalog_screen.dart';

class MockChatRepository extends Mock implements ChatRepository {}
class MockLocalCacheService extends Mock implements LocalCacheService {}

void main() {
  setUpAll(() {
    registerFallbackValue(const ConversationModel(id: 'conv-fallback', title: 'Fallback'));
    registerFallbackValue(const ChatMessageModel(role: 'user', content: 'Fallback'));
  });

  group('Critical Fix: Direct Exploded View Accessibility & Intent Handling', () {
    testWidgets('1. openExplodedViewForMachine creates structured exploded_view message without terminating conversation', (tester) async {
      final mockRepo = MockChatRepository();
      final mockCache = MockLocalCacheService();

      when(() => mockCache.cacheMessages(any(), any())).thenAnswer((_) async {});
      when(() => mockCache.getCachedMessages(any())).thenAnswer((_) async => []);

      final container = ProviderContainer(
        overrides: [
          isDeadZoneProvider.overrideWithValue(false),
          chatRepositoryProvider.overrideWithValue(mockRepo),
          localCacheServiceProvider.overrideWithValue(mockCache),
        ],
      );

      final controller = container.read(chatControllerProvider.notifier);

      const availableMachine = EquipmentModel(
        id: 'machine_001',
        name: 'Industrial Slurry Pump P-102',
        type: 'Slurry Pump',
        cadModel: CadModelInfo(
          available: true,
          format: 'STEP',
          storageReference: '/cad/models/slurry_pump_p102.step',
        ),
      );

      // Open exploded view for available machine
      await controller.openExplodedViewForMachine(availableMachine);

      final state = container.read(chatControllerProvider);
      expect(state.selectedEquipment?.id, equals('machine_001'));
      expect(state.messages.length, equals(1));

      final msg = state.messages.first;
      expect(msg.isExplodedView, isTrue);
      expect(msg.messageType, equals('exploded_view'));
      expect(msg.explodedView, isNotNull);
      expect(msg.explodedView!.machineId, equals('machine_001'));
      expect(msg.explodedView!.isCadPending, isFalse);
      expect(msg.explodedView!.modelUrl, contains('slurry_pump_p102.step'));
      expect(msg.explodedView!.totalSteps, equals(4));

      // Subsequent pending machine call does NOT wipe history, appends new message
      const pendingMachine = EquipmentModel(
        id: 'machine_002',
        name: 'CAT Generator Set',
        type: 'Power Generator',
        cadModel: CadModelInfo(available: false),
      );

      await controller.openExplodedViewForMachine(pendingMachine);

      final updatedState = container.read(chatControllerProvider);
      expect(updatedState.messages.length, equals(2));

      final pendingMsg = updatedState.messages[1];
      expect(pendingMsg.isExplodedView, isTrue);
      expect(pendingMsg.explodedView!.isCadPending, isTrue);
      expect(pendingMsg.explodedView!.modelUrl, isEmpty);
      expect(pendingMsg.content, contains('CAD model pending'));
    });

    testWidgets('2. ChatBubble renders ExplodedViewChatMessage when messageType is exploded_view', (tester) async {
      final msg = ChatMessageModel(
        id: 'msg-exp-01',
        role: 'assistant',
        content: 'Displaying 3D exploded view.',
        messageType: 'exploded_view',
        explodedView: const ExplodedViewModel(
          machineId: 'machine_001',
          machineName: 'Industrial Slurry Pump P-102',
          modelUrl: '/cad/models/slurry_pump_p102.step',
          title: 'Industrial Slurry Pump P-102 — Interactive 3D Exploded View',
          description: 'Interactive assembly loaded.',
          initialStep: 1,
          totalSteps: 4,
          isCadPending: false,
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: Scaffold(
              body: SingleChildScrollView(
                child: ChatBubble(message: msg),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(ExplodedViewChatMessage), findsOneWidget);
      expect(find.byKey(const Key('exploded_view_message_msg-exp-01')), findsOneWidget);
      expect(find.text('Industrial Slurry Pump P-102'.toUpperCase()), findsWidgets);
      expect(find.byKey(const Key('cad_next_stage_button')), findsOneWidget);
      expect(find.byKey(const Key('cad_prev_stage_button')), findsOneWidget);
      expect(find.byKey(const Key('cad_reset_stage_button')), findsOneWidget);
    });

    testWidgets('3. MachineCatalogScreen cards provide dedicated EXPLORE 3D MACHINE action', (tester) async {
      final sampleMachines = [
        const EquipmentModel(
          id: 'machine_001',
          name: 'Industrial Slurry Pump P-102',
          type: 'Rotating Equipment',
          category: 'Pumping',
          referenceImage: 'assets/images/machines/machine_slurry_pump.jpg',
          cadModel: CadModelInfo(available: true, storageReference: '/cad/models/slurry_pump_p102.step'),
        ),
        const EquipmentModel(
          id: 'machine_002',
          name: 'CAT Generator Set',
          type: 'Power Equipment',
          category: 'Generation',
          referenceImage: 'assets/images/machines/machine_cat_generator.jpg',
          cadModel: CadModelInfo(available: false),
        ),
      ];

      final mockRepo = MockChatRepository();
      final mockCache = MockLocalCacheService();

      when(() => mockCache.cacheMessages(any(), any())).thenAnswer((_) async {});
      when(() => mockCache.getCachedMessages(any())).thenAnswer((_) async => []);

      final container = ProviderContainer(
        overrides: [
          isDeadZoneProvider.overrideWithValue(false),
          chatRepositoryProvider.overrideWithValue(mockRepo),
          localCacheServiceProvider.overrideWithValue(mockCache),
          equipmentListProvider.overrideWith((ref) async => sampleMachines),
        ],
      );

      final router = GoRouter(
        initialLocation: '/catalog',
        routes: [
          GoRoute(path: '/catalog', builder: (ctx, state) => const MachineCatalogScreen()),
          GoRoute(path: '/home', builder: (ctx, state) => const Scaffold(body: Text('ChatScreen Home'))),
        ],
      );

      await tester.binding.setSurfaceSize(const Size(800, 1400));
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp.router(
            routerConfig: router,
            theme: AppTheme.lightTheme,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify EXPLORE 3D MACHINE primary button exists on machine_001
      final exploreBtn001 = find.byKey(const Key('explore_3d_machine_machine_001'));
      expect(exploreBtn001, findsOneWidget);
      expect(find.text('EXPLORE 3D MACHINE'), findsWidgets);

      // Tap EXPLORE 3D MACHINE on available machine -> opens in chat
      await tester.tap(exploreBtn001);
      await tester.pumpAndSettle();

      expect(find.text('ChatScreen Home'), findsOneWidget);
      final chatState = container.read(chatControllerProvider);
      expect(chatState.selectedEquipment?.id, equals('machine_001'));
      expect(chatState.messages.any((m) => m.isExplodedView), isTrue);
    });

    testWidgets('4. AI intent detection: sendMessage with exploded view query receives structured explodedView payload', (tester) async {
      final mockRepo = MockChatRepository();
      final mockCache = MockLocalCacheService();

      when(() => mockCache.cacheMessages(any(), any())).thenAnswer((_) async {});
      when(() => mockCache.getCachedMessages(any())).thenAnswer((_) async => []);

      when(() => mockRepo.sendMessage(
            message: any(named: 'message'),
            conversationId: any(named: 'conversationId'),
            equipmentId: any(named: 'equipmentId'),
            machineContext: any(named: 'machineContext'),
          )).thenAnswer((_) async => ChatResponseModel(
            answer: 'Displaying interactive 3D exploded view for Industrial Slurry Pump P-102.',
            messageType: 'exploded_view',
            explodedView: const ExplodedViewModel(
              machineId: 'machine_001',
              machineName: 'Industrial Slurry Pump P-102',
              modelUrl: '/cad/models/slurry_pump_p102.step',
              title: 'Industrial Slurry Pump P-102 — Interactive 3D Exploded View',
              description: 'Interactive assembly loaded.',
              initialStep: 1,
              totalSteps: 4,
              isCadPending: false,
            ),
          ));

      final container = ProviderContainer(
        overrides: [
          isDeadZoneProvider.overrideWithValue(false),
          chatRepositoryProvider.overrideWithValue(mockRepo),
          localCacheServiceProvider.overrideWithValue(mockCache),
        ],
      );

      final controller = container.read(chatControllerProvider.notifier);
      await controller.selectConversation(const ConversationModel(id: 'conv-active-01', title: 'Consultation'));
      await controller.sendMessage('Show me the exploded view');

      final state = container.read(chatControllerProvider);
      expect(state.messages.length, equals(2)); // userMsg + assistantMsg
      final assistantMsg = state.messages.last;
      expect(assistantMsg.isExplodedView, isTrue);
      expect(assistantMsg.explodedView, isNotNull);
      expect(assistantMsg.explodedView!.machineId, equals('machine_001'));
      expect(assistantMsg.explodedView!.isCadPending, isFalse);
    });
  });
}
