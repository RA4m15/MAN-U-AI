import 'package:dio/dio.dart';
import '../config/env_config.dart';
import '../storage/secure_storage_service.dart';
import 'auth_interceptor.dart';

class ApiClient {
  final Dio _dio;

  ApiClient({
    Dio? dio,
    required SecureStorageService storage,
    void Function()? onUnauthorized,
  }) : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: EnvConfig.apiBaseUrl,
                connectTimeout: EnvConfig.connectTimeout,
                receiveTimeout: EnvConfig.receiveTimeout,
                sendTimeout: EnvConfig.sendTimeout,
                responseType: ResponseType.json,
              ),
            ) {
    _dio.interceptors.add(
      AuthInterceptor(
        storage: storage,
        onUnauthorized: onUnauthorized,
      ),
    );
  }

  Dio get dio => _dio;

  /// Dynamically updates the base URL for runtime host switching in development.
  void updateBaseUrl(String newUrl) {
    _dio.options.baseUrl = EnvConfig.normalizeApiBaseUrl(newUrl);
  }
}
