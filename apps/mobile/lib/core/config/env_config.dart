import 'package:flutter/foundation.dart';

/// Centralized environment and API configuration for MAN-U-AI Mobile.
///
/// Supports explicit build-time configuration via:
/// `--dart-define=API_BASE_URL=https://man-u-ai.onrender.com/api/v1`
/// `--dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1` (Android Emulator)
/// `--dart-define=API_BASE_URL=http://192.168.1.X:4000/api/v1` (Physical Device Local LAN)
class EnvConfig {
  EnvConfig._();

  /// Verified live production API Base URL on Render.
  static const String productionApiBaseUrl = 'https://man-u-ai.onrender.com/api/v1';

  /// Standard Android emulator loopback alias to host machine.
  static const String emulatorApiBaseUrl = 'http://10.0.2.2:4000/api/v1';

  /// Desktop / Simulator local loopback.
  static const String localHostApiBaseUrl = 'http://localhost:4000/api/v1';

  /// Build-time configured API Base URL override.
  static const String _definedBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// Build-time flag to explicitly target Android emulator loopback.
  static const bool _useEmulator = bool.fromEnvironment('USE_EMULATOR');

  /// Optional runtime override (useful for developer testing on physical phone).
  static String? _runtimeOverride;

  /// Sets a temporary runtime override in debug mode.
  static void setRuntimeOverride(String? url) {
    if (url == null || url.trim().isEmpty) {
      _runtimeOverride = null;
    } else {
      _runtimeOverride = normalizeApiBaseUrl(url);
    }
  }

  /// Clears any active runtime override.
  static void clearRuntimeOverride() {
    _runtimeOverride = null;
  }

  /// Normalizes any raw API URL to guarantee correct scheme and `/api/v1` path prefix.
  /// Prevents duplicate prefixes, missing prefixes, malformed slashes, and whitespace.
  static String normalizeApiBaseUrl(String rawUrl) {
    var trimmed = rawUrl.trim();
    if (trimmed.isEmpty) return '';

    // Strip trailing slashes
    trimmed = trimmed.replaceAll(RegExp(r'/+$'), '');

    // Ensure scheme
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      trimmed = kReleaseMode ? 'https://$trimmed' : 'http://$trimmed';
    }

    // Ensure path terminates in /api/v1
    final uri = Uri.tryParse(trimmed);
    if (uri != null) {
      final path = uri.path.replaceAll(RegExp(r'/+$'), '');
      if (path.endsWith('/api/v1')) {
        return trimmed;
      } else if (path.endsWith('/api')) {
        return '$trimmed/v1';
      } else if (path.isEmpty || path == '/') {
        return '$trimmed/api/v1';
      } else {
        return '$trimmed/api/v1';
      }
    }

    if (trimmed.endsWith('/api/v1')) {
      return trimmed;
    } else if (trimmed.endsWith('/api')) {
      return '$trimmed/v1';
    }
    return '$trimmed/api/v1';
  }

  /// Validates a base URL against deployment security constraints.
  /// Returns null if valid, or a descriptive error message if invalid.
  static String? validateBaseUrl(String url, {bool isRelease = kReleaseMode}) {
    if (url.trim().isEmpty) {
      return 'API Base URL is required and cannot be empty.';
    }

    final parsed = Uri.tryParse(url);
    if (parsed == null || !parsed.hasScheme || parsed.host.isEmpty) {
      return 'Invalid API URL format. Please provide a valid hostname.';
    }

    if (isRelease) {
      final host = parsed.host.toLowerCase();
      final isLocal = host == 'localhost' || host == '127.0.0.1';
      if (!kIsWeb && (isLocal || host == '10.0.2.2')) {
        return 'Production builds cannot target local loopback or emulator addresses ($host).';
      }
      if (!isLocal && parsed.scheme != 'https') {
        return 'Production builds require secure TLS (https://). Cleartext HTTP is forbidden in release.';
      }
    }

    return null;
  }

  /// Checks if the currently active API Base URL is valid.
  static bool get isConfigured => validateBaseUrl(apiBaseUrl) == null;

  /// Validation error message for the currently active API Base URL, if any.
  static String? get configurationError => validateBaseUrl(apiBaseUrl);

  /// Active Base URL for API requests.
  static String get apiBaseUrl {
    // 1. Runtime override takes precedence if set
    if (_runtimeOverride != null && _runtimeOverride!.isNotEmpty) {
      return _runtimeOverride!;
    }

    // 2. Explicit build-time define (--dart-define=API_BASE_URL=...)
    if (_definedBaseUrl.isNotEmpty) {
      return normalizeApiBaseUrl(_definedBaseUrl);
    }

    // 3. Explicit emulator flag
    if (_useEmulator) {
      return emulatorApiBaseUrl;
    }

    // 4. Web browser environment: when served via local web server (e.g. localhost:8080),
    // connect through the web server's same-origin proxy to eliminate cross-origin CORS blocks
    if (kIsWeb) {
      final origin = Uri.base.origin;
      if (origin.isNotEmpty && origin != 'null' && (origin.contains('localhost') || origin.contains('127.0.0.1'))) {
        return normalizeApiBaseUrl('$origin/api/v1');
      }
    }

    // 5. Default for production builds and physical devices:
    // Uses the verified HTTPS deployed API base URL.
    // 10.0.2.2 and 127.0.0.1 are never used as default physical or production URLs.
    return productionApiBaseUrl;
  }

  /// Appropriate timeout values matching backend constraints (accommodates Render cold-starts & RAG generation)
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 45);
  static const Duration sendTimeout = Duration(seconds: 30);

  /// Verified live production CAD Viewer URL.
  static const String productionCadViewerUrl = 'https://man-u-ai.onrender.com/cad';

  /// Standard Android emulator loopback alias to CAD viewer dev server.
  static const String emulatorCadViewerUrl = 'http://10.0.2.2:5173';

  /// Desktop / Localhost loopback CAD viewer dev server.
  static const String localHostCadViewerUrl = 'http://localhost:5173';

  /// Build-time configured CAD Viewer URL override.
  static const String _definedCadViewerUrl = String.fromEnvironment('CAD_VIEWER_URL');

  /// Optional runtime override for CAD Viewer URL.
  static String? _cadViewerRuntimeOverride;

  /// Sets a temporary CAD viewer runtime override in debug mode.
  static void setCadViewerRuntimeOverride(String? url) {
    if (url == null || url.trim().isEmpty) {
      _cadViewerRuntimeOverride = null;
    } else {
      _cadViewerRuntimeOverride = url.trim();
    }
  }

  /// Clears any active CAD viewer runtime override.
  static void clearCadViewerRuntimeOverride() {
    _cadViewerRuntimeOverride = null;
  }

  /// Active Base URL for the embedded CAD 3D Viewer.
  static String get cadViewerUrl {
    // 1. Runtime override
    if (_cadViewerRuntimeOverride != null && _cadViewerRuntimeOverride!.isNotEmpty) {
      return _cadViewerRuntimeOverride!;
    }

    // 2. Build-time environment define (--dart-define=CAD_VIEWER_URL=...)
    if (_definedCadViewerUrl.isNotEmpty) {
      return _definedCadViewerUrl.trim();
    }

    // 3. Android emulator flag
    if (_useEmulator) {
      return emulatorCadViewerUrl;
    }

    // 4. Web browser environment
    if (kIsWeb) {
      return '/cad';
    }

    // 5. Local development on simulator / desktop
    if (!kReleaseMode) {
      return localHostCadViewerUrl;
    }

    // 6. Production release
    return productionCadViewerUrl;
  }

  /// Validates whether a viewer URL belongs to a configured, trusted origin.
  static bool isAllowedViewerOrigin(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme) return false;

    // Production requires secure TLS (HTTPS)
    if (kReleaseMode && uri.scheme != 'https') return false;

    final allowedHosts = <String>{
      'localhost',
      '127.0.0.1',
      '10.0.2.2',
      'man-u-ai.onrender.com',
      'man-u-ai-cad-viewer.web.app',
      if (Uri.tryParse(cadViewerUrl)?.host.isNotEmpty == true)
        Uri.tryParse(cadViewerUrl)!.host.toLowerCase(),
    };

    return allowedHosts.contains(uri.host.toLowerCase());
  }

  /// Validates a CAD model URL for safety, preventing protocol injections.
  static bool isValidModelUrl(String url) {
    if (url.trim().isEmpty) return false;
    final uri = Uri.tryParse(url.trim());
    if (uri == null) return false;

    final scheme = uri.scheme.toLowerCase();
    // Block dangerous schemes
    if (scheme == 'javascript' || scheme == 'data' || scheme == 'file') {
      return false;
    }

    // Relative model paths (e.g. /samples/motor-holder.step) are allowed
    if (!uri.hasScheme) return true;

    // Production requires HTTPS for remote models
    if (kReleaseMode && scheme != 'https') return false;

    return true;
  }

  /// Constructs a safe, encoded CAD viewer URL with model parameter.
  static String buildCadViewerUrl(String modelUrl) {
    final base = cadViewerUrl.replaceAll(RegExp(r'/+$'), '');
    final separator = base.contains('?') ? '&' : '?';
    final encodedModel = Uri.encodeComponent(modelUrl.trim());
    return '$base$separator' 'model=$encodedModel';
  }

}
