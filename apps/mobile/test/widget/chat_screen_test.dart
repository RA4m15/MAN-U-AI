import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:manuai_mobile/core/theme/app_theme.dart';
import 'package:manuai_mobile/features/auth/controllers/auth_controller.dart';
import 'package:manuai_mobile/features/auth/models/auth_state.dart';
import 'package:manuai_mobile/features/auth/models/user_model.dart';
import 'package:manuai_mobile/features/chat/controllers/chat_controller.dart';
import 'package:manuai_mobile/features/chat/controllers/conversation_controller.dart';
import 'package:manuai_mobile/features/chat/models/chat_message_model.dart';
import 'package:manuai_mobile/features/chat/models/citation_model.dart';
import 'package:manuai_mobile/features/chat/models/conversation_model.dart';
import 'package:manuai_mobile/features/chat/repositories/chat_repository.dart';
import 'package:manuai_mobile/features/chat/views/chat_screen.dart';
import 'package:manuai_mobile/features/equipment/controllers/equipment_controller.dart';
import 'package:manuai_mobile/features/equipment/models/equipment_model.dart';
import 'package:manuai_mobile/features/equipment/repositories/equipment_repository.dart';

class MockChatRepository extends Mock implements ChatRepository {}
class MockEquipmentRepository extends Mock implements EquipmentRepository {}

void main() {
  late MockChatRepository mockChatRepository;
  late MockEquipmentRepository mockEquipmentRepository;

  const testUser = UserModel(
    id: 'u-1',
    name: 'Sarah Connor',
    email: 'sarah@plant.io',
    role: 'engineer',
  );

  const testConv = ConversationModel(
    id: 'conv-1',
    title: 'Slurry Pump Gland Seal',
    equipmentId: 'eq-10',
    equipmentName: 'Model SP-400X',
  );

  const testCitation = CitationModel(
    id: 'cite-1',
    documentId: 'doc-1',
    documentTitle: 'SP-400X Rebuild Manual',
    revision: 'Rev 5.2',
    page: 2,
    section: 'Section 4',
    excerpt: 'Torque gland studs to 52 N·m in cross pattern.',
  );

  setUp(() {
    mockChatRepository = MockChatRepository();
    mockEquipmentRepository = MockEquipmentRepository();

    when(() => mockChatRepository.getConversations())
        .thenAnswer((_) async => [testConv]);
    when(() => mockEquipmentRepository.getEquipment())
        .thenAnswer((_) async => [
              const EquipmentModel(
                id: 'eq-10',
                name: 'Slurry Pump',
                type: 'Centrifugal',
                model: 'SP-400X',
              ),
            ]);
  });

  Widget createWidgetUnderTest({
    ChatState? initialChatState,
    List<dynamic> overrides = const [],
  }) {
    return ProviderScope(
      overrides: [
        chatRepositoryProvider.overrideWithValue(mockChatRepository),
        equipmentRepositoryProvider.overrideWithValue(mockEquipmentRepository),
        authControllerProvider.overrideWith(
          () => _TestAuthController(const Authenticated(user: testUser, token: 'fake-token')),
        ),
        if (initialChatState != null)
          chatControllerProvider.overrideWith(
            () => _TestChatController(initialChatState),
          ),
        ...overrides.cast(),
      ],
      child: MaterialApp(
        theme: AppTheme.darkTheme,
        home: const ChatScreen(),
      ),
    );
  }

  group('ChatScreen Widget Tests', () {
    testWidgets('renders empty consultation state with suggestions and branding', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      expect(find.text('New Consultation'), findsOneWidget);
      expect(find.text('Industrial Reliability Copilot'), findsOneWidget);
      expect(find.text('SUGGESTED TECHNICAL INQUIRIES'), findsOneWidget);
      expect(find.byKey(const Key('chat_message_input')), findsOneWidget);
      expect(find.byKey(const Key('chat_send_button')), findsOneWidget);
      expect(find.byKey(const Key('open_drawer_button')), findsOneWidget);
    });

    testWidgets('renders user and assistant messages with markdown and citations', (tester) async {
      final chatState = ChatState(
        activeConversation: testConv,
        messages: const [
          ChatMessageModel(
            role: 'user',
            content: 'How should the gland studs be torqued?',
          ),
          ChatMessageModel(
            role: 'assistant',
            content: 'The four M12 gland retaining studs must be torqued to **52 N·m**.',
            warningLevel: 'critical',
            confidenceScore: 0.95,
            citations: [testCitation],
          ),
        ],
      );

      await tester.pumpWidget(createWidgetUnderTest(initialChatState: chatState));
      await tester.pumpAndSettle();

      expect(find.text('How should the gland studs be torqued?'), findsOneWidget);
      expect(find.text('MAN-U-AI Copilot'), findsOneWidget);
      expect(find.text('95% Grounded'), findsOneWidget);
      expect(find.text('CRITICAL INDUSTRIAL SAFETY DIRECTIVE'), findsOneWidget);
      expect(find.byKey(const Key('toggle_citations_button')), findsOneWidget);

      // Expand citations
      await tester.tap(find.byKey(const Key('toggle_citations_button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('citation_card_0')), findsOneWidget);
      expect(find.text('SP-400X Rebuild Manual'), findsOneWidget);
    });

    testWidgets('shows sending progress indicator when isSending is true', (tester) async {
      final chatState = ChatState(
        activeConversation: testConv,
        isSending: true,
        messages: const [
          ChatMessageModel(
            role: 'user',
            content: 'What is the bearing gap clearance?',
          ),
        ],
      );

      await tester.pumpWidget(createWidgetUnderTest(initialChatState: chatState));
      await tester.pump();

      expect(find.byKey(const Key('chat_sending_indicator')), findsOneWidget);
      expect(
        find.text('Evaluating technical documents & drafting grounded answer...'),
        findsOneWidget,
      );
    });

    testWidgets('displays sending error banner when sendingError is present', (tester) async {
      final chatState = ChatState(
        activeConversation: testConv,
        sendingError: 'Rate limit reached. Please wait a moment before sending another question.',
      );

      await tester.pumpWidget(createWidgetUnderTest(initialChatState: chatState));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('chat_error_banner')), findsOneWidget);
      expect(
        find.text('Rate limit reached. Please wait a moment before sending another question.'),
        findsOneWidget,
      );
    });

    testWidgets('opens conversation drawer and displays past consultations', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      // Open drawer
      await tester.tap(find.byKey(const Key('open_drawer_button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('drawer_new_consultation_button')), findsOneWidget);
      expect(find.text('Slurry Pump Gland Seal'), findsOneWidget);
      expect(find.text('Sarah Connor'), findsOneWidget);
      expect(find.byKey(const Key('drawer_logout_button')), findsOneWidget);
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
  void clearError() {
    if (state is Unauthenticated && (state as Unauthenticated).errorMessage != null) {
      state = const Unauthenticated();
    }
  }

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

class _TestChatController extends Notifier<ChatState> implements ChatController {
  final ChatState initialState;
  _TestChatController(this.initialState);

  @override
  ChatState build() => initialState;

  @override
  void startNewConsultation({EquipmentModel? equipment}) {
    state = ChatState(selectedEquipment: equipment);
  }

  @override
  Future<void> selectConversation(ConversationModel conv) async {
    state = state.copyWith(activeConversation: () => conv);
  }

  @override
  void setSelectedEquipment(EquipmentModel? equipment) {
    state = state.copyWith(selectedEquipment: () => equipment);
  }

  @override
  void clearSendingError() {
    state = state.copyWith(sendingError: () => null);
  }

  @override
  Future<void> sendMessage(String text) async {}
}
