import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:manuai_mobile/core/theme/app_theme.dart';
import 'package:manuai_mobile/features/auth/controllers/auth_controller.dart';
import 'package:manuai_mobile/features/auth/models/auth_state.dart';
import 'package:manuai_mobile/features/auth/repositories/auth_repository.dart';
import 'package:manuai_mobile/features/auth/views/login_screen.dart';

class MockAuthRepository extends Mock implements AuthRepository {}

class TestAuthController extends Notifier<AuthState> implements AuthController {
  final AuthState initialState;
  String? lastLoginEmail;
  String? lastLoginPassword;
  bool overrideLoginSuccess = true;

  TestAuthController([this.initialState = const Unauthenticated()]);

  @override
  AuthState build() => initialState;

  @override
  Future<void> checkAuthStatus() async {}

  @override
  Future<bool> login(String email, String password) async {
    lastLoginEmail = email;
    lastLoginPassword = password;
    return overrideLoginSuccess;
  }

  @override
  Future<void> logout() async {
    state = const Unauthenticated();
  }

  @override
  void handleUnauthorized() {
    state = const Unauthenticated(
      errorMessage: 'Your session has expired. Please sign in again.',
    );
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

void main() {
  Widget createWidgetUnderTest({List<dynamic> overrides = const []}) {
    return ProviderScope(
      overrides: overrides.cast(),
      child: MaterialApp(
        theme: AppTheme.darkTheme,
        home: const LoginScreen(),
      ),
    );
  }

  group('LoginScreen Widget Tests', () {
    testWidgets('renders all essential branding, inputs, and actions', (tester) async {
      final testController = TestAuthController();
      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('MAN-U-AI'), findsOneWidget);
      expect(find.text('Industrial Reliability AI Copilot'), findsOneWidget);
      expect(find.byKey(const Key('login_email_input')), findsOneWidget);
      expect(find.byKey(const Key('login_password_input')), findsOneWidget);
      expect(find.byKey(const Key('login_password_toggle')), findsOneWidget);
      expect(find.byKey(const Key('login_submit_button')), findsOneWidget);
      expect(find.text('Authorized Facility Personnel Only'), findsOneWidget);
    });

    testWidgets('validates required fields on empty submission', (tester) async {
      final testController = TestAuthController();
      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // Tap submit with empty inputs
      await tester.tap(find.byKey(const Key('login_submit_button')));
      await tester.pumpAndSettle();

      expect(find.text('Please enter your email address'), findsOneWidget);
      expect(find.text('Please enter your password'), findsOneWidget);
      expect(testController.lastLoginEmail, isNull);
    });

    testWidgets('validates malformed email addresses', (tester) async {
      final testController = TestAuthController();
      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('login_email_input')), 'invalid-email');
      await tester.enterText(find.byKey(const Key('login_password_input')), 'password123');
      await tester.tap(find.byKey(const Key('login_submit_button')));
      await tester.pumpAndSettle();

      expect(find.text('Please enter a valid email address'), findsOneWidget);
      expect(testController.lastLoginEmail, isNull);
    });

    testWidgets('validates minimum password length requirement', (tester) async {
      final testController = TestAuthController();
      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('login_email_input')), 'tech@plant.io');
      await tester.enterText(find.byKey(const Key('login_password_input')), '123');
      await tester.tap(find.byKey(const Key('login_submit_button')));
      await tester.pumpAndSettle();

      expect(find.text('Password must be at least 6 characters'), findsOneWidget);
      expect(testController.lastLoginEmail, isNull);
    });

    testWidgets('toggles password visibility when icon button pressed', (tester) async {
      final testController = TestAuthController();
      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // Initially obscureText should be true
      TextField passwordField = tester.widget<TextField>(
        find.descendant(
          of: find.byKey(const Key('login_password_input')),
          matching: find.byType(TextField),
        ),
      );
      expect(passwordField.obscureText, isTrue);

      // Tap toggle button
      await tester.tap(find.byKey(const Key('login_password_toggle')));
      await tester.pumpAndSettle();

      passwordField = tester.widget<TextField>(
        find.descendant(
          of: find.byKey(const Key('login_password_input')),
          matching: find.byType(TextField),
        ),
      );
      expect(passwordField.obscureText, isFalse);
    });

    testWidgets('displays error banner when Unauthenticated contains an error message', (tester) async {
      final testController = TestAuthController(
        const Unauthenticated(errorMessage: 'Invalid email or password. Please try again.'),
      );
      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('login_error_banner')), findsOneWidget);
      expect(
        find.text('Invalid email or password. Please try again.'),
        findsOneWidget,
      );
    });

    testWidgets('shows loading indicator and disables submit button when AuthLoading', (tester) async {
      final testController = TestAuthController(const AuthLoading());
      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      final submitButton = tester.widget<ElevatedButton>(find.byKey(const Key('login_submit_button')));
      expect(submitButton.onPressed, isNull);
    });

    testWidgets('submits credentials to controller when inputs are valid', (tester) async {
      final testController = TestAuthController();
      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('login_email_input')), 'operator@plant.io');
      await tester.enterText(find.byKey(const Key('login_password_input')), 'SecretPass123!');
      await tester.tap(find.byKey(const Key('login_submit_button')));
      await tester.pumpAndSettle();

      expect(testController.lastLoginEmail, 'operator@plant.io');
      expect(testController.lastLoginPassword, 'SecretPass123!');
    });

    testWidgets('renders server connectivity strip and ping button', (tester) async {
      final testController = TestAuthController();
      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('check_server_health_button')), findsOneWidget);
      expect(find.byIcon(Icons.cloud_outlined), findsOneWidget);

      await tester.ensureVisible(find.byKey(const Key('check_server_health_button')));
      await tester.tap(find.byKey(const Key('check_server_health_button')));
      await tester.pumpAndSettle();

      expect(find.text('Connected to MAN-U-AI Server'), findsWidgets);
    });

    testWidgets('clears password input when login returns failure', (tester) async {
      final testController = TestAuthController();
      // Override login to return false
      testController.overrideLoginSuccess = false;

      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('login_email_input')), 'operator@plant.io');
      await tester.enterText(find.byKey(const Key('login_password_input')), 'WrongPassword!');
      await tester.tap(find.byKey(const Key('login_submit_button')));
      await tester.pumpAndSettle();

      // Password input should be cleared, email remains
      final passwordFinder = find.byKey(const Key('login_password_input'));
      final passwordField = tester.widget<TextFormField>(passwordFinder);
      expect(passwordField.controller?.text, isEmpty);

      final emailFinder = find.byKey(const Key('login_email_input'));
      final emailField = tester.widget<TextFormField>(emailFinder);
      expect(emailField.controller?.text, 'operator@plant.io');
    });

    testWidgets('renders Create account button and link', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('login_create_account_button')), findsOneWidget);
      expect(find.text('Create account'), findsOneWidget);
    });
  });
}
