import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/core/config/env_config.dart';
import 'package:manuai_mobile/features/chat/models/chat_message_model.dart';
import 'package:manuai_mobile/features/chat/models/exploded_view_model.dart';
import 'package:manuai_mobile/features/chat/views/widgets/chat_bubble.dart';
import 'package:manuai_mobile/features/chat/views/widgets/exploded_view_chat_message.dart';

void main() {
  group('ExplodedViewModel & ChatMessageModel Tests', () {
    test('ChatMessageModel identifies standard text message vs exploded_view message', () {
      const normalMsg = ChatMessageModel(
        role: 'assistant',
        content: 'This is a standard technical procedure response.',
      );

      expect(normalMsg.isExplodedView, isFalse);
      expect(normalMsg.messageType, equals('text'));
      expect(normalMsg.explodedView, isNull);

      const explodedPayload = ExplodedViewModel(
        machineId: 'machine_001',
        machineName: 'Industrial Slurry Pump',
        modelUrl: 'https://example.com/models/pump.step',
        title: 'Pump Disassembly Analysis',
        description: 'Explore multi-stage exploded assembly.',
      );

      const explodedMsg = ChatMessageModel(
        role: 'assistant',
        content: 'Please review the exploded 3D model below.',
        messageType: 'exploded_view',
        explodedView: explodedPayload,
      );

      expect(explodedMsg.isExplodedView, isTrue);
      expect(explodedMsg.messageType, equals('exploded_view'));
      expect(explodedMsg.explodedView?.machineId, equals('machine_001'));
      expect(explodedMsg.explodedView?.machineName, equals('Industrial Slurry Pump'));
    });

    test('ChatMessageModel.fromJson correctly deserializes structured exploded_view payload', () {
      final json = {
        'role': 'assistant',
        'content': 'Interactive 3D model generated.',
        'messageType': 'exploded_view',
        'explodedView': {
          'machineId': 'motor_002',
          'machineName': 'Servo Motor STS3215',
          'modelUrl': 'https://example.com/models/servo.step',
          'title': 'Servo Casing Assembly',
          'description': 'Disassembly stages for internal rotor inspection.',
          'initialStep': 1,
          'totalSteps': 4,
        },
      };

      final msg = ChatMessageModel.fromJson(json);
      expect(msg.isExplodedView, isTrue);
      expect(msg.explodedView?.machineId, equals('motor_002'));
      expect(msg.explodedView?.machineName, equals('Servo Motor STS3215'));
      expect(msg.explodedView?.initialStep, equals(1));
      expect(msg.explodedView?.totalSteps, equals(4));

      final serialized = msg.toJson();
      expect(serialized['messageType'], equals('exploded_view'));
      expect(serialized['explodedView'], isA<Map<String, dynamic>>());
      expect((serialized['explodedView'] as Map)['machineId'], equals('motor_002'));
    });
  });

  group('EnvConfig Security & Validation Tests', () {
    test('isValidModelUrl rejects dangerous schemes and accepts valid URLs', () {
      expect(EnvConfig.isValidModelUrl('javascript:alert(1)'), isFalse);
      expect(EnvConfig.isValidModelUrl('file:///etc/passwd'), isFalse);
      expect(EnvConfig.isValidModelUrl('data:text/html;base64,123'), isFalse);
      expect(EnvConfig.isValidModelUrl(''), isFalse);

      expect(EnvConfig.isValidModelUrl('https://example.com/models/pump.step'), isTrue);
      expect(EnvConfig.isValidModelUrl('/samples/motor-holder.step'), isTrue);
    });

    test('isAllowedViewerOrigin validates trusted origins', () {
      expect(EnvConfig.isAllowedViewerOrigin('http://localhost:5173'), isTrue);
      expect(EnvConfig.isAllowedViewerOrigin('http://10.0.2.2:5173'), isTrue);
      expect(EnvConfig.isAllowedViewerOrigin('https://man-u-ai.onrender.com/cad'), isTrue);
      expect(EnvConfig.isAllowedViewerOrigin('https://evil-untrusted-site.com'), isFalse);
    });

    test('buildCadViewerUrl encodes modelUrl query parameter securely', () {
      final url = EnvConfig.buildCadViewerUrl('https://example.com/models/pump.step?token=none');
      expect(url, contains('model=https%3A%2F%2Fexample.com%2Fmodels%2Fpump.step%3Ftoken%3Dnone'));
    });
  });

  group('ExplodedViewChatMessage Widget Tests', () {
    const payload = ExplodedViewModel(
      machineId: 'compressor_01',
      machineName: 'Turbocompressor B-01',
      modelUrl: 'https://example.com/models/compressor.step',
      title: 'Turbocompressor Multi-Stage Explosion',
      description: 'Step-by-step disassembly of rotor assembly and stator housing.',
      initialStep: 1,
      totalSteps: 4,
    );

    testWidgets('Renders machine title, machine name, stage indicators and controls', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ExplodedViewChatMessage(payload: payload),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify Title and Subtitle
      expect(find.byKey(const Key('cad_message_title')), findsOneWidget);
      expect(find.text('Turbocompressor Multi-Stage Explosion'), findsOneWidget);
      expect(find.text('TURBOCOMPRESSOR B-01'), findsOneWidget);
      expect(find.byKey(const Key('cad_message_description')), findsOneWidget);

      // Verify Stage Indicator and Progress Bar
      expect(find.byKey(const Key('cad_stage_indicator')), findsOneWidget);
      expect(find.text('STAGE 1 OF 4'), findsOneWidget);
      expect(find.byKey(const Key('cad_stage_progress_bar')), findsOneWidget);

      // Verify Navigation Controls
      expect(find.byKey(const Key('cad_prev_stage_button')), findsOneWidget);
      expect(find.byKey(const Key('cad_next_stage_button')), findsOneWidget);
      expect(find.byKey(const Key('cad_reset_stage_button')), findsOneWidget);
    });

    testWidgets('Next stage advances step counter, Prev retreats, Reset restores Stage 1', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ExplodedViewChatMessage(payload: payload),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('STAGE 1 OF 4'), findsOneWidget);

      // Click Next Stage
      await tester.tap(find.byKey(const Key('cad_next_stage_button')));
      await tester.pumpAndSettle();
      expect(find.text('STAGE 2 OF 4'), findsOneWidget);

      // Click Next Stage again
      await tester.tap(find.byKey(const Key('cad_next_stage_button')));
      await tester.pumpAndSettle();
      expect(find.text('STAGE 3 OF 4'), findsOneWidget);

      // Click Previous Stage
      await tester.tap(find.byKey(const Key('cad_prev_stage_button')));
      await tester.pumpAndSettle();
      expect(find.text('STAGE 2 OF 4'), findsOneWidget);

      // Click Reset Stage
      await tester.tap(find.byKey(const Key('cad_reset_stage_button')));
      await tester.pumpAndSettle();
      expect(find.text('STAGE 1 OF 4'), findsOneWidget);
    });

    testWidgets('Collapse toggle collapses and expands 3D viewport', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ExplodedViewChatMessage(payload: payload),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('cad_stage_indicator')), findsOneWidget);

      // Tap Collapse
      await tester.tap(find.byKey(const Key('cad_collapse_toggle_button')));
      await tester.pumpAndSettle();

      // Controls and viewport should be collapsed
      expect(find.byKey(const Key('cad_stage_indicator')), findsNothing);

      // Tap Expand
      await tester.tap(find.byKey(const Key('cad_collapse_toggle_button')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('cad_stage_indicator')), findsOneWidget);
    });

    testWidgets('Displays error container and retry button on invalid model URL', (tester) async {
      const invalidPayload = ExplodedViewModel(
        machineId: 'bad_001',
        machineName: 'Faulty Machine',
        modelUrl: 'javascript:alert(1)', // Insecure rejected URL
        title: 'Error Test',
        description: 'Should trigger error container.',
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ExplodedViewChatMessage(payload: invalidPayload),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('cad_viewer_error_container')), findsOneWidget);
      expect(find.text('3D CAD MODEL UNAVAILABLE'), findsOneWidget);
      expect(find.byKey(const Key('cad_viewer_retry_button')), findsOneWidget);
    });
  });

  group('ChatBubble Exploded View Integration Tests', () {
    testWidgets('Renders standard text message without ExplodedViewChatMessage', (tester) async {
      const textMsg = ChatMessageModel(
        role: 'assistant',
        content: 'Slurry pump cavitation symptoms include high vibration.',
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ChatBubble(message: textMsg),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Slurry pump cavitation symptoms include high vibration.'), findsOneWidget);
      expect(find.byKey(const Key('exploded_view_chat_message_card')), findsNothing);
    });

    testWidgets('Renders ExplodedViewChatMessage when messageType is exploded_view', (tester) async {
      const explodedMsg = ChatMessageModel(
        role: 'assistant',
        content: 'Review the motor assembly structure below:',
        messageType: 'exploded_view',
        explodedView: ExplodedViewModel(
          machineId: 'motor_001',
          machineName: 'High Pressure Motor',
          modelUrl: 'https://example.com/models/motor.step',
          title: 'Motor Exploded View',
          description: 'Interactive motor disassembly.',
        ),
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ChatBubble(message: explodedMsg),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Review the motor assembly structure below:'), findsOneWidget);
      expect(find.byKey(const Key('exploded_view_chat_message_card')), findsOneWidget);
      expect(find.text('Motor Exploded View'), findsOneWidget);
      expect(find.text('HIGH PRESSURE MOTOR'), findsOneWidget);
    });

    testWidgets('Multiple exploded-view messages coexist independently in chat list', (tester) async {
      const msg1 = ChatMessageModel(
        id: 'msg_1',
        role: 'assistant',
        content: 'First machine breakdown:',
        messageType: 'exploded_view',
        explodedView: ExplodedViewModel(
          machineId: 'machine_A',
          machineName: 'Assembly A',
          modelUrl: 'https://example.com/models/a.step',
          title: 'Assembly A View',
          description: 'Description A',
        ),
      );

      const msg2 = ChatMessageModel(
        id: 'msg_2',
        role: 'assistant',
        content: 'Second machine breakdown:',
        messageType: 'exploded_view',
        explodedView: ExplodedViewModel(
          machineId: 'machine_B',
          machineName: 'Assembly B',
          modelUrl: 'https://example.com/models/b.step',
          title: 'Assembly B View',
          description: 'Description B',
        ),
      );

      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView(
              children: const [
                ChatBubble(message: msg1),
                ChatBubble(message: msg2),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('exploded_view_chat_message_card')), findsNWidgets(2));
      expect(find.text('Assembly A View'), findsOneWidget);
      expect(find.text('Assembly B View'), findsOneWidget);
    });
  });
}
