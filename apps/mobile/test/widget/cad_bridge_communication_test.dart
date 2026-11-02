import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/features/chat/models/cad_bridge_message.dart';
import 'package:manuai_mobile/features/chat/models/exploded_view_model.dart';
import 'package:manuai_mobile/features/chat/services/cad_viewer_bridge_service.dart';
import 'package:manuai_mobile/features/chat/views/widgets/exploded_view_chat_message.dart';

void main() {
  group('Task 4: CadBridgeMessage Protocol & Security Tests', () {
    test('Correctly serializes and deserializes version 1 structured message', () {
      final msg = CadBridgeMessage(
        version: 1,
        type: 'event',
        event: 'componentSelected',
        requestId: 'req_001',
        machineId: 'machine_001',
        payload: {
          'partId': 'bearing_assembly_01',
          'partName': 'Bearing Assembly',
          'parentId': 'rotor_assembly',
          'assemblyPath': ['Root', 'rotor_assembly', 'bearing_assembly_01'],
          'metadata': {'type': 'roller'},
        },
      );

      final jsonStr = msg.toJsonString();
      final parsed = CadBridgeMessage.tryParse(jsonStr);

      expect(parsed, isNotNull);
      expect(parsed!.version, equals(1));
      expect(parsed.type, equals('event'));
      expect(parsed.event, equals('componentSelected'));
      expect(parsed.requestId, equals('req_001'));
      expect(parsed.machineId, equals('machine_001'));
      expect(parsed.payload['partId'], equals('bearing_assembly_01'));
      expect(parsed.payload['partName'], equals('Bearing Assembly'));
      expect(parsed.payload['parentId'], equals('rotor_assembly'));
      expect(parsed.payload['assemblyPath'], equals(['Root', 'rotor_assembly', 'bearing_assembly_01']));
    });

    test('Rejects unsupported protocol version (e.g. version: 2)', () {
      final jsonStr = jsonEncode({
        'version': 2,
        'type': 'event',
        'event': 'componentSelected',
        'requestId': 'req_bad_ver',
        'machineId': 'machine_001',
        'payload': {},
      });

      final parsed = CadBridgeMessage.tryParse(jsonStr);
      expect(parsed, isNull);
    });

    test('Rejects unknown or disallowed event names', () {
      final jsonStr = jsonEncode({
        'version': 1,
        'type': 'event',
        'event': 'maliciousInjectedEvent',
        'requestId': 'req_bad_evt',
        'machineId': 'machine_001',
        'payload': {},
      });

      final parsed = CadBridgeMessage.tryParse(jsonStr);
      expect(parsed, isNull);
    });

    test('Rejects unknown or disallowed command names', () {
      final jsonStr = jsonEncode({
        'version': 1,
        'type': 'command',
        'command': 'DROP_ALL_TABLES',
        'requestId': 'req_bad_cmd',
        'machineId': 'machine_001',
        'payload': {},
      });

      final parsed = CadBridgeMessage.tryParse(jsonStr);
      expect(parsed, isNull);
    });

    test('Rejects oversized messages exceeding 64KB', () {
      final largePayload = 'A' * 70000;
      final jsonStr = jsonEncode({
        'version': 1,
        'type': 'event',
        'event': 'componentSelected',
        'requestId': 'req_oversized',
        'machineId': 'machine_001',
        'payload': {'data': largePayload},
      });

      final parsed = CadBridgeMessage.tryParse(jsonStr);
      expect(parsed, isNull);
    });

    test('Handles malformed non-JSON strings without throwing', () {
      expect(CadBridgeMessage.tryParse('NOT_A_JSON_STRING'), isNull);
      expect(CadBridgeMessage.tryParse('{"unclosed:'), isNull);
      expect(CadBridgeMessage.tryParse(null), isNull);
      expect(CadBridgeMessage.tryParse(12345), isNull);
    });
  });

  group('Task 4: CadViewerBridgeService State & Event Synchronization Tests', () {
    late CadViewerBridgeService service;

    setUp(() {
      service = CadViewerBridgeService(
        machineId: 'pump_x1',
        initialStep: 1,
        totalSteps: 4,
      );
    });

    tearDown(() {
      service.dispose();
    });

    test('Handles viewerReady event correctly', () {
      expect(service.isViewerReady, isFalse);

      final rawEvent = jsonEncode({
        'version': 1,
        'type': 'event',
        'event': 'viewerReady',
        'requestId': 'evt_ready',
        'machineId': 'pump_x1',
        'payload': {'status': 'ready'},
      });

      service.handleInboundRawMessage(rawEvent);

      expect(service.isViewerReady, isTrue);
      expect(service.state.isLoading, isFalse);
      expect(service.state.errorMessage, isNull);
    });

    test('Handles assemblyLoaded event updating step bounds', () {
      final rawEvent = jsonEncode({
        'version': 1,
        'type': 'event',
        'event': 'assemblyLoaded',
        'requestId': 'evt_loaded',
        'machineId': 'pump_x1',
        'payload': {
          'name': 'Turbocompressor',
          'totalSteps': 6,
          'currentStep': 1,
        },
      });

      service.handleInboundRawMessage(rawEvent);

      expect(service.isViewerReady, isTrue);
      expect(service.state.totalSteps, equals(6));
      expect(service.state.currentStep, equals(1));
    });

    test('Handles componentSelected and componentDeselected events', () {
      expect(service.state.hasSelection, isFalse);

      final selectEvent = jsonEncode({
        'version': 1,
        'type': 'event',
        'event': 'componentSelected',
        'requestId': 'evt_sel',
        'machineId': 'pump_x1',
        'payload': {
          'partId': 'impeller_blade_03',
          'partName': 'Titanium Impeller Blade',
          'parentId': 'impeller_hub',
          'assemblyPath': ['Root', 'impeller_hub', 'impeller_blade_03'],
          'metadata': {'material': 'Ti-6Al-4V'},
        },
      });

      service.handleInboundRawMessage(selectEvent);

      expect(service.state.hasSelection, isTrue);
      expect(service.state.selectedPartId, equals('impeller_blade_03'));
      expect(service.state.selectedPartName, equals('Titanium Impeller Blade'));
      expect(service.state.parentId, equals('impeller_hub'));
      expect(service.state.assemblyPath, equals(['Root', 'impeller_hub', 'impeller_blade_03']));
      expect(service.state.breadcrumbs, equals('Root > impeller_hub > impeller_blade_03'));

      // Deselect event
      final deselectEvent = jsonEncode({
        'version': 1,
        'type': 'event',
        'event': 'componentDeselected',
        'requestId': 'evt_desel',
        'machineId': 'pump_x1',
        'payload': {},
      });

      service.handleInboundRawMessage(deselectEvent);

      expect(service.state.hasSelection, isFalse);
      expect(service.state.selectedPartId, isNull);
      expect(service.state.selectedPartName, isNull);
    });

    test('Handles explosionStepChanged event synchronizing stage indicator', () {
      final stepEvent = jsonEncode({
        'version': 1,
        'type': 'event',
        'event': 'explosionStepChanged',
        'requestId': 'evt_step',
        'machineId': 'pump_x1',
        'payload': {
          'stepIndex': 2,
          'stepNumber': 3,
          'totalSteps': 5,
        },
      });

      service.handleInboundRawMessage(stepEvent);

      expect(service.state.currentStep, equals(3));
      expect(service.state.totalSteps, equals(5));
    });

    test('Handles viewerError event updating error state', () {
      final errEvent = jsonEncode({
        'version': 1,
        'type': 'event',
        'event': 'viewerError',
        'requestId': 'evt_err',
        'machineId': 'pump_x1',
        'payload': {
          'error': 'WASM CAD importer memory allocation failure',
        },
      });

      service.handleInboundRawMessage(errEvent);

      expect(service.state.isLoading, isFalse);
      expect(service.state.errorMessage, equals('WASM CAD importer memory allocation failure'));
    });

    test('Executes Next, Previous, Reset and GoToStep stage commands', () async {
      expect(service.state.currentStep, equals(1));
      expect(service.state.totalSteps, equals(4));

      // Advance Next
      final nextRes = await service.nextStep();
      expect(nextRes, isTrue);
      expect(service.state.currentStep, equals(2));

      // Advance Next again
      await service.nextStep();
      expect(service.state.currentStep, equals(3));

      // Retreat Prev
      final prevRes = await service.previousStep();
      expect(prevRes, isTrue);
      expect(service.state.currentStep, equals(2));

      // Go to Step 4 directly
      final gotoRes = await service.goToStep(4);
      expect(gotoRes, isTrue);
      expect(service.state.currentStep, equals(4));

      // Reset
      final resetRes = await service.resetExplosion();
      expect(resetRes, isTrue);
      expect(service.state.currentStep, equals(1));
    });

    test('Executes selectComponent and clearSelection commands', () async {
      expect(service.state.hasSelection, isFalse);

      final selRes = await service.selectComponent('valve_piston_2');
      expect(selRes, isTrue);
      expect(service.state.hasSelection, isTrue);
      expect(service.state.selectedPartId, equals('valve_piston_2'));

      final clearRes = await service.clearSelection();
      expect(clearRes, isTrue);
      expect(service.state.hasSelection, isFalse);
    });

    test('Service disposal marks disposed and rejects subsequent commands', () {
      service.dispose();
      expect(service.isDisposed, isTrue);

      expect(() => service.nextStep(), throwsA(isA<StateError>()));
    });
  });

  group('Task 4: Multi-Instance Isolation & Cross-Contamination Prevention', () {
    test('Two service instances for different machines ignore each others messages', () {
      final serviceA = CadViewerBridgeService(machineId: 'machine_ALPHA');
      final serviceB = CadViewerBridgeService(machineId: 'machine_BETA');

      addTearDown(() {
        serviceA.dispose();
        serviceB.dispose();
      });

      // Send event targeted specifically at machine_ALPHA
      final eventAlpha = jsonEncode({
        'version': 1,
        'type': 'event',
        'event': 'componentSelected',
        'requestId': 'evt_a',
        'machineId': 'machine_ALPHA',
        'payload': {
          'partId': 'alpha_part',
          'partName': 'Alpha Part',
        },
      });

      serviceA.handleInboundRawMessage(eventAlpha);
      serviceB.handleInboundRawMessage(eventAlpha);

      // Service A must have updated; Service B must remain completely untouched
      expect(serviceA.state.hasSelection, isTrue);
      expect(serviceA.state.selectedPartId, equals('alpha_part'));

      expect(serviceB.state.hasSelection, isFalse);
      expect(serviceB.state.selectedPartId, isNull);
    });
  });

  group('Task 4: Flutter UI Component Selection Card Integration (Part 7)', () {
    const payload = ExplodedViewModel(
      machineId: 'slurry_pump_9',
      machineName: 'Slurry Pump 9',
      modelUrl: 'https://example.com/models/slurry.step',
      title: 'Slurry Pump Structure',
      description: 'Exploded overview of casing and impeller.',
      initialStep: 1,
      totalSteps: 4,
    );

    testWidgets('Renders component info section when componentSelected event arrives', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final service = CadViewerBridgeService(
        machineId: 'slurry_pump_9',
        initialStep: 1,
        totalSteps: 4,
      );
      addTearDown(service.dispose);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ExplodedViewChatMessage(
                payload: payload,
                bridgeService: service,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Initially no component info card is displayed
      expect(find.byKey(const Key('cad_component_info_card')), findsNothing);

      // Simulate inbound componentSelected event from CAD viewer
      final selectEvent = jsonEncode({
        'version': 1,
        'type': 'event',
        'event': 'componentSelected',
        'requestId': 'evt_sel_ui',
        'machineId': 'slurry_pump_9',
        'payload': {
          'partId': 'ceramic_seal_04',
          'partName': 'Ceramic Mechanical Seal',
          'parentId': 'shaft_housing',
          'assemblyPath': ['Root', 'shaft_housing', 'ceramic_seal_04'],
        },
      });

      service.handleInboundRawMessage(selectEvent);
      await tester.pumpAndSettle();

      // Component Info Card must now be displayed with all required fields
      expect(find.byKey(const Key('cad_component_info_card')), findsOneWidget);
      expect(find.byKey(const Key('cad_selected_component_name')), findsOneWidget);
      expect(find.text('Ceramic Mechanical Seal'), findsOneWidget);

      expect(find.byKey(const Key('cad_selected_component_id')), findsOneWidget);
      expect(find.text('ceramic_seal_04'), findsOneWidget);

      expect(find.byKey(const Key('cad_selected_component_parent')), findsOneWidget);
      expect(find.text('shaft_housing'), findsOneWidget);

      expect(find.byKey(const Key('cad_selected_component_path')), findsOneWidget);
      expect(find.text('Root > shaft_housing > ceramic_seal_04'), findsOneWidget);

      expect(find.byKey(const Key('cad_selected_component_stage')), findsOneWidget);
      expect(find.text('STAGE 1 OF 4'), findsNWidgets(2)); // Controls bar + component card

      // Tap Clear Selection Button
      expect(find.byKey(const Key('cad_clear_selection_button')), findsOneWidget);
      await tester.tap(find.byKey(const Key('cad_clear_selection_button')));
      await tester.pumpAndSettle();

      // Component Info Card is dismissed
      expect(find.byKey(const Key('cad_component_info_card')), findsNothing);
    });
  });
}

