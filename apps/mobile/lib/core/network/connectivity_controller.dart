import 'package:flutter/services.dart';
import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/env_config.dart';

enum NetworkStatus {
  online,
  offline,
  serverUnreachable,
  reconnecting,
}

class NetworkState {
  final NetworkStatus status;
  final DateTime? lastChecked;
  final String? customMessage;

  const NetworkState({
    required this.status,
    this.lastChecked,
    this.customMessage,
  });

  bool get isOnline => status == NetworkStatus.online;
  bool get isDeadZone =>
      status == NetworkStatus.offline || status == NetworkStatus.serverUnreachable;
  bool get isReconnecting => status == NetworkStatus.reconnecting;

  NetworkState copyWith({
    NetworkStatus? status,
    DateTime? lastChecked,
    String? customMessage,
  }) {
    return NetworkState(
      status: status ?? this.status,
      lastChecked: lastChecked ?? this.lastChecked,
      customMessage: customMessage ?? this.customMessage,
    );
  }
}

final connectivityProvider = Provider<Connectivity>((ref) {
  return Connectivity();
});

final dioConnectivityProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: EnvConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 4),
      receiveTimeout: const Duration(seconds: 4),
      sendTimeout: const Duration(seconds: 4),
    ),
  );
});

final connectivityControllerProvider =
    NotifierProvider<ConnectivityController, NetworkState>(() {
  return ConnectivityController();
});

final isDeadZoneProvider = Provider<bool>((ref) {
  final networkState = ref.watch(connectivityControllerProvider);
  return networkState.isDeadZone;
});

final isOnlineProvider = Provider<bool>((ref) {
  final networkState = ref.watch(connectivityControllerProvider);
  return networkState.isOnline;
});

class ConnectivityController extends Notifier<NetworkState>
    with WidgetsBindingObserver {
  late final Connectivity _connectivity;
  late final Dio _dio;

  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  Timer? _debounceTimer;
  Timer? _periodicCheckTimer;
  CancelToken? _probeCancelToken;

  bool _isChecking = false;
  Future<bool> Function()? mockReachabilityProbe;

  bool get _hasBindings {
    try {
      ServicesBinding.instance;
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  NetworkState build() {
    _connectivity = ref.watch(connectivityProvider);
    _dio = ref.watch(dioConnectivityProvider);

    if (!_hasBindings) {
      return const NetworkState(status: NetworkStatus.online);
    }

    try { WidgetsBinding.instance.addObserver(this); } catch (_) {}

    // Initial check
    Future.microtask(() => checkReachability());

    // Listen to hardware network state changes safely
    try {
      _connectivitySubscription = _connectivity.onConnectivityChanged.listen(
        _onConnectivityChanged,
      );
    } catch (_) {}

    // Periodic check every 20 seconds while in offline/unreachable state to detect recovery
    _periodicCheckTimer = Timer.periodic(const Duration(seconds: 20), (timer) {
      if (state.isDeadZone) {
        checkReachability();
      }
    });

    ref.onDispose(() {
      try { WidgetsBinding.instance.removeObserver(this); } catch (_) {}
      _connectivitySubscription?.cancel();
      _debounceTimer?.cancel();
      _periodicCheckTimer?.cancel();
      _probeCancelToken?.cancel();
    });

    return const NetworkState(status: NetworkStatus.online);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      checkReachability();
    }
  }

  void _onConnectivityChanged(List<ConnectivityResult> results) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 400), () {
      final isDisconnected =
          results.contains(ConnectivityResult.none) || results.isEmpty;
      if (isDisconnected) {
        state = state.copyWith(
          status: NetworkStatus.offline,
          lastChecked: DateTime.now(),
          customMessage: 'No local network connection',
        );
      } else {
        // Network hardware is up, verify whether backend is reachable
        checkReachability();
      }
    });
  }

  Future<bool> checkReachability({bool manual = false}) async {
    if (_isChecking) return state.isOnline;
    _isChecking = true;

    try {
      if (mockReachabilityProbe != null) {
        final isOk = await mockReachabilityProbe!();
        _updateStatus(isOk ? NetworkStatus.online : NetworkStatus.serverUnreachable);
        return isOk;
      }

      final connResults = await _connectivity.checkConnectivity();
      if (connResults.contains(ConnectivityResult.none) || connResults.isEmpty) {
        _updateStatus(NetworkStatus.offline, message: 'No local network connection');
        return false;
      }

      _probeCancelToken?.cancel();
      _probeCancelToken = CancelToken();

      final res = await _dio.get(
        '/health',
        cancelToken: _probeCancelToken,
        options: Options(
          headers: {'Cache-Control': 'no-cache'},
          receiveTimeout: const Duration(seconds: 4),
          sendTimeout: const Duration(seconds: 4),
        ),
      );

      final isHealthy = res.statusCode == 200 &&
          (res.data is Map &&
              (res.data['status'] == 'healthy' || res.data['ready'] == true));

      if (isHealthy) {
        _updateStatus(NetworkStatus.online);
        return true;
      } else {
        _updateStatus(NetworkStatus.serverUnreachable,
            message: 'Server health check returned invalid status');
        return false;
      }
    } on DioException catch (dioErr) {
      if (dioErr.type == DioExceptionType.cancel) {
        return state.isOnline;
      }
      _updateStatus(
        NetworkStatus.serverUnreachable,
        message: 'Cannot reach MAN-U-AI API server',
      );
      return false;
    } catch (_) {
      _updateStatus(
        NetworkStatus.serverUnreachable,
        message: 'API probe error',
      );
      return false;
    } finally {
      _isChecking = false;
    }
  }

  void _updateStatus(NetworkStatus newStatus, {String? message}) {
    final previousStatus = state.status;
    if (previousStatus != newStatus) {
      if ((previousStatus == NetworkStatus.offline ||
              previousStatus == NetworkStatus.serverUnreachable) &&
          newStatus == NetworkStatus.online) {
        // Transition through reconnecting to trigger sync
        state = state.copyWith(
          status: NetworkStatus.reconnecting,
          lastChecked: DateTime.now(),
          customMessage: 'Reconnected. Synchronizing pending operations...',
        );
        return;
      }

      state = state.copyWith(
        status: newStatus,
        lastChecked: DateTime.now(),
        customMessage: message,
      );
    } else {
      state = state.copyWith(
        lastChecked: DateTime.now(),
        customMessage: message,
      );
    }
  }

  void setTestStatus(NetworkStatus status) {
    state = state.copyWith(status: status, lastChecked: DateTime.now());
  }

  void completeSync() {
    if (state.status == NetworkStatus.reconnecting) {
      state = state.copyWith(
        status: NetworkStatus.online,
        lastChecked: DateTime.now(),
        customMessage: 'Sync completed',
      );
    }
  }
}
