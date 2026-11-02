import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:manuai_mobile/core/network/connectivity_controller.dart';
import 'package:manuai_mobile/core/theme/app_theme.dart';
import 'package:manuai_mobile/features/auth/controllers/auth_controller.dart';
import 'package:manuai_mobile/features/auth/models/auth_state.dart';
import 'package:manuai_mobile/features/auth/models/user_model.dart';
import 'package:manuai_mobile/features/chat/views/chat_screen.dart';
import 'package:manuai_mobile/features/tasks/controllers/task_controller.dart';
import 'package:manuai_mobile/features/tasks/repositories/task_repository.dart';

class MockTaskRepository extends Mock implements TaskRepository {}

void main() {
  late MockTaskRepository mockTaskRepository;

  setUp(() {
    mockTaskRepository = MockTaskRepository();
    when(() => mockTaskRepository.getTasks()).thenAnswer((_) async => []);
  });

  const testUser = UserModel(
    id: 'usr-engineer-1',
    name: 'Field Engineer',
    email: 'engineer@plant.io',
    role: 'engineer',
  );

  Widget createWidget({
    required NetworkStatus status,
  }) {
    return ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(() => _MockAuthController(testUser)),
        connectivityControllerProvider.overrideWith(() => _MockConnectivityController(status)),
        taskRepositoryProvider.overrideWithValue(mockTaskRepository),
      ],
      child: MaterialApp(
        theme: AppTheme.darkTheme,
        home: const ChatScreen(),
      ),
    );
  }

  testWidgets('renders DEAD-ZONE MODE ACTIVE banner when offline', (tester) async {
    await tester.pumpWidget(createWidget(status: NetworkStatus.offline));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('offline_mode_banner')), findsOneWidget);
    expect(find.text('DEAD-ZONE MODE ACTIVE // LOCAL PROCEDURES ONLY'), findsOneWidget);
    expect(find.text('RETRY'), findsOneWidget);
  });

  testWidgets('renders SERVER UNAVAILABLE banner when cloud server is unreachable', (tester) async {
    await tester.pumpWidget(createWidget(status: NetworkStatus.serverUnreachable));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('offline_mode_banner')), findsOneWidget);
    expect(find.text('SERVER UNAVAILABLE // CACHED DATA ONLY'), findsOneWidget);
    expect(find.text('RECONNECT'), findsOneWidget);
  });

  testWidgets('renders CONNECTION RESTORED banner when transitioning to reconnecting', (tester) async {
    await tester.pumpWidget(createWidget(status: NetworkStatus.reconnecting));
    await tester.pump();

    expect(find.byKey(const Key('offline_mode_banner')), findsOneWidget);
    expect(find.text('CONNECTION RESTORED // SYNCHRONIZING DATA'), findsOneWidget);
  });

  testWidgets('does not show dead-zone banner when status is online', (tester) async {
    await tester.pumpWidget(createWidget(status: NetworkStatus.online));
    await tester.pumpAndSettle();

    expect(find.text('DEAD-ZONE MODE ACTIVE // LOCAL PROCEDURES ONLY'), findsNothing);
    expect(find.text('SERVER UNAVAILABLE // CACHED DATA ONLY'), findsNothing);
  });
}

class _MockAuthController extends AuthController {
  final UserModel user;
  _MockAuthController(this.user);

  @override
  AuthState build() {
    return Authenticated(user: user, token: 'mock-valid-token');
  }
}

class _MockConnectivityController extends ConnectivityController {
  final NetworkStatus initialStatus;
  _MockConnectivityController(this.initialStatus);

  @override
  NetworkState build() {
    return NetworkState(status: initialStatus, lastChecked: DateTime.now());
  }
}
