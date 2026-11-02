import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';
import 'package:manuai_mobile/core/network/connectivity_controller.dart';
import 'package:manuai_mobile/features/chat/models/cad_bridge_message.dart';
import 'package:manuai_mobile/features/chat/models/chat_message_model.dart';
import 'package:manuai_mobile/features/chat/models/chat_response_model.dart';
import 'package:manuai_mobile/features/chat/models/citation_model.dart';
import 'package:manuai_mobile/features/chat/models/conversation_model.dart';
import 'package:manuai_mobile/features/chat/models/exploded_view_model.dart';
import 'package:manuai_mobile/features/chat/repositories/chat_repository.dart';
import 'package:manuai_mobile/features/chat/controllers/chat_controller.dart';
import 'package:manuai_mobile/features/chat/controllers/conversation_controller.dart';
import 'package:manuai_mobile/features/chat/views/widgets/chat_composer.dart';
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

  group('Task 6 — End-to-End Acceptance Tests (20-Step Machine Exploration & RAG Workflow)', () {
    testWidgets('Machine 1 (Slurry Pump P-102): Full 20-step lifecycle test', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final mockRepo = MockChatRepository();
      final mockCache = MockLocalCacheService();

      when(() => mockCache.cacheMessages(any(), any())).thenAnswer((_) async {});
      when(() => mockCache.getCachedMessages(any())).thenAnswer((_) async => []);

      final capturedCalls = <Map<String, dynamic>>[];

      when(() => mockRepo.sendMessage(
            message: any(named: 'message'),
            conversationId: any(named: 'conversationId'),
            equipmentId: any(named: 'equipmentId'),
            machineContext: any(named: 'machineContext'),
          )).thenAnswer((invocation) async {
        final msg = invocation.namedArguments[#message] as String;
        final ctx = invocation.namedArguments[#machineContext] as Map<String, dynamic>?;
        capturedCalls.add({'message': msg, 'machineContext': ctx});

        return ChatResponseModel(
          answer: 'Verified response for $msg with context ${ctx?['selectedPartName'] ?? 'Machine-wide'}',
          citations: [
            const CitationModel(
              documentId: 'doc-slurry-pump',
              documentTitle: 'Industrial Slurry Pump P-102 Manual',
              revision: 'Rev 5.2',
              page: 4,
              section: 'Section 4.2 Maintenance',
              excerpt: 'Maintenance clearance and lubrication specifications.',
            ),
          ],
          warningLevel: 'none',
          confidenceScore: 0.95,
          provider: 'gemini-3.8-flash',
        );
      });

      final container = ProviderContainer(
        overrides: [
          isDeadZoneProvider.overrideWithValue(false),
          chatRepositoryProvider.overrideWithValue(mockRepo),
          localCacheServiceProvider.overrideWithValue(mockCache),
        ],
      );
      addTearDown(container.dispose);

      // Step 1-3: Initialize conversation for Slurry Pump P-102
      final controller = container.read(chatControllerProvider.notifier);
      const conv = ConversationModel(
        id: 'conv_slurry_01',
        title: 'Slurry Pump P-102 Exploration',
        equipmentId: 'slurry_pump_9',
      );
      when(() => mockRepo.getMessages('conv_slurry_01')).thenAnswer((_) async => []);
      await controller.selectConversation(conv);

      // Step 4-5: Create ExplodedViewChatMessage with valid STEP model payload
      final bridgeService = CadViewerBridgeService(
        machineId: 'slurry_pump_9',
        initialStep: 1,
        totalSteps: 4,
      );

      const payload = ExplodedViewModel(
        machineId: 'slurry_pump_9',
        machineName: 'Industrial Slurry Pump P-102',
        title: 'Exploded View',
        description: 'Complete 4-stage pump disassembly',
        modelUrl: 'https://cdn.manuai.plant.internal/cad/slurry_pump_p102.step',
        initialStep: 1,
        totalSteps: 4,
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: Column(
                  children: [
                    ExplodedViewChatMessage(
                      payload: payload,
                      bridgeService: bridgeService,
                      onComponentSelected: (state) {
                        controller.setActiveComponentContext(state);
                      },
                    ),
                    Consumer(
                      builder: (ctx, ref, _) {
                        final chatState = ref.watch(chatControllerProvider);
                        return ChatComposer(
                          isSending: chatState.isSending,
                          activeComponentContext: chatState.activeComponentContext,
                          onClearComponentContext: () {
                            controller.clearActiveComponentContext();
                          },
                          onSend: (text) {
                            controller.sendMessage(text);
                          },
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );

      // Step 6-7: Navigate through explosion stages forward & backward
      expect(find.byKey(const Key('cad_stage_indicator')), findsOneWidget);
      expect(find.text('STAGE 1 OF 4'), findsOneWidget);

      bridgeService.nextStep();
      await tester.pump();
      expect(bridgeService.state.currentStep, equals(2));

      bridgeService.nextStep();
      await tester.pump();
      expect(bridgeService.state.currentStep, equals(3));

      bridgeService.previousStep();
      await tester.pump();
      expect(bridgeService.state.currentStep, equals(2));

      // Step 8: Reset assembly
      bridgeService.resetExplosion();
      await tester.pump();
      expect(bridgeService.state.currentStep, equals(1));

      // Step 9-10: Select component A (Bearing Assembly)
      final selectBearingMsg = CadBridgeMessage(
        version: 1,
        type: 'event',
        event: 'componentSelected',
        requestId: 'req_b1',
        machineId: 'slurry_pump_9',
        payload: {
          'partId': 'bearing_assembly_01',
          'partName': 'Bearing Assembly',
          'parentId': 'rotor_assembly',
          'assemblyPath': ['Root', 'rotor_assembly', 'bearing_assembly_01'],
        },
      );
      bridgeService.handleInboundRawMessage(selectBearingMsg.toJsonString());
      await tester.pump();

      // Step 11: Verify Flutter receives component ID and composer displays badge
      expect(container.read(chatControllerProvider).activeComponentContext?.selectedPartId, equals('bearing_assembly_01'));
      expect(find.byKey(const Key('composer_active_component_badge')), findsOneWidget);
      expect(find.text('BEARING ASSEMBLY (rotor_assembly)'), findsOneWidget);

      // Step 12-15: Submit technical question for Bearing Assembly
      await controller.sendMessage('What is the maximum operating temperature for this bearing?');
      await tester.pump();

      expect(capturedCalls.length, equals(1));
      expect(capturedCalls[0]['message'], equals('What is the maximum operating temperature for this bearing?'));
      expect(capturedCalls[0]['machineContext']['machineId'], equals('slurry_pump_9'));
      expect(capturedCalls[0]['machineContext']['selectedPartId'], equals('bearing_assembly_01'));
      expect(capturedCalls[0]['machineContext']['selectedPartName'], equals('Bearing Assembly'));

      // Step 16: Select component B (Ceramic Mechanical Seal)
      final selectSealMsg = CadBridgeMessage(
        version: 1,
        type: 'event',
        event: 'componentSelected',
        requestId: 'req_s2',
        machineId: 'slurry_pump_9',
        payload: {
          'partId': 'ceramic_seal_04',
          'partName': 'Ceramic Mechanical Seal',
          'parentId': 'shaft_housing',
          'assemblyPath': ['Root', 'shaft_housing', 'ceramic_seal_04'],
        },
      );
      bridgeService.handleInboundRawMessage(selectSealMsg.toJsonString());
      await tester.pump();

      // Step 17-18: Verify context switched and previous component context is NOT reused
      expect(container.read(chatControllerProvider).activeComponentContext?.selectedPartId, equals('ceramic_seal_04'));
      expect(find.text('CERAMIC MECHANICAL SEAL (shaft_housing)'), findsOneWidget);

      await controller.sendMessage('What is the barrier flush pressure?');
      await tester.pump();

      expect(capturedCalls.length, equals(2));
      expect(capturedCalls[1]['message'], equals('What is the barrier flush pressure?'));
      expect(capturedCalls[1]['machineContext']['selectedPartId'], equals('ceramic_seal_04'));
      expect(capturedCalls[1]['machineContext']['selectedPartId'], isNot(equals('bearing_assembly_01')));

      // Step 19-20: Clear component selection and verify normal machine-level chat
      final clearBtn = find.byKey(const Key('composer_clear_component_button'));
      expect(clearBtn, findsOneWidget);
      await tester.ensureVisible(clearBtn);
      await tester.tap(clearBtn);
      await tester.pump();

      expect(find.byKey(const Key('composer_active_component_badge')), findsNothing);
      expect(container.read(chatControllerProvider).activeComponentContext, isNull);

      await controller.sendMessage('What are the overall startup safety procedures?');
      await tester.pump();

      expect(capturedCalls.length, equals(3));
      expect(capturedCalls[2]['message'], equals('What are the overall startup safety procedures?'));
      expect(capturedCalls[2]['machineContext'], isNull);
    });

    testWidgets('Machine 2 (Circuit Breaker CB-A61): Multi-machine isolation & component RAG test', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final mockRepo = MockChatRepository();
      final mockCache = MockLocalCacheService();

      when(() => mockCache.cacheMessages(any(), any())).thenAnswer((_) async {});
      when(() => mockCache.getCachedMessages(any())).thenAnswer((_) async => []);

      final capturedCalls = <Map<String, dynamic>>[];

      when(() => mockRepo.sendMessage(
            message: any(named: 'message'),
            conversationId: any(named: 'conversationId'),
            equipmentId: any(named: 'equipmentId'),
            machineContext: any(named: 'machineContext'),
          )).thenAnswer((invocation) async {
        final msg = invocation.namedArguments[#message] as String;
        final ctx = invocation.namedArguments[#machineContext] as Map<String, dynamic>?;
        capturedCalls.add({'message': msg, 'machineContext': ctx});

        return const ChatResponseModel(
          answer: 'Circuit breaker bottle contact wear is within acceptable limits (Rev 2.1).',
          citations: [
            CitationModel(
              documentId: 'doc-cb-a61',
              documentTitle: 'Medium Voltage Switchgear & Circuit Breaker SOP',
              revision: 'Rev 2.1',
              page: 12,
              section: 'Vacuum Interrupter Inspection',
              excerpt: 'Measure erosion gap using go/no-go gauge.',
            ),
          ],
          warningLevel: 'critical',
          confidenceScore: 0.98,
          provider: 'gemini-3.8-flash',
        );
      });

      final container = ProviderContainer(
        overrides: [
          isDeadZoneProvider.overrideWithValue(false),
          chatRepositoryProvider.overrideWithValue(mockRepo),
          localCacheServiceProvider.overrideWithValue(mockCache),
        ],
      );
      addTearDown(container.dispose);

      final controller = container.read(chatControllerProvider.notifier);
      const conv = ConversationModel(
        id: 'conv_cb_02',
        title: 'Circuit Breaker CB-A61 Maintenance',
        equipmentId: 'equip-cb-a61',
      );
      when(() => mockRepo.getMessages('conv_cb_02')).thenAnswer((_) async => []);
      await controller.selectConversation(conv);

      final bridgeService = CadViewerBridgeService(
        machineId: 'equip-cb-a61',
        initialStep: 1,
        totalSteps: 3,
      );

      const payload = ExplodedViewModel(
        machineId: 'equip-cb-a61',
        machineName: 'Vacuum Circuit Breaker CB-A61',
        title: '3D Pole Assembly',
        description: '3-stage interrupter mechanism breakdown',
        modelUrl: 'https://cdn.manuai.plant.internal/cad/breaker_cb_a61.step',
        initialStep: 1,
        totalSteps: 3,
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: Column(
                  children: [
                    ExplodedViewChatMessage(
                      payload: payload,
                      bridgeService: bridgeService,
                      onComponentSelected: (state) {
                        controller.setActiveComponentContext(state);
                      },
                    ),
                    Consumer(
                      builder: (ctx, ref, _) {
                        final chatState = ref.watch(chatControllerProvider);
                        return ChatComposer(
                          isSending: chatState.isSending,
                          activeComponentContext: chatState.activeComponentContext,
                          onClearComponentContext: () {
                            controller.clearActiveComponentContext();
                          },
                          onSend: (text) {
                            controller.sendMessage(text);
                          },
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );

      // Select vacuum interrupter
      final selectBottleMsg = CadBridgeMessage(
        version: 1,
        type: 'event',
        event: 'componentSelected',
        requestId: 'req_cb_1',
        machineId: 'equip-cb-a61',
        payload: {
          'partId': 'vacuum_interrupter_01',
          'partName': 'Vacuum Interrupter Bottle',
          'parentId': 'pole_assembly',
          'assemblyPath': ['Root', 'pole_assembly', 'vacuum_interrupter_01'],
        },
      );
      bridgeService.handleInboundRawMessage(selectBottleMsg.toJsonString());
      await tester.pump();

      expect(find.text('VACUUM INTERRUPTER BOTTLE (pole_assembly)'), findsOneWidget);

      await controller.sendMessage('How do I measure contact erosion on this bottle?');
      await tester.pump();

      expect(capturedCalls.length, equals(1));
      expect(capturedCalls[0]['machineContext']['machineId'], equals('equip-cb-a61'));
      expect(capturedCalls[0]['machineContext']['selectedPartId'], equals('vacuum_interrupter_01'));
      expect(capturedCalls[0]['machineContext']['selectedPartName'], equals('Vacuum Interrupter Bottle'));
      expect(capturedCalls[0]['machineContext']['parentAssemblyId'], equals('pole_assembly'));
    });
  });
}
