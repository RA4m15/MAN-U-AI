import 'package:dio/dio.dart';
import '../storage/secure_storage_service.dart';

/// Interceptor that attaches the Bearer token to outgoing HTTP requests
/// and handles 401 Unauthorized responses by clearing stored credentials.
class AuthInterceptor extends Interceptor {
  final SecureStorageService storage;
  final void Function()? onUnauthorized;

  AuthInterceptor({
    required this.storage,
    this.onUnauthorized,
  });

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Never print or expose tokens or auth headers to logs
    final token = await storage.getToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    options.headers['Content-Type'] = 'application/json';
    options.headers['Accept'] = 'application/json';

    return handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Do not treat a failed login or registration submission as a session expiry
      final isAuthPath = err.requestOptions.path.contains('/auth/login') ||
          err.requestOptions.path.contains('/auth/register');
      if (!isAuthPath) {
        // Clear token and user on 401 Unauthorized for protected resources
        storage.clearAll();
        onUnauthorized?.call();
      }
    }
    return handler.next(err);
  }
}
