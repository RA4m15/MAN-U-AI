import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/env_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../models/auth_state.dart';
import '../repositories/auth_repository.dart';

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return ApiClient(
    storage: storage,
    onUnauthorized: () {
      ref.read(authControllerProvider.notifier).handleUnauthorized();
    },
  );
});

final dioProvider = Provider<Dio>((ref) {
  return ref.watch(apiClientProvider).dio;
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final storage = ref.watch(secureStorageProvider);
  final dio = ref.watch(dioProvider);
  return AuthRepository(dio: dio, storage: storage);
});

final authControllerProvider = NotifierProvider<AuthController, AuthState>(() {
  return AuthController();
});

class AuthController extends Notifier<AuthState> {
  late final AuthRepository _repository;

  @override
  AuthState build() {
    _repository = ref.watch(authRepositoryProvider);
    // Trigger initial auth check
    Future.microtask(() => checkAuthStatus());
    return const AuthInitial();
  }

  Future<void> checkAuthStatus() async {
    final token = await _repository.getStoredToken();
    if (token == null || token.isEmpty) {
      state = const Unauthenticated();
      return;
    }

    try {
      final user = await _repository.getCurrentUser();
      // Enforce strict separation: admin accounts must use the Admin Panel
      if (user.role == 'admin') {
        await _repository.logout();
        state = const Unauthenticated(
          errorMessage: 'Admin accounts must use the MAN-U-AI Admin Panel.',
        );
        return;
      }
      state = Authenticated(user: user, token: token);
    } catch (e) {
      // If token verification fails (e.g. 401 expired), clear storage and return unauthenticated
      await _repository.logout();
      state = const Unauthenticated();
    }
  }

  Future<bool> login(String email, String password) async {
    // Prevent repeated submissions while loading
    if (state is AuthLoading) {
      return false;
    }

    // Guard against invalid build or configuration
    final configErr = EnvConfig.configurationError;
    if (configErr != null) {
      state = Unauthenticated(errorMessage: configErr);
      return false;
    }

    state = const AuthLoading();
    try {
      final result = await _repository.login(
        email: email,
        password: password,
      );

      // Enforce strict separation: admin accounts must use the Admin Panel
      if (result.user.role == 'admin') {
        await _repository.logout();
        state = const Unauthenticated(
          errorMessage: 'Admin accounts must use the MAN-U-AI Admin Panel.',
        );
        return false;
      }

      state = Authenticated(user: result.user, token: result.token);
      return true;
    } on DioException catch (dioErr) {
      final statusCode = dioErr.response?.statusCode;
      String message;

      if (statusCode == 401) {
        message = 'Invalid email or password.';
      } else if (statusCode == 403) {
        message = 'Access forbidden. Please check your account permissions or server security settings.';
      } else if (statusCode == 429) {
        message = 'Too many login attempts. Please wait 15 minutes before trying again.';
      } else if (statusCode == 400) {
        final serverMsg = (dioErr.response?.data as Map<String, dynamic>?)?['error']?['message'] as String?;
        message = serverMsg ?? 'Invalid email format or missing credentials.';
      } else if (statusCode != null && statusCode >= 500) {
        message = 'MAN-U-AI server error ($statusCode). The backend service may be temporarily unavailable.';
      } else if (dioErr.type == DioExceptionType.connectionTimeout) {
        message = 'Connection timed out. The server may be waking up from sleep (cold start). Please retry in a few seconds.';
      } else if (dioErr.type == DioExceptionType.receiveTimeout) {
        message = 'Server took too long to respond (receive timeout). Please check your connection and retry.';
      } else if (dioErr.type == DioExceptionType.sendTimeout) {
        message = 'Request sending timed out. Please check your network connection.';
      } else if (dioErr.type == DioExceptionType.badCertificate) {
        message = 'Secure TLS certificate verification failed. Please verify your device date/time or server certificate.';
      } else if (dioErr.type == DioExceptionType.connectionError) {
        final host = Uri.tryParse(EnvConfig.apiBaseUrl)?.host ?? 'server';
        final errString = dioErr.error?.toString() ?? '';
        if (errString.contains('HandshakeException') ||
            errString.contains('TlsException') ||
            errString.contains('CertificateException')) {
          message = 'Secure TLS handshake failed for $host. Please check network security settings.';
        } else {
          message = 'Could not reach server at $host. Please check your internet connection or server address.';
        }
      } else {
        message = 'Authentication failed. Please check your network connection and retry.';
      }

      state = Unauthenticated(errorMessage: message);
      return false;
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      state = Unauthenticated(errorMessage: msg.isNotEmpty ? msg : 'An unexpected error occurred during login.');
      return false;
    }
  }

  Future<bool> register({
    required String name,
    required String email,
    required String password,
  }) async {
    // Prevent repeated submissions while loading
    if (state is AuthLoading) {
      return false;
    }

    // Guard against invalid build or configuration
    final configErr = EnvConfig.configurationError;
    if (configErr != null) {
      state = Unauthenticated(errorMessage: configErr);
      return false;
    }

    state = const AuthLoading();
    try {
      final result = await _repository.register(
        name: name,
        email: email,
        password: password,
      );

      // Defend client boundary against admin accounts
      if (result.user.role == 'admin') {
        await _repository.logout();
        state = const Unauthenticated(
          errorMessage: 'Admin accounts must use the MAN-U-AI Admin Panel.',
        );
        return false;
      }

      state = Authenticated(user: result.user, token: result.token);
      return true;
    } on DioException catch (dioErr) {
      final statusCode = dioErr.response?.statusCode;
      final responseData = dioErr.response?.data;
      String? serverCode;
      String? serverMsg;
      if (responseData is Map<String, dynamic>) {
        final err = responseData['error'];
        if (err is Map<String, dynamic>) {
          serverCode = err['code'] as String?;
          serverMsg = err['message'] as String?;
        }
      }
      String message;

      if (statusCode == 409 || serverCode == 'USER_EXISTS') {
        message = 'A user with this email address is already registered. Please sign in or use a different email.';
      } else if (statusCode == 403 || serverCode == 'REGISTRATION_RESTRICTED') {
        message = serverMsg ??
            'Public self-registration is disabled in production. Accounts must be provisioned by an administrator.';
      } else if (serverCode == 'ROLE_UNAUTHORIZED') {
        message = serverMsg ??
            'Administrator accounts cannot be self-registered. Administrator privileges require authorized internal provisioning.';
      } else if (statusCode == 429) {
        message = 'Too many registration attempts. Please wait a few minutes before trying again.';
      } else if (statusCode == 400) {
        message = serverMsg ?? 'Invalid registration information. Please check all fields.';
      } else if (statusCode != null && statusCode >= 500) {
        message = 'MAN-U-AI server error ($statusCode). The registration service may be temporarily unavailable.';
      } else if (dioErr.type == DioExceptionType.connectionTimeout) {
        message = 'Connection timed out. The server may be waking up from sleep (cold start). Please retry in a few seconds.';
      } else if (dioErr.type == DioExceptionType.receiveTimeout) {
        message = 'Server took too long to respond (receive timeout). Please check your connection and retry.';
      } else if (dioErr.type == DioExceptionType.sendTimeout) {
        message = 'Request sending timed out. Please check your network connection.';
      } else if (dioErr.type == DioExceptionType.badCertificate) {
        message = 'Secure TLS certificate verification failed. Please verify your device date/time or server certificate.';
      } else if (dioErr.type == DioExceptionType.connectionError) {
        final host = Uri.tryParse(EnvConfig.apiBaseUrl)?.host ?? 'server';
        final errString = dioErr.error?.toString() ?? '';
        if (errString.contains('HandshakeException') ||
            errString.contains('TlsException') ||
            errString.contains('CertificateException')) {
          message = 'Secure TLS handshake failed for $host. Please check network security settings.';
        } else {
          message = 'Could not reach server at $host. Please check your internet connection or server address.';
        }
      } else {
        message = serverMsg ?? 'Registration failed. Please check your network connection and retry.';
      }

      state = Unauthenticated(errorMessage: message);
      return false;
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      state = Unauthenticated(
        errorMessage: msg.isNotEmpty ? msg : 'An unexpected error occurred during registration.',
      );
      return false;
    }
  }

  /// Clears any active error banner when the user resumes typing or resets the form.
  void clearError() {
    if (state is Unauthenticated && (state as Unauthenticated).errorMessage != null) {
      state = const Unauthenticated();
    }
  }

  /// Tests connectivity to the MAN-U-AI backend health endpoint safely without secrets.
  Future<({bool isHealthy, String statusMessage, int? statusCode})> checkServerHealth() async {
    try {
      final dio = ref.read(dioProvider);
      final response = await dio.get(
        '/health',
        options: Options(
          sendTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 20),
        ),
      );
      final data = response.data;
      final isOk = response.statusCode == 200 &&
          (data is Map && (data['status'] == 'healthy' || data['ready'] == true));
      String? targetDb;
      if (data is Map && data['database'] is Map) {
        targetDb = (data['database'] as Map)['targetDatabase']?.toString();
      }
      final dbInfo = targetDb != null ? ' [DB: $targetDb]' : '';
      return (
        isHealthy: isOk,
        statusMessage: isOk
            ? 'Connected to MAN-U-AI Server$dbInfo'
            : 'Server responded: ${data['status'] ?? response.statusCode}',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      final host = Uri.tryParse(EnvConfig.apiBaseUrl)?.host ?? 'server';
      if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.receiveTimeout) {
        return (
          isHealthy: false,
          statusMessage: 'Connection timed out at $host. Service may be waking up.',
          statusCode: e.response?.statusCode,
        );
      }
      return (
        isHealthy: false,
        statusMessage: 'Unable to reach $host (${e.type.name}).',
        statusCode: e.response?.statusCode,
      );
    } catch (e) {
      return (
        isHealthy: false,
        statusMessage: 'Connection probe error: $e',
        statusCode: null,
      );
    }
  }

  /// Switches active server URL at runtime and updates ApiClient baseUrl.
  void setServerUrl(String newUrl) {
    EnvConfig.setRuntimeOverride(newUrl);
    ref.read(apiClientProvider).updateBaseUrl(EnvConfig.apiBaseUrl);
    clearError();
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const Unauthenticated();
  }

  void handleUnauthorized() {
    if (state is! Unauthenticated) {
      state = const Unauthenticated(
        errorMessage: 'Session expired. Please sign in again.',
        isSessionExpired: true,
      );
    }
  }
}
