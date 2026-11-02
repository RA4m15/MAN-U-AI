import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/controllers/auth_controller.dart';
import '../storage/secure_storage_service.dart';

/// Provider for ThemeNotifier, managing Light / Dark / System Default theme modes.
final themeNotifierProvider = StateNotifierProvider<ThemeNotifier, ThemeMode>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return ThemeNotifier(storage);
});

class ThemeNotifier extends StateNotifier<ThemeMode> {
  static const String _storageKey = 'manuai_theme_mode';
  final SecureStorageService _storage;

  ThemeNotifier(this._storage) : super(ThemeMode.system) {
    _loadThemeMode();
  }

  Future<void> _loadThemeMode() async {
    try {
      final savedMode = await _storage.read(_storageKey);
      if (savedMode == null) return;

      switch (savedMode.toLowerCase()) {
        case 'light':
          state = ThemeMode.light;
          break;
        case 'dark':
          state = ThemeMode.dark;
          break;
        case 'system':
        default:
          state = ThemeMode.system;
          break;
      }
    } catch (_) {
      // In case of read failure or headless test environment, preserve current state
    }
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    state = mode;
    try {
      final modeString = switch (mode) {
        ThemeMode.light => 'light',
        ThemeMode.dark => 'dark',
        ThemeMode.system => 'system',
      };
      await _storage.write(_storageKey, modeString);
    } catch (_) {
      // Non-fatal if secure storage fails
    }
  }
}
