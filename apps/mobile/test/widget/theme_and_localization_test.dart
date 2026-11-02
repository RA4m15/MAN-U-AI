import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/core/localization/locale_notifier.dart';
import 'package:manuai_mobile/core/storage/secure_storage_service.dart';
import 'package:manuai_mobile/core/theme/app_colors.dart';
import 'package:manuai_mobile/core/theme/app_theme.dart';
import 'package:manuai_mobile/core/theme/theme_notifier.dart';
import 'package:manuai_mobile/features/auth/controllers/auth_controller.dart';
import 'package:manuai_mobile/features/auth/models/auth_state.dart';
import 'package:manuai_mobile/features/auth/models/user_model.dart';
import 'package:manuai_mobile/features/settings/views/settings_screen.dart';
import 'package:manuai_mobile/l10n/app_localizations.dart';

class InMemorySecureStorage extends SecureStorageService {
  final Map<String, String> _memory = {};

  @override
  Future<void> write(String key, String value) async {
    _memory[key] = value;
  }

  @override
  Future<String?> read(String key) async {
    return _memory[key];
  }

  @override
  Future<void> delete(String key) async {
    _memory.remove(key);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late InMemorySecureStorage storage;

  setUp(() {
    storage = InMemorySecureStorage();
  });

  Widget buildTestableSettingsApp({
    ThemeMode initialTheme = ThemeMode.light,
    Locale initialLocale = const Locale('en'),
  }) {
    return ProviderScope(
      overrides: [
        secureStorageProvider.overrideWithValue(storage),
        authControllerProvider.overrideWith(() => _FakeAuthController()),
      ],
      child: Consumer(
        builder: (context, ref, _) {
          final themeMode = ref.watch(themeNotifierProvider);
          final locale = ref.watch(localeNotifierProvider);

          return MaterialApp(
            title: 'MAN-U-AI Test',
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeMode,
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const SettingsScreen(),
          );
        },
      ),
    );
  }

  group('4-Combination Matrix & Persistence Tests', () {
    testWidgets('Combination 1: English + Light Theme', (tester) async {
      await storage.write('manuai_theme_mode', 'light');
      await storage.write('manuai_selected_locale', 'en');

      await tester.pumpWidget(buildTestableSettingsApp());
      await tester.pumpAndSettle();

      // Verify English strings appear
      expect(find.text('SETTINGS & PREFERENCES'), findsOneWidget);
      expect(find.text('APPEARANCE'), findsOneWidget);
      expect(find.text('Light Mode'), findsOneWidget);
      expect(find.text('English'), findsOneWidget);

      // Verify Light theme brightness
      final theme = Theme.of(tester.element(find.byType(SettingsScreen)));
      expect(theme.brightness, equals(Brightness.light));
      expect(theme.scaffoldBackgroundColor, equals(AppColors.background));
    });

    testWidgets('Combination 2: English + Dark Theme via immediate toggle', (tester) async {
      await storage.write('manuai_theme_mode', 'light');
      await storage.write('manuai_selected_locale', 'en');

      await tester.pumpWidget(buildTestableSettingsApp());
      await tester.pumpAndSettle();

      // Tap Dark Mode option
      final darkModeOption = find.byKey(const Key('theme_option_dark'));
      expect(darkModeOption, findsOneWidget);
      await tester.tap(darkModeOption);
      await tester.pumpAndSettle();

      // Verify theme immediately updated to dark
      final theme = Theme.of(tester.element(find.byType(SettingsScreen)));
      expect(theme.brightness, equals(Brightness.dark));
      expect(theme.scaffoldBackgroundColor, equals(AppColors.darkBackground));

      // Verify preference was persisted
      final persistedMode = await storage.read('manuai_theme_mode');
      expect(persistedMode, equals('dark'));
    });

    testWidgets('Combination 3: Hindi + Light Theme without overflow', (tester) async {
      // Set 360x640 mobile viewport (standard compact Android layout)
      tester.view.physicalSize = const Size(360 * 3, 640 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await storage.write('manuai_theme_mode', 'light');
      await storage.write('manuai_selected_locale', 'hi');

      await tester.pumpWidget(buildTestableSettingsApp());
      await tester.pumpAndSettle();

      // Verify Hindi strings appear
      expect(find.text('सेटिंग्स एवं प्राथमिकताएं'), findsOneWidget);
      expect(find.text('दिखावट (APPEARANCE)'), findsOneWidget);
      expect(find.text('लाइट मोड (Light)'), findsOneWidget);
      expect(find.text('हिन्दी (Hindi)'), findsOneWidget);

      // Verify Light theme
      final theme = Theme.of(tester.element(find.byType(SettingsScreen)));
      expect(theme.brightness, equals(Brightness.light));

      // Verify no exceptions or overflow occurred
      expect(tester.takeException(), isNull);
    });

    testWidgets('Combination 4: Hindi + Dark Theme via immediate toggle', (tester) async {
      tester.view.physicalSize = const Size(360 * 3, 640 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await storage.write('manuai_theme_mode', 'dark');
      await storage.write('manuai_selected_locale', 'hi');

      await tester.pumpWidget(buildTestableSettingsApp());
      await tester.pumpAndSettle();

      // Verify Hindi strings
      expect(find.text('सेटिंग्स एवं प्राथमिकताएं'), findsOneWidget);
      expect(find.text('डार्क मोड (Dark)'), findsOneWidget);

      // Verify Dark theme
      final theme = Theme.of(tester.element(find.byType(SettingsScreen)));
      expect(theme.brightness, equals(Brightness.dark));
      expect(theme.scaffoldBackgroundColor, equals(AppColors.darkBackground));

      // Tap English option to test immediate language switch
      final enOption = find.byKey(const Key('language_option_en'));
      await tester.tap(enOption);
      await tester.pumpAndSettle();

      // Verify immediate update to English
      expect(find.text('SETTINGS & PREFERENCES'), findsOneWidget);
      expect(find.text('APPEARANCE'), findsOneWidget);

      // Verify persistence of new language
      final persistedLocale = await storage.read('manuai_selected_locale');
      expect(persistedLocale, equals('en'));
    });

    test('Theme and Locale restore properly after app restart', () async {
      // Simulate stored preferences from prior session
      await storage.write('manuai_theme_mode', 'dark');
      await storage.write('manuai_selected_locale', 'hi');

      final container = ProviderContainer(
        overrides: [
          secureStorageProvider.overrideWithValue(storage),
        ],
      );

      final themeNotifier = container.read(themeNotifierProvider.notifier);
      final localeNotifier = container.read(localeNotifierProvider.notifier);

      // Yield execution to allow microtasks to finish
      await Future<void>.delayed(Duration.zero);

      expect(container.read(themeNotifierProvider), equals(ThemeMode.dark));
      expect(container.read(localeNotifierProvider), equals(const Locale('hi')));

      // Change preferences
      await themeNotifier.setThemeMode(ThemeMode.light);
      await localeNotifier.setLocale(const Locale('en'));

      expect(container.read(themeNotifierProvider), equals(ThemeMode.light));
      expect(container.read(localeNotifierProvider), equals(const Locale('en')));
      expect(await storage.read('manuai_theme_mode'), equals('light'));
      expect(await storage.read('manuai_selected_locale'), equals('en'));

      container.dispose();
    });
  });
}

class _FakeAuthController extends Notifier<AuthState> implements AuthController {
  @override
  AuthState build() {
    return const Authenticated(
      user: UserModel(
        id: 'usr-test-101',
        email: 'engineer@plant.io',
        name: 'Chief Test Engineer',
        role: 'engineer',
      ),
      token: 'mock-jwt-token',
    );
  }

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
    return (isHealthy: true, statusMessage: 'Healthy', statusCode: 200);
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
