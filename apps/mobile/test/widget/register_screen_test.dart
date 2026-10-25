import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/core/theme/app_theme.dart';
import 'package:manuai_mobile/features/auth/controllers/auth_controller.dart';
import 'package:manuai_mobile/features/auth/models/auth_state.dart';
import 'package:manuai_mobile/features/auth/views/register_screen.dart';

class TestAuthController extends Notifier<AuthState> implements AuthController {
  final AuthState initialState;
  String? lastName;
  String? lastEmail;
  String? lastPassword;
  bool overrideRegisterSuccess = true;

  TestAuthController([this.initialState = const Unauthenticated()]);

  @override
  AuthState build() => initialState;

  @override
  Future<void> checkAuthStatus() async {}

  @override
  Future<bool> login(String email, String password) async => true;

  @override
  Future<bool> register({
    required String name,
    required String email,
    required String password,
  }) async {
    lastName = name;
    lastEmail = email;
    lastPassword = password;
    return overrideRegisterSuccess;
  }

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
}

void main() {
  Widget createWidgetUnderTest({List<dynamic> overrides = const []}) {
    return ProviderScope(
      overrides: overrides.cast(),
      child: MaterialApp(
        theme: AppTheme.darkTheme,
        home: const RegisterScreen(),
      ),
    );
  }

  group('RegisterScreen Widget Tests', () {
    Future<void> tapSubmit(WidgetTester tester) async {
      await tester.ensureVisible(find.byKey(const Key('register_submit_button')));
      await tester.tap(find.byKey(const Key('register_submit_button')));
      await tester.pumpAndSettle();
    }

    testWidgets('renders all essential branding, inputs, and actions', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      expect(find.text('Create Technician Account'), findsOneWidget);
      expect(find.text('MAN-U-AI Copilot Access Registration'), findsOneWidget);
      expect(find.byKey(const Key('register_name_input')), findsOneWidget);
      expect(find.byKey(const Key('register_email_input')), findsOneWidget);
      expect(find.byKey(const Key('register_password_input')), findsOneWidget);
      expect(find.byKey(const Key('register_confirm_password_input')), findsOneWidget);
      expect(find.byKey(const Key('register_submit_button')), findsOneWidget);
      expect(find.byKey(const Key('register_back_to_login_button')), findsOneWidget);
      expect(find.text('Authorized Facility Personnel Only'), findsOneWidget);
    });

    testWidgets('validates required fields on empty submission', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      await tapSubmit(tester);

      expect(find.text('Please enter your full name'), findsOneWidget);
      expect(find.text('Please enter your email address'), findsOneWidget);
      expect(find.text('Please enter a password'), findsOneWidget);
      expect(find.text('Please confirm your password'), findsOneWidget);
    });

    testWidgets('validates full name minimum length', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('register_name_input')), 'A');
      await tapSubmit(tester);

      expect(find.text('Full name must be at least 2 characters'), findsOneWidget);
    });

    testWidgets('validates malformed email addresses', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('register_email_input')), 'bad-email');
      await tapSubmit(tester);

      expect(find.text('Please enter a valid email address'), findsOneWidget);
    });

    testWidgets('validates password minimum length (8 characters)', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('register_password_input')), 'short');
      await tapSubmit(tester);

      expect(find.text('Password must be at least 8 characters'), findsOneWidget);
    });

    testWidgets('validates password confirmation mismatch', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('register_password_input')), 'ValidPassword123!');
      await tester.enterText(find.byKey(const Key('register_confirm_password_input')), 'DifferentPassword123!');
      await tapSubmit(tester);

      expect(find.text('Passwords do not match'), findsOneWidget);
    });

    testWidgets('toggles password visibility for both password inputs', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      TextField getField(Key key) {
        return tester.widget<TextField>(
          find.descendant(of: find.byKey(key), matching: find.byType(TextField)),
        );
      }

      // Initially both obscureText are true
      expect(getField(const Key('register_password_input')).obscureText, isTrue);
      expect(getField(const Key('register_confirm_password_input')).obscureText, isTrue);

      // Toggle main password
      await tester.ensureVisible(find.byKey(const Key('register_password_toggle')));
      await tester.tap(find.byKey(const Key('register_password_toggle')));
      await tester.pumpAndSettle();

      expect(getField(const Key('register_password_input')).obscureText, isFalse);

      // Toggle confirm password
      await tester.ensureVisible(find.byKey(const Key('register_confirm_password_toggle')));
      await tester.tap(find.byKey(const Key('register_confirm_password_toggle')));
      await tester.pumpAndSettle();

      expect(getField(const Key('register_confirm_password_input')).obscureText, isFalse);
    });

    testWidgets('submits registration parameters to controller when inputs are valid', (tester) async {
      final testController = TestAuthController();

      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('register_name_input')), 'Marcus Vance');
      await tester.enterText(find.byKey(const Key('register_email_input')), 'marcus.v@plant.io');
      await tester.enterText(find.byKey(const Key('register_password_input')), 'SecurePassword123!');
      await tester.enterText(find.byKey(const Key('register_confirm_password_input')), 'SecurePassword123!');

      await tapSubmit(tester);

      expect(testController.lastName, equals('Marcus Vance'));
      expect(testController.lastEmail, equals('marcus.v@plant.io'));
      expect(testController.lastPassword, equals('SecurePassword123!'));
    });

    testWidgets('displays error banner when Unauthenticated contains an error message', (tester) async {
      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(
              () => TestAuthController(
                const Unauthenticated(errorMessage: 'A user with this email address is already registered.'),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('register_error_banner')), findsOneWidget);
      expect(find.text('A user with this email address is already registered.'), findsOneWidget);
      expect(find.byKey(const Key('register_test_connection_button')), findsOneWidget);
    });

    testWidgets('shows loading indicator and disables submit button when AuthLoading', (tester) async {
      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(
              () => TestAuthController(const AuthLoading()),
            ),
          ],
        ),
      );
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsWidgets);
      final submitButton = tester.widget<ElevatedButton>(find.byKey(const Key('register_submit_button')));
      expect(submitButton.onPressed, isNull);
    });

    testWidgets('retains in-memory form values including password on failed registration for retry', (tester) async {
      final testController = TestAuthController();
      testController.overrideRegisterSuccess = false;

      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('register_name_input')), 'Marcus Vance');
      await tester.enterText(find.byKey(const Key('register_email_input')), 'marcus.v@plant.io');
      await tester.enterText(find.byKey(const Key('register_password_input')), 'WrongPassword123!');
      await tester.enterText(find.byKey(const Key('register_confirm_password_input')), 'WrongPassword123!');

      await tapSubmit(tester);

      // Password and confirm password should remain in memory for quick correction/retry
      final passField = tester.widget<TextFormField>(find.byKey(const Key('register_password_input')));
      expect(passField.controller?.text, 'WrongPassword123!');

      final confirmField = tester.widget<TextFormField>(find.byKey(const Key('register_confirm_password_input')));
      expect(confirmField.controller?.text, 'WrongPassword123!');

      // Name and email should also remain intact
      final nameField = tester.widget<TextFormField>(find.byKey(const Key('register_name_input')));
      expect(nameField.controller?.text, 'Marcus Vance');
      final emailField = tester.widget<TextFormField>(find.byKey(const Key('register_email_input')));
      expect(emailField.controller?.text, 'marcus.v@plant.io');
    });

    testWidgets('clears sensitive password fields when registration succeeds', (tester) async {
      final testController = TestAuthController();
      testController.overrideRegisterSuccess = true;

      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('register_name_input')), 'Marcus Vance');
      await tester.enterText(find.byKey(const Key('register_email_input')), 'marcus.v@plant.io');
      await tester.enterText(find.byKey(const Key('register_password_input')), 'GoodPassword123!');
      await tester.enterText(find.byKey(const Key('register_confirm_password_input')), 'GoodPassword123!');

      await tapSubmit(tester);

      final passField = tester.widget<TextFormField>(find.byKey(const Key('register_password_input')));
      expect(passField.controller?.text, isEmpty);

      final confirmField = tester.widget<TextFormField>(find.byKey(const Key('register_confirm_password_input')));
      expect(confirmField.controller?.text, isEmpty);
    });

    testWidgets('shows direct sign-in button when error mentions existing registration', (tester) async {
      final testController = TestAuthController(
        const Unauthenticated(errorMessage: 'A user with this email address is already registered. Please sign in or use a different email.'),
      );

      await tester.pumpWidget(
        createWidgetUnderTest(
          overrides: [
            authControllerProvider.overrideWith(() => testController),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('register_error_banner')), findsOneWidget);
      expect(find.byKey(const Key('register_error_signin_button')), findsOneWidget);
      expect(find.text('Sign in now'), findsOneWidget);
    });
  });
}
