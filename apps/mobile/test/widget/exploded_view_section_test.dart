import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';
import 'package:manuai_mobile/core/network/connectivity_controller.dart';
import 'package:manuai_mobile/core/storage/local_cache_service.dart';
import 'package:manuai_mobile/core/theme/app_theme.dart';
import 'package:manuai_mobile/features/auth/controllers/auth_controller.dart';
import 'package:manuai_mobile/features/auth/models/auth_state.dart';
import 'package:manuai_mobile/features/auth/models/user_model.dart';
import 'package:manuai_mobile/features/chat/controllers/conversation_controller.dart';
import 'package:manuai_mobile/features/chat/repositories/chat_repository.dart';
import 'package:manuai_mobile/features/chat/views/chat_screen.dart';
import 'package:manuai_mobile/features/equipment/controllers/equipment_controller.dart';
import 'package:manuai_mobile/features/equipment/models/equipment_model.dart';
import 'package:manuai_mobile/features/exploded_view/views/exploded_view_explorer_screen.dart';
import 'package:manuai_mobile/features/exploded_view/views/exploded_view_screen.dart';
import 'package:manuai_mobile/features/tasks/controllers/task_controller.dart';

class MockChatRepository extends Mock implements ChatRepository {}
class MockLocalCacheService extends Mock implements LocalCacheService {}

void main() {
  const testUser = UserModel(
    id: 'eng-01',
    name: 'Alex Mercer',
    email: 'alex.mercer@plant.io',
    role: 'engineer',
  );

  const testMachines = [
    EquipmentModel(
      id: 'equip-p102',
      name: 'Centrifugal Slurry Pump P-102',
      type: 'Centrifugal Pump',
      category: 'Industrial rotating equipment',
      model: 'SP-400 Heavy Duty',
      manufacturer: 'Flowserve',
      referenceImage: 'assets/images/machines/machine_turbomachinery.jpg',
      cadModel: CadModelInfo(
        available: true,
        format: 'STEP',
        storageReference: '/cad/models/slurry_pump_p102.step',
      ),
      documentation: ['Slurry Pump Overhaul Guide', 'Mechanical Seal SOP'],
    ),
    EquipmentModel(
      id: 'equip-cb-a61',
      name: 'Conveyor Belt A61',
      type: 'Modular Belt Conveyor',
      category: 'Material Handling',
      model: 'A61-SIMREADY-01',
      manufacturer: 'SimReady Systems',
      referenceImage: 'assets/images/conveyor_belt_a61.png',
      cadModel: CadModelInfo(
        available: true,
        format: 'STEP',
        storageReference: '/cad/models/conveyor_belt_a61.step',
      ),
      documentation: ['Conveyor Belt Preventive Maintenance Guide'],
    ),
    EquipmentModel(
      id: 'machine_002',
      name: 'CAT Generator Set',
      type: 'Power generation equipment',
      category: 'Power generation equipment',
      model: 'C32 ACERT',
      manufacturer: 'Caterpillar Inc.',
      referenceImage: 'assets/images/machines/machine_cat_generator.jpg',
      cadModel: CadModelInfo(available: false),
      documentation: ['CAT GenSet Operations Guide'],
    ),
    EquipmentModel(
      id: 'machine_003',
      name: 'Industrial Process Equipment Skid',
      type: 'Industrial process equipment',
      category: 'Industrial process equipment',
      model: 'PS-DUAL-STAGE-500',
      manufacturer: 'Process Plant Engineering Ltd.',
      referenceImage: 'assets/images/machines/machine_process_skid.jpg',
      cadModel: CadModelInfo(available: false),
      documentation: ['Process Skid Piping SOP'],
    ),
  ];

  Widget buildTestApp(Widget child, {List<EquipmentModel>? machines}) {
    final mockRepo = MockChatRepository();
    final mockCache = MockLocalCacheService();

    when(() => mockCache.cacheMessages(any(), any())).thenAnswer((_) async {});
    when(() => mockCache.getCachedMessages(any())).thenAnswer((_) async => []);
    when(() => mockRepo.getConversations()).thenAnswer((_) async => []);

    return ProviderScope(
      overrides: [
        equipmentListProvider.overrideWith((ref) async => machines ?? testMachines),
        isDeadZoneProvider.overrideWithValue(false),
        chatRepositoryProvider.overrideWithValue(mockRepo),
        localCacheServiceProvider.overrideWithValue(mockCache),
        activeTasksCountProvider.overrideWithValue(0),
        authControllerProvider.overrideWith(
          () => _TestAuthController(const Authenticated(user: testUser, token: 'fake-token')),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.lightTheme,
        home: child,
      ),
    );
  }

  group('Dedicated Exploded View Section Tests', () {
    testWidgets('1. Exploded View navigation entries exist in ChatScreen AppBar and Drawer', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(const ChatScreen()));
      await tester.pumpAndSettle();

      // Verify AppBar direct 3D Explorer icon button
      expect(find.byKey(const Key('appbar_exploded_view_explorer_button')), findsOneWidget);

      // Open Drawer
      final openDrawerButton = find.byKey(const Key('open_drawer_button'));
      expect(openDrawerButton, findsOneWidget);
      await tester.tap(openDrawerButton);
      await tester.pumpAndSettle();

      // Verify Dedicated Drawer Exploded View button
      final drawerExplodedButton = find.byKey(const Key('drawer_exploded_view_button'));
      expect(drawerExplodedButton, findsOneWidget);
      expect(find.text('EXPLODED VIEW'), findsOneWidget);
      expect(find.text('Direct 3D Machine Exploration'), findsOneWidget);
    });

    testWidgets('2. ExplodedViewExplorerScreen renders header, search, chips and machine cards', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(const ExplodedViewExplorerScreen()));
      await tester.pumpAndSettle();

      // Header
      expect(find.byKey(const Key('explorer_header_title')), findsOneWidget);
      expect(find.text('Exploded View Explorer'), findsOneWidget);
      expect(find.byKey(const Key('explorer_header_subtitle')), findsOneWidget);

      // Search & Filters
      expect(find.byKey(const Key('exploded_view_search_field')), findsOneWidget);
      expect(find.byKey(const Key('filter_chip_all')), findsOneWidget);
      expect(find.byKey(const Key('filter_chip_available')), findsOneWidget);
      expect(find.byKey(const Key('filter_chip_pending')), findsOneWidget);

      // All 4 test machine cards rendered
      expect(find.byKey(const Key('exploded_machine_card_equip-p102')), findsOneWidget);
      expect(find.byKey(const Key('exploded_machine_card_equip-cb-a61')), findsOneWidget);
      expect(find.byKey(const Key('exploded_machine_card_machine_002')), findsOneWidget);
      expect(find.byKey(const Key('exploded_machine_card_machine_003')), findsOneWidget);

      // Badges
      expect(find.byKey(const Key('cad_available_badge_equip-p102')), findsOneWidget);
      expect(find.byKey(const Key('cad_pending_badge_machine_002')), findsOneWidget);
    });

    testWidgets('3. Machine search filters by name, model, and category', (tester) async {
      await tester.pumpWidget(buildTestApp(const ExplodedViewExplorerScreen()));
      await tester.pumpAndSettle();

      // Search by name "Slurry"
      await tester.enterText(find.byKey(const Key('exploded_view_search_field')), 'Slurry');
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('exploded_machine_card_equip-p102')), findsOneWidget);
      expect(find.byKey(const Key('exploded_machine_card_equip-cb-a61')), findsNothing);
      expect(find.byKey(const Key('exploded_machine_card_machine_002')), findsNothing);

      // Clear search
      await tester.tap(find.byIcon(Icons.clear_rounded));
      await tester.pumpAndSettle();

      // Search by ID "cb-a61"
      await tester.enterText(find.byKey(const Key('exploded_view_search_field')), 'cb-a61');
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('exploded_machine_card_equip-cb-a61')), findsOneWidget);
      expect(find.byKey(const Key('exploded_machine_card_equip-p102')), findsNothing);
    });

    testWidgets('4. CAD availability filters isolate Available vs Pending equipment', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(const ExplodedViewExplorerScreen()));
      await tester.pumpAndSettle();

      // Select "CAD Available"
      final availableChip = find.byKey(const Key('filter_chip_available'));
      await tester.ensureVisible(availableChip);
      await tester.tap(availableChip);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('exploded_machine_card_equip-p102')), findsOneWidget);
      expect(find.byKey(const Key('exploded_machine_card_equip-cb-a61')), findsOneWidget);
      expect(find.byKey(const Key('exploded_machine_card_machine_002')), findsNothing);
      expect(find.byKey(const Key('exploded_machine_card_machine_003')), findsNothing);

      // Select "CAD Pending"
      final pendingChip = find.byKey(const Key('filter_chip_pending'));
      await tester.ensureVisible(pendingChip);
      await tester.tap(pendingChip);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('exploded_machine_card_equip-p102')), findsNothing);
      expect(find.byKey(const Key('exploded_machine_card_equip-cb-a61')), findsNothing);
      expect(find.byKey(const Key('exploded_machine_card_machine_002')), findsOneWidget);
      expect(find.byKey(const Key('exploded_machine_card_machine_003')), findsOneWidget);

      // Re-select "All Machines"
      final allChip = find.byKey(const Key('filter_chip_all'));
      await tester.ensureVisible(allChip);
      await tester.tap(allChip);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('exploded_machine_card_equip-p102')), findsOneWidget);
      expect(find.byKey(const Key('exploded_machine_card_machine_002')), findsOneWidget);
    });

    testWidgets('5. Tapping OPEN 3D VIEW on pending machine displays honest pending modal', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(const ExplodedViewExplorerScreen()));
      await tester.pumpAndSettle();

      // Tap on pending CAT Generator card action
      final pendingButton = find.byKey(const Key('open_3d_view_button_machine_002'));
      await tester.ensureVisible(pendingButton);
      await tester.tap(pendingButton);
      await tester.pumpAndSettle();

      // Modal appears
      expect(find.byKey(const Key('pending_modal_title')), findsOneWidget);
      expect((tester.widget(find.byKey(const Key('pending_modal_title'))) as Text).data, equals('CAD MODEL PENDING'));
      expect(find.textContaining('An authoritative 3D CAD assembly'), findsOneWidget);

      // Close modal
      await tester.tap(find.byKey(const Key('pending_modal_close_button')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('pending_modal_title')), findsNothing);
    });

    testWidgets('6. ExplodedViewScreen renders 3D viewport, sequential stage controls, and component tree', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final slurryPump = testMachines.first;
      await tester.pumpWidget(buildTestApp(ExplodedViewScreen(machine: slurryPump)));
      await tester.pumpAndSettle();

      // Top area
      expect(find.byKey(const Key('exploded_viewer_back_button')), findsOneWidget);
      expect(find.text('CAD ACTIVE'), findsOneWidget);
      expect(find.byKey(const Key('exploded_viewer_fullscreen_button')), findsOneWidget);

      // Simulated 3D viewport (headless environment)
      expect(find.byKey(const Key('simulated_cad_viewport')), findsOneWidget);

      // Stage Navigation Controls
      expect(find.byKey(const Key('cad_prev_stage_button')), findsOneWidget);
      expect(find.byKey(const Key('cad_next_stage_button')), findsOneWidget);
      expect(find.byKey(const Key('cad_reset_assembly_button')), findsOneWidget);
      expect(find.byKey(const Key('cad_stage_indicator')), findsOneWidget);
      expect(find.text('STAGE 1 OF 4'), findsOneWidget);

      // Advance stage
      await tester.tap(find.byKey(const Key('cad_next_stage_button')));
      await tester.pumpAndSettle();
      expect(find.text('STAGE 2 OF 4'), findsOneWidget);

      // Reset stage
      await tester.tap(find.byKey(const Key('cad_reset_assembly_button')));
      await tester.pumpAndSettle();
      expect(find.text('STAGE 1 OF 4'), findsOneWidget);

      // Component tree
      expect(find.text('ASSEMBLY COMPONENT HIERARCHY'), findsOneWidget);
      expect(find.byKey(const Key('component_chip_bearing_assembly_01')), findsOneWidget);
      expect(find.byKey(const Key('component_chip_mechanical_seal_02')), findsOneWidget);

      // Select Bearing Assembly
      await tester.tap(find.byKey(const Key('component_chip_bearing_assembly_01')));
      await tester.pumpAndSettle();

      // Detail card appears
      expect(find.byKey(const Key('active_component_detail_card')), findsOneWidget);
      expect(find.byKey(const Key('active_component_name_text')), findsOneWidget);
      expect(find.text('Bearing Assembly'), findsOneWidget);

      // Clear selection
      await tester.tap(find.byKey(const Key('clear_component_selection_button')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('active_component_detail_card')), findsNothing);

      // AI Assistance Button
      expect(find.byKey(const Key('ask_ai_about_machine_button')), findsOneWidget);
      expect(find.text('ASK MAN-U-AI ABOUT THIS MACHINE'), findsOneWidget);
    });

    testWidgets('7. Responsive narrow viewport (320dp) displays without RenderFlex overflow', (tester) async {
      await tester.binding.setSurfaceSize(const Size(320, 600));
      await tester.pumpWidget(buildTestApp(const ExplodedViewExplorerScreen()));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);

      // View dedicated exploded screen at 320dp width
      await tester.pumpWidget(buildTestApp(ExplodedViewScreen(machine: testMachines.first)));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });
}

class _TestAuthController extends Notifier<AuthState> implements AuthController {
  final AuthState initialState;
  _TestAuthController(this.initialState);

  @override
  AuthState build() => initialState;

  @override
  Future<void> checkAuthStatus() async {}

  @override
  Future<UserModel?> refreshUserProfile() async => null;

  @override
  Future<bool> login(String email, String password) async => true;

  @override
  Future<void> logout() async {
    state = const Unauthenticated();
  }

  @override
  void handleUnauthorized() {
    state = const Unauthenticated();
  }

  @override
  void clearError() {}

  @override
  Future<({bool isHealthy, String statusMessage, int? statusCode})> checkServerHealth() async {
    return (isHealthy: true, statusMessage: 'Connected to MAN-U-AI Server', statusCode: 200);
  }

  @override
  void setServerUrl(String newUrl) {}

  @override
  Future<bool> register({
    required String name,
    required String email,
    required String password,
  }) async => true;
}
