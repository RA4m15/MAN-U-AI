import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/features/auth/controllers/auth_controller.dart';
import 'package:manuai_mobile/features/auth/models/auth_state.dart';
import 'package:manuai_mobile/features/auth/models/user_model.dart';
import 'package:manuai_mobile/features/auth/repositories/auth_repository.dart';
import 'package:mocktail/mocktail.dart';

class MockAuthRepository extends Mock implements AuthRepository {}

void main() {
  late MockAuthRepository mockRepository;
  late ProviderContainer container;

  const testUser = UserModel(
    id: 'usr-6001',
    name: 'Alex Mercer',
    email: 'alex.mercer@plant.io',
    role: 'engineer',
  );

  const adminUser = UserModel(
    id: 'usr-admin-99',
    name: 'Elena Rostova',
    email: 'admin@plant.io',
    role: 'admin',
  );

  setUp(() {
    mockRepository = MockAuthRepository();

    // Default: no stored token
    when(() => mockRepository.getStoredToken()).thenAnswer((_) async => null);
    when(() => mockRepository.getStoredUser()).thenAnswer((_) async => null);
    when(() => mockRepository.logout()).thenAnswer((_) async {});

    container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(mockRepository),
      ],
    );
  });

  tearDown(() {
    container.dispose();
  });

  group('AuthController initial state and session check', () {
    test('transitions to Unauthenticated when no token is stored', () async {
      container.read(authControllerProvider.notifier);
      await Future<void>.delayed(Duration.zero);

      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
    });

    test('transitions to Authenticated when stored token and profile are valid', () async {
      when(() => mockRepository.getStoredToken()).thenAnswer((_) async => 'stored-jwt-token');
      when(() => mockRepository.getCurrentUser()).thenAnswer((_) async => testUser);

      container.read(authControllerProvider.notifier);
      await Future<void>.delayed(Duration.zero);

      final state = container.read(authControllerProvider);
      expect(state, isA<Authenticated>());
      final authState = state as Authenticated;
      expect(authState.user.email, equals(testUser.email));
      expect(authState.token, equals('stored-jwt-token'));
    });

    test('clears storage and transitions to Unauthenticated if stored token fails verification', () async {
      when(() => mockRepository.getStoredToken()).thenAnswer((_) async => 'expired-token');
      when(() => mockRepository.getCurrentUser()).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/me'),
          response: Response(statusCode: 401, requestOptions: RequestOptions(path: '/auth/me')),
        ),
      );

      container.read(authControllerProvider.notifier);
      await Future<void>.delayed(Duration.zero);

      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      verify(() => mockRepository.logout()).called(1);
    });

    test('rejects admin stored sessions during restoration and clears credentials', () async {
      when(() => mockRepository.getStoredToken()).thenAnswer((_) async => 'admin-jwt-token');
      when(() => mockRepository.getCurrentUser()).thenAnswer((_) async => adminUser);

      container.read(authControllerProvider.notifier);
      await Future<void>.delayed(Duration.zero);

      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauth = state as Unauthenticated;
      expect(unauth.errorMessage, equals('Admin accounts must use the MAN-U-AI Admin Panel.'));
      verify(() => mockRepository.logout()).called(1);
    });
  });

  group('AuthController.login', () {
    test('transitions to Authenticated on successful credentials', () async {
      when(() => mockRepository.login(email: 'alex.mercer@plant.io', password: 'Password123!'))
          .thenAnswer((_) async => (user: testUser, token: 'new-jwt-token'));

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.login('alex.mercer@plant.io', 'Password123!');

      expect(success, isTrue);
      final state = container.read(authControllerProvider);
      expect(state, isA<Authenticated>());
      final authState = state as Authenticated;
      expect(authState.user.name, equals('Alex Mercer'));
      expect(authState.token, equals('new-jwt-token'));
    });

    test('denies admin login, clears credentials, and displays admin panel directive', () async {
      when(() => mockRepository.login(email: 'admin@plant.io', password: 'AdminPassword123!'))
          .thenAnswer((_) async => (user: adminUser, token: 'admin-jwt-token'));

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.login('admin@plant.io', 'AdminPassword123!');

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauth = state as Unauthenticated;
      expect(unauth.errorMessage, equals('Admin accounts must use the MAN-U-AI Admin Panel.'));
      verify(() => mockRepository.logout()).called(1);
    });

    test('transitions to Unauthenticated with friendly message on 401', () async {
      when(() => mockRepository.login(email: any(named: 'email'), password: any(named: 'password')))
          .thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/login'),
          response: Response(
            statusCode: 401,
            data: {'success': false, 'error': {'code': 'INVALID_CREDENTIALS'}},
            requestOptions: RequestOptions(path: '/auth/login'),
          ),
        ),
      );

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.login('bad@plant.io', 'wrong');

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauthState = state as Unauthenticated;
      expect(unauthState.errorMessage, contains('Invalid email or password'));
    });

    test('transitions to Unauthenticated with rate-limit message on 429', () async {
      when(() => mockRepository.login(email: any(named: 'email'), password: any(named: 'password')))
          .thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/login'),
          response: Response(
            statusCode: 429,
            data: {'success': false, 'error': {'code': 'TOO_MANY_REQUESTS'}},
            requestOptions: RequestOptions(path: '/auth/login'),
          ),
        ),
      );

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.login('alex@plant.io', 'password');

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauthState = state as Unauthenticated;
      expect(unauthState.errorMessage, contains('Too many login attempts'));
    });

    test('transitions to Unauthenticated with cold-start timeout message on connectionTimeout', () async {
      when(() => mockRepository.login(email: any(named: 'email'), password: any(named: 'password')))
          .thenThrow(
        DioException(
          type: DioExceptionType.connectionTimeout,
          requestOptions: RequestOptions(path: '/auth/login'),
        ),
      );

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.login('alex@plant.io', 'password');

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauthState = state as Unauthenticated;
      expect(unauthState.errorMessage, contains('Connection timed out'));
    });

    test('transitions to Unauthenticated with reachability message on connectionError', () async {
      when(() => mockRepository.login(email: any(named: 'email'), password: any(named: 'password')))
          .thenThrow(
        DioException(
          type: DioExceptionType.connectionError,
          requestOptions: RequestOptions(path: '/auth/login'),
        ),
      );

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.login('alex@plant.io', 'password');

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauthState = state as Unauthenticated;
      expect(unauthState.errorMessage, contains('Could not reach server'));
    });

    test('transitions to Unauthenticated with server error message on 500/503', () async {
      when(() => mockRepository.login(email: any(named: 'email'), password: any(named: 'password')))
          .thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/login'),
          response: Response(
            statusCode: 503,
            requestOptions: RequestOptions(path: '/auth/login'),
          ),
        ),
      );

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.login('alex@plant.io', 'password');

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauthState = state as Unauthenticated;
      expect(unauthState.errorMessage, contains('MAN-U-AI server error'));
    });

    test('clearError resets errorMessage to null without changing unauthenticated status', () async {
      when(() => mockRepository.login(email: any(named: 'email'), password: any(named: 'password')))
          .thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/login'),
          response: Response(statusCode: 401, requestOptions: RequestOptions(path: '/auth/login')),
        ),
      );

      final controller = container.read(authControllerProvider.notifier);
      await controller.login('test@plant.io', 'wrong');

      expect((container.read(authControllerProvider) as Unauthenticated).errorMessage, isNotNull);

      controller.clearError();
      expect((container.read(authControllerProvider) as Unauthenticated).errorMessage, isNull);
    });
  });

  group('AuthController.logout & session handling', () {
    test('logout clears credentials and returns to Unauthenticated state', () async {
      when(() => mockRepository.logout()).thenAnswer((_) async {});

      final controller = container.read(authControllerProvider.notifier);
      await controller.logout();

      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      verify(() => mockRepository.logout()).called(1);
    });

    test('handleUnauthorized sets isSessionExpired and notification message', () {
      final controller = container.read(authControllerProvider.notifier);
      controller.handleUnauthorized();

      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauthState = state as Unauthenticated;
      expect(unauthState.isSessionExpired, isTrue);
      expect(unauthState.errorMessage, contains('Session expired'));
    });
  });

  group('AuthController.register', () {
    test('transitions to Authenticated on successful registration', () async {
      when(() => mockRepository.register(
            name: 'Marcus Vance',
            email: 'marcus.v@plant.io',
            password: 'Password123!',
          )).thenAnswer((_) async => (user: testUser, token: 'registered-jwt'));

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.register(
        name: 'Marcus Vance',
        email: 'marcus.v@plant.io',
        password: 'Password123!',
      );

      expect(success, isTrue);
      final state = container.read(authControllerProvider);
      expect(state, isA<Authenticated>());
      final authState = state as Authenticated;
      expect(authState.user.email, equals(testUser.email));
      expect(authState.token, equals('registered-jwt'));
    });

    test('denies admin registration, clears credentials, and displays admin panel directive', () async {
      when(() => mockRepository.register(
            name: 'Elena Rostova',
            email: 'admin@plant.io',
            password: 'Password123!',
          )).thenAnswer((_) async => (user: adminUser, token: 'admin-jwt'));

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.register(
        name: 'Elena Rostova',
        email: 'admin@plant.io',
        password: 'Password123!',
      );

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauth = state as Unauthenticated;
      expect(unauth.errorMessage, equals('Admin accounts must use the MAN-U-AI Admin Panel.'));
      verify(() => mockRepository.logout()).called(1);
    });

    test('transitions to Unauthenticated with duplicate message on 409', () async {
      when(() => mockRepository.register(
            name: any(named: 'name'),
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/register'),
          response: Response(
            statusCode: 409,
            data: {'success': false, 'error': {'code': 'USER_EXISTS'}},
            requestOptions: RequestOptions(path: '/auth/register'),
          ),
        ),
      );

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.register(
        name: 'Existing User',
        email: 'existing@plant.io',
        password: 'Password123!',
      );

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauth = state as Unauthenticated;
      expect(unauth.errorMessage, contains('already registered'));
    });

    test('transitions to Unauthenticated with restriction message on 403', () async {
      when(() => mockRepository.register(
            name: any(named: 'name'),
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/register'),
          response: Response(
            statusCode: 403,
            data: {
              'success': false,
              'error': {
                'code': 'REGISTRATION_RESTRICTED',
                'message': 'Public self-registration is disabled in production.',
              },
            },
            requestOptions: RequestOptions(path: '/auth/register'),
          ),
        ),
      );

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.register(
        name: 'Public User',
        email: 'public@plant.io',
        password: 'Password123!',
      );

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauth = state as Unauthenticated;
      expect(unauth.errorMessage, contains('Public self-registration is disabled'));
    });

    test('transitions to Unauthenticated with connection message on timeout', () async {
      when(() => mockRepository.register(
            name: any(named: 'name'),
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenThrow(
        DioException(
          type: DioExceptionType.connectionTimeout,
          requestOptions: RequestOptions(path: '/auth/register'),
        ),
      );

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.register(
        name: 'Network User',
        email: 'net@plant.io',
        password: 'Password123!',
      );

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauth = state as Unauthenticated;
      expect(unauth.errorMessage, contains('Connection timed out'));
    });

    test('transitions to Unauthenticated with validation message on 400', () async {
      when(() => mockRepository.register(
            name: any(named: 'name'),
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/register'),
          response: Response(
            statusCode: 400,
            data: {
              'success': false,
              'error': {'code': 'VALIDATION_ERROR', 'message': 'Password must be at least 8 characters.'},
            },
            requestOptions: RequestOptions(path: '/auth/register'),
          ),
        ),
      );

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.register(
        name: 'Short Password',
        email: 'short@plant.io',
        password: 'short',
      );

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauth = state as Unauthenticated;
      expect(unauth.errorMessage, contains('Password must be at least 8 characters'));
    });

    test('transitions to Unauthenticated with rate limit message on 429', () async {
      when(() => mockRepository.register(
            name: any(named: 'name'),
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/register'),
          response: Response(
            statusCode: 429,
            data: {'success': false, 'error': {'code': 'RATE_LIMIT'}},
            requestOptions: RequestOptions(path: '/auth/register'),
          ),
        ),
      );

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.register(
        name: 'Rapid User',
        email: 'rapid@plant.io',
        password: 'Password123!',
      );

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauth = state as Unauthenticated;
      expect(unauth.errorMessage, contains('Too many registration attempts'));
    });

    test('transitions to Unauthenticated with server error message on 500', () async {
      when(() => mockRepository.register(
            name: any(named: 'name'),
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/register'),
          response: Response(
            statusCode: 500,
            data: {'success': false},
            requestOptions: RequestOptions(path: '/auth/register'),
          ),
        ),
      );

      final controller = container.read(authControllerProvider.notifier);
      final success = await controller.register(
        name: 'Server Error User',
        email: 'server@plant.io',
        password: 'Password123!',
      );

      expect(success, isFalse);
      final state = container.read(authControllerProvider);
      expect(state, isA<Unauthenticated>());
      final unauth = state as Unauthenticated;
      expect(unauth.errorMessage, contains('MAN-U-AI server error (500)'));
    });
  });
}
