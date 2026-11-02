import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/controllers/auth_controller.dart';
import '../storage/secure_storage_service.dart';

/// Supported Locales in MAN-U-AI: English (en) and Hindi (hi)
final localeNotifierProvider = StateNotifierProvider<LocaleNotifier, Locale>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return LocaleNotifier(storage);
});

class LocaleNotifier extends StateNotifier<Locale> {
  static const String _storageKey = 'manuai_selected_locale';
  final SecureStorageService _storage;

  LocaleNotifier(this._storage) : super(const Locale('en')) {
    _loadLocale();
  }

  Future<void> _loadLocale() async {
    try {
      final savedLocale = await _storage.read(_storageKey);
      if (savedLocale == null) return;

      if (savedLocale.toLowerCase().startsWith('hi')) {
        state = const Locale('hi');
      } else {
        state = const Locale('en');
      }
    } catch (_) {
      // In case of read failure or test environment, preserve current state
    }
  }

  Future<void> setLocale(Locale locale) async {
    if (state == locale) return;
    state = locale;
    try {
      await _storage.write(_storageKey, locale.languageCode);
    } catch (_) {
      // Non-fatal if storage fails
    }
  }
}
