import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:manuai_mobile/core/storage/secure_storage_service.dart';
import 'package:manuai_mobile/features/auth/models/user_model.dart';
import 'package:manuai_mobile/features/auth/repositories/auth_repository.dart';
import 'package:mocktail/mocktail.dart';

class MockSecureStorageService extends Mock implements SecureStorageService {}

void main() {
  late Dio dio;
  late DioAdapter dioAdapter;
  late MockSecureStorageService mockStorage;
  late AuthRepository repository;

  setUpAll(() {
    registerFallbackValue(
      const UserModel(
        id: 'fallback-id',
        name: 'Fallback User',
        email: 'fallback@test.io',
        role: 'operator',
      ),
    );
  });

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'http://localhost:4000/api/v1'));
    dioAdapter = DioAdapter(dio: dio);
    mockStorage = MockSecureStorageService();
    repository = AuthRepository(dio: dio, storage: mockStorage);

    when(() => mockStorage.saveToken(any())).thenAnswer((_) async {});
    when(() => mockStorage.saveUser(any())).thenAnswer((_) async {});
    when(() => mockStorage.clearAll()).thenAnswer((_) async {});
  });

  group('AuthRepository.login', () {
    test('successfully authenticates and saves credentials on valid response', () async {
      const email = 'alex.mercer@plant.io';
      const password = 'CorrectPassword123!';
      const token = 'fake-jwt-token-string';

      final mockResponse = {
        'success': true,
        'data': {
          'token': token,
          'user': {
            'id': 'usr-6001',
            'name': 'Alex Mercer',
            'email': email,
            'role': 'engineer',
            'createdAt': '2026-10-24T00:00:00.000Z',
          },
        },
      };

      dioAdapter.onPost(
        '/auth/login',
        (server) => server.reply(200, mockResponse),
        data: {'email': email, 'password': password},
      );

      final result = await repository.login(email: email, password: password);

      expect(result.token, equals(token));
      expect(result.user.id, equals('usr-6001'));
      expect(result.user.name, equals('Alex Mercer'));
      expect(result.user.role, equals('engineer'));

      verify(() => mockStorage.saveToken(token)).called(1);
      verify(() => mockStorage.saveUser(any(that: isA<UserModel>()))).called(1);
    });

    test('throws DioException when server returns 401 invalid credentials', () async {
      const email = 'alex.mercer@plant.io';
      const password = 'WrongPassword';

      dioAdapter.onPost(
        '/auth/login',
        (server) => server.reply(
          401,
          {
            'success': false,
            'error': {'code': 'INVALID_CREDENTIALS', 'message': 'Invalid email or password'},
          },
        ),
      );

      expect(
        () => repository.login(email: email, password: password),
        throwsA(isA<DioException>()),
      );
      verifyNever(() => mockStorage.saveToken(any()));
    });

    test('throws Exception when response body is missing token or user data', () async {
      const email = 'alex.mercer@plant.io';
      const password = 'Password123!';

      dioAdapter.onPost(
        '/auth/login',
        (server) => server.reply(200, {'success': true, 'data': {}}),
      );

      expect(
        () => repository.login(email: email, password: password),
        throwsA(isA<Exception>()),
      );
    });

    test('throws DioException on 500 server failure', () async {
      dioAdapter.onPost(
        '/auth/login',
        (server) => server.reply(500, {'success': false, 'error': {'code': 'SERVER_ERROR'}}),
      );

      expect(
        () => repository.login(email: 'user@plant.io', password: 'password'),
        throwsA(isA<DioException>()),
      );
    });
  });

  group('AuthRepository.getCurrentUser', () {
    test('fetches and returns current user profile from /auth/me', () async {
      final mockMeResponse = {
        'success': true,
        'data': {
          'id': 'usr-6001',
          'name': 'Alex Mercer',
          'email': 'alex.mercer@plant.io',
          'role': 'engineer',
        },
      };

      dioAdapter.onGet(
        '/auth/me',
        (server) => server.reply(200, mockMeResponse),
      );

      final user = await repository.getCurrentUser();

      expect(user.id, equals('usr-6001'));
      expect(user.role, equals('engineer'));
      verify(() => mockStorage.saveUser(any(that: isA<UserModel>()))).called(1);
    });
  });

  group('AuthRepository.logout', () {
    test('clears all credentials from secure storage', () async {
      await repository.logout();
      verify(() => mockStorage.clearAll()).called(1);
    });
  });

  group('AuthRepository.register', () {
    test('successfully registers and saves token and user to secure storage', () async {
      const name = 'Marcus Vance';
      const email = 'marcus.v@plant.io';
      const password = 'Password123!';
      const token = 'jwt-registered-token-789';

      final mockResponse = {
        'success': true,
        'data': {
          'token': token,
          'user': {
            'id': 'usr-7001',
            'name': name,
            'email': email,
            'role': 'viewer',
            'createdAt': '2026-10-24T00:00:00.000Z',
          },
        },
      };

      dioAdapter.onPost(
        '/auth/register',
        (server) => server.reply(201, mockResponse),
        data: {'name': name, 'email': email, 'password': password},
      );

      final result = await repository.register(name: name, email: email, password: password);

      expect(result.token, equals(token));
      expect(result.user.id, equals('usr-7001'));
      expect(result.user.name, equals(name));
      expect(result.user.role, equals('viewer'));

      verify(() => mockStorage.saveToken(token)).called(1);
      verify(() => mockStorage.saveUser(any(that: isA<UserModel>()))).called(1);
    });

    test('throws DioException when server returns 409 duplicate email', () async {
      dioAdapter.onPost(
        '/auth/register',
        (server) => server.reply(
          409,
          {
            'success': false,
            'error': {'code': 'USER_EXISTS', 'message': 'A user with this email address is already registered'},
          },
        ),
      );

      expect(
        () => repository.register(name: 'Jane', email: 'jane@plant.io', password: 'Password123!'),
        throwsA(isA<DioException>()),
      );
    });

    test('clears storage and throws exception when secure storage fails after registration', () async {
      const name = 'Failed Storage User';
      const email = 'failstore@plant.io';
      const password = 'Password123!';

      dioAdapter.onPost(
        '/auth/register',
        (server) => server.reply(201, {
          'success': true,
          'data': {
            'token': 'valid-jwt-token',
            'user': {
              'id': 'usr-fail-1',
              'name': name,
              'email': email,
              'role': 'viewer',
            },
          },
        }),
        data: {'name': name, 'email': email, 'password': password},
      );

      when(() => mockStorage.saveToken(any())).thenAnswer((_) => Future.error(Exception('Disk write failure')));

      await expectLater(
        () => repository.register(name: name, email: email, password: password),
        throwsA(isA<Exception>()),
      );
      verify(() => mockStorage.clearAll()).called(1);
    });
  });
}
