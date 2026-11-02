import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/core/theme/app_theme.dart';
import 'package:manuai_mobile/features/chat/models/cad_bridge_message.dart';
import 'package:manuai_mobile/features/chat/models/exploded_view_model.dart';
import 'package:manuai_mobile/features/chat/services/cad_viewer_bridge_service.dart';
import 'package:manuai_mobile/features/chat/views/widgets/exploded_view_chat_message.dart';
import 'package:manuai_mobile/features/equipment/controllers/equipment_controller.dart';
import 'package:manuai_mobile/features/equipment/models/equipment_model.dart';
import 'package:manuai_mobile/features/equipment/views/machine_catalog_screen.dart';

void main() {
  final sampleMachines = [
    const EquipmentModel(
      id: 'machine_001',
      name: 'Industrial Turbomachinery Assembly',
      type: 'Industrial rotating equipment',
      category: 'Industrial rotating equipment',
      referenceImage: 'assets/images/machines/machine_turbomachinery.jpg',
      cadModel: CadModelInfo(available: false),
      documentation: ['Turbomachinery Assembly Manual'],
    ),
    const EquipmentModel(
      id: 'machine_002',
      name: 'CAT Generator Set',
      type: 'Power generation equipment',
      category: 'Power generation equipment',
      referenceImage: 'assets/images/machines/machine_cat_generator.jpg',
      cadModel: CadModelInfo(available: false),
      documentation: ['CAT GenSet Operations Guide'],
    ),
    const EquipmentModel(
      id: 'machine_003',
      name: 'Industrial Process Equipment Skid',
      type: 'Industrial process equipment',
      category: 'Industrial process equipment',
      referenceImage: 'assets/images/machines/machine_process_skid.jpg',
      cadModel: CadModelInfo(available: false),
      documentation: ['Process Skid SOP'],
    ),
    const EquipmentModel(
      id: 'machine_004',
      name: 'CNC Machining Center',
      type: 'Manufacturing equipment',
      category: 'Manufacturing equipment',
      referenceImage: 'assets/images/machines/machine_cnc_center.jpg',
      cadModel: CadModelInfo(available: false),
      documentation: ['CNC 5-Axis Maintenance Manual'],
    ),
    const EquipmentModel(
      id: 'equip-cb-a61',
      name: 'Conveyor Belt A61',
      type: 'Modular Belt Conveyor',
      category: 'Material Handling',
      referenceImage: 'assets/images/conveyor_belt_a61.png',
      cadModel: CadModelInfo(available: true, format: 'STEP', version: '1.0'),
      documentation: ['Conveyor Maintenance SOP'],
    ),
  ];

  Widget buildCatalogApp({List<EquipmentModel>? machines}) {
    return ProviderScope(
      overrides: [
        equipmentListProvider.overrideWith((ref) async => machines ?? sampleMachines),
      ],
      child: MaterialApp(
        theme: AppTheme.lightTheme,
        home: const MachineCatalogScreen(),
      ),
    );
  }

  group('Machine Catalog Screen Widget Tests', () {
    testWidgets('renders all machines and search input', (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      await tester.pumpWidget(buildCatalogApp());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('machine_search_input')), findsOneWidget);
      expect(find.text('Machine Catalog'), findsOneWidget);

      expect(find.text('Industrial Turbomachinery Assembly'), findsOneWidget);
      expect(find.text('CAT Generator Set'), findsOneWidget);
      expect(find.text('Industrial Process Equipment Skid'), findsOneWidget);

      // Drag list up to reveal 4th machine
      await tester.drag(find.byKey(const Key('machine_catalog_list')), const Offset(0, -600));
      await tester.pumpAndSettle();
      expect(find.text('CNC Machining Center'), findsOneWidget);
    });

    testWidgets('shows correct CAD status badges for pending vs available models', (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      await tester.pumpWidget(buildCatalogApp());
      await tester.pumpAndSettle();

      // Pending badge on machine_001
      expect(find.byKey(const Key('cad_badge_pending_machine_001')), findsOneWidget);

      // Scroll to equip-cb-a61 and verify available badge
      await tester.drag(find.byKey(const Key('machine_catalog_list')), const Offset(0, -900));
      await tester.pumpAndSettle();
      await tester.drag(find.byKey(const Key('machine_catalog_list')), const Offset(0, -900));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('cad_badge_available_equip-cb-a61')), findsOneWidget);
    });

    testWidgets('filters machines using search bar', (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      await tester.pumpWidget(buildCatalogApp());
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('machine_search_input')), 'generator');
      await tester.pumpAndSettle();

      expect(find.text('CAT Generator Set'), findsOneWidget);
      expect(find.text('Industrial Turbomachinery Assembly'), findsNothing);
      expect(find.text('CNC Machining Center'), findsNothing);
    });

    testWidgets('filters machines using category chips', (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      await tester.pumpWidget(buildCatalogApp());
      await tester.pumpAndSettle();

      // Tap "Power generation equipment" chip
      final chip = find.text('Power generation equipment');
      expect(chip, findsOneWidget);
      await tester.tap(chip);
      await tester.pumpAndSettle();

      expect(find.text('CAT Generator Set'), findsOneWidget);
      expect(find.text('Industrial Turbomachinery Assembly'), findsNothing);
    });

    testWidgets('tapping CAD STATUS on pending machine displays informational sheet without fabricated geometry', (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      await tester.pumpWidget(buildCatalogApp());
      await tester.pumpAndSettle();

      final cadButton = find.byKey(const Key('explore_exploded_view_machine_001'));
      expect(cadButton, findsOneWidget);
      await tester.tap(cadButton);
      await tester.pumpAndSettle();

      // Verify bottom sheet appears with honest status notice
      expect(find.byKey(const Key('modal_cad_pending_badge')), findsOneWidget);
      expect(find.text('3D CAD STATUS NOTICE'), findsOneWidget);
      expect(find.textContaining('An authoritative 3D CAD model'), findsOneWidget);
      expect(find.byKey(const Key('modal_open_chat_button')), findsOneWidget);
    });
  });

  group('CAD Pending ExplodedViewChatMessage & Bridge Isolation', () {
    testWidgets('ExplodedViewChatMessage renders honest pending card when CAD is pending', (tester) async {
      final payload = ExplodedViewModel(
        machineId: 'machine_002',
        machineName: 'CAT Generator Set',
        modelUrl: '',
        title: 'CAT Generator Set — Structure',
        description: 'Visual reference only. 3D geometry pending.',
        isCadPending: true,
        referenceImage: 'assets/images/machines/machine_cat_generator.jpg',
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              child: ExplodedViewChatMessage(payload: payload),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('cad_pending_card')), findsOneWidget);
      expect(find.byKey(const Key('cad_pending_badge')), findsOneWidget);
      expect(find.text('CAD MODEL PENDING'), findsOneWidget);
    });

    test('CadViewerBridgeService discards crosstalk messages from other viewer instances', () {
      final serviceA = CadViewerBridgeService(
        machineId: 'machine_001',
        viewerInstanceId: 'inst_A_100',
      );
      final serviceB = CadViewerBridgeService(
        machineId: 'machine_001',
        viewerInstanceId: 'inst_B_200',
      );

      expect(serviceA.viewerInstanceId, equals('inst_A_100'));
      expect(serviceB.viewerInstanceId, equals('inst_B_200'));

      // Simulate inbound message targeted at instance B
      final msgForB = CadBridgeMessage(
        type: 'event',
        event: 'componentSelected',
        requestId: 'req_test_101',
        machineId: 'machine_001',
        viewerInstanceId: 'inst_B_200',
        payload: {
          'partId': 'rotor_shaft',
          'partName': 'Rotor Shaft',
          'currentStep': 2,
          'totalSteps': 4,
        },
      );

      // Service A processes the message - should discard due to mismatched instanceId
      serviceA.handleInboundRawMessage(msgForB.toJsonString());
      expect(serviceA.state.selectedPartId, isNull);

      // Service B processes the message - should accept and update state
      serviceB.handleInboundRawMessage(msgForB.toJsonString());
      expect(serviceB.state.selectedPartId, equals('rotor_shaft'));
      expect(serviceB.state.selectedPartName, equals('Rotor Shaft'));

      serviceA.dispose();
      serviceB.dispose();
    });
  });
}
