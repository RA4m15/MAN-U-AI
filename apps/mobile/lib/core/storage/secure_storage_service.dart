import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../features/auth/models/user_model.dart';

class SecureStorageService {
  final FlutterSecureStorage _storage;

  static const String _keyToken = 'manuai_jwt_token';
  static const String _keyUser = 'manuai_user_data';
  static const String _keyLastAuthTime = 'manuai_last_online_auth_time';

  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(resetOnError: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
            );

  Future<void> write(String key, String value) async {
    await _storage.write(key: key, value: value);
  }

  Future<String?> read(String key) async {
    return await _storage.read(key: key);
  }

  Future<void> delete(String key) async {
    await _storage.delete(key: key);
  }

  Future<void> saveToken(String token) async {
    await _storage.write(key: _keyToken, value: token);
  }

  Future<String?> getToken() async {
    return await _storage.read(key: _keyToken);
  }

  Future<void> deleteToken() async {
    await _storage.delete(key: _keyToken);
  }

  Future<void> saveUser(UserModel user) async {
    final raw = jsonEncode(user.toJson());
    await _storage.write(key: _keyUser, value: raw);
  }

  Future<UserModel?> getUser() async {
    final raw = await _storage.read(key: _keyUser);
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return UserModel.fromJson(decoded);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveLastAuthTime(DateTime time) async {
    await _storage.write(key: _keyLastAuthTime, value: time.toIso8601String());
  }

  Future<DateTime?> getLastAuthTime() async {
    final raw = await _storage.read(key: _keyLastAuthTime);
    if (raw == null || raw.isEmpty) return null;
    return DateTime.tryParse(raw);
  }

  Future<void> clearAll() async {
    await _storage.delete(key: _keyToken);
    await _storage.delete(key: _keyUser);
    await _storage.delete(key: _keyLastAuthTime);
  }
}
