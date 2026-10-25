import 'package:dio/dio.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../models/user_model.dart';

class AuthRepository {
  final Dio dio;
  final SecureStorageService storage;

  AuthRepository({
    required this.dio,
    required this.storage,
  });

  Future<({UserModel user, String token})> login({
    required String email,
    required String password,
  }) async {
    final response = await dio.post(
      '/auth/login',
      data: {
        'email': email.trim(),
        'password': password,
      },
    );

    final body = response.data as Map<String, dynamic>;
    if (body['success'] != true || body['data'] == null) {
      final errorMsg = (body['error'] as Map<String, dynamic>?)?['message'] as String?;
      throw Exception(errorMsg ?? 'Authentication response format invalid');
    }

    final data = body['data'] as Map<String, dynamic>;
    final token = data['token'] as String?;
    final userData = data['user'] as Map<String, dynamic>?;

    if (token == null || token.isEmpty || userData == null) {
      throw Exception('Missing token or user data in authentication response');
    }

    final user = UserModel.fromJson(userData);

    // Securely persist credentials
    try {
      await storage.saveToken(token);
      await storage.saveUser(user);
    } catch (e) {
      await storage.clearAll();
      throw Exception('Failed to securely store authentication session. Please retry.');
    }

    return (user: user, token: token);
  }

  Future<({UserModel user, String token})> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final response = await dio.post(
      '/auth/register',
      data: {
        'name': name.trim(),
        'email': email.trim().toLowerCase(),
        'password': password,
      },
    );

    final body = response.data as Map<String, dynamic>;
    if (body['success'] != true || body['data'] == null) {
      final errorMsg = (body['error'] as Map<String, dynamic>?)?['message'] as String?;
      throw Exception(errorMsg ?? 'Registration response format invalid');
    }

    final data = body['data'] as Map<String, dynamic>;
    final token = data['token'] as String?;
    final userData = data['user'] as Map<String, dynamic>?;

    if (token == null || token.isEmpty || userData == null) {
      throw Exception('Missing token or user data in registration response');
    }

    final user = UserModel.fromJson(userData);

    // Securely persist credentials
    try {
      await storage.saveToken(token);
      await storage.saveUser(user);
    } catch (e) {
      await storage.clearAll();
      throw Exception('Failed to securely store authentication session. Please retry.');
    }

    return (user: user, token: token);
  }

  Future<UserModel> getCurrentUser() async {
    final response = await dio.get('/auth/me');
    final body = response.data as Map<String, dynamic>;

    if (body['success'] != true || body['data'] == null) {
      throw Exception('Failed to retrieve user profile');
    }

    final userData = body['data'] as Map<String, dynamic>;
    final user = UserModel.fromJson(userData);
    await storage.saveUser(user);

    return user;
  }

  Future<void> logout() async {
    await storage.clearAll();
  }

  Future<String?> getStoredToken() async {
    return await storage.getToken();
  }

  Future<UserModel?> getStoredUser() async {
    return await storage.getUser();
  }
}
