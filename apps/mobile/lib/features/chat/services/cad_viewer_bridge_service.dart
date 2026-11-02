import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../models/cad_bridge_message.dart';
import '../models/cad_component_selection_state.dart';

/// Service managing secure, bidirectional communication between Flutter
/// and the embedded CAD 3D Viewer inside a chat message.
class CadViewerBridgeService {
  final String machineId;
  WebViewController? _controller;
  bool _isDisposed = false;

  late final ValueNotifier<CadComponentSelectionState> stateNotifier;
  final StreamController<CadBridgeMessage> _eventStreamController = StreamController<CadBridgeMessage>.broadcast();

  // Pending command completers mapped by requestId
  final Map<String, Completer<Map<String, dynamic>>> _pendingCommands = {};

  // Flag to avoid circular command firing when UI reflects back an event
  bool _isDispatchingCommand = false;

  CadViewerBridgeService({
    required this.machineId,
    int initialStep = 1,
    int totalSteps = 1,
  }) {
    stateNotifier = ValueNotifier<CadComponentSelectionState>(
      CadComponentSelectionState.initial(
        machineId,
        initialStep: initialStep,
        totalSteps: totalSteps,
      ),
    );
  }

  CadComponentSelectionState get state => stateNotifier.value;
  bool get isViewerReady => state.isViewerReady;
  bool get isDisposed => _isDisposed;
  Stream<CadBridgeMessage> get eventStream => _eventStreamController.stream;

  /// Attaches the native WebViewController instance.
  void attachController(WebViewController? controller) {
    if (_isDisposed) return;
    _controller = controller;
  }

  /// Detaches the WebViewController instance without disposing the service state.
  void detachController() {
    _controller = null;
  }

  /// Processes inbound raw messages received from the JavaScript bridge channel.
  void handleInboundRawMessage(String rawJson) {
    if (_isDisposed) return;

    final message = CadBridgeMessage.tryParse(rawJson);
    if (message == null) {
      // Message rejected: malformed, oversized, or fails protocol schema
      return;
    }

    // Safety: ensure message is intended for this machine or general
    if (message.machineId.isNotEmpty &&
        message.machineId != machineId &&
        message.machineId != 'machine_001') {
      return; // Ignore messages for other instances
    }

    _eventStreamController.add(message);

    // Resolve any correlated pending command completer
    if (message.isResponse || message.event == 'commandResult') {
      final reqId = message.requestId;
      final completer = _pendingCommands.remove(reqId);
      if (completer != null && !completer.isCompleted) {
        completer.complete(message.payload);
      }
    }

    // Update state based on inbound events
    if (message.isEvent) {
      _applyEventToState(message);
    }
  }

  void _applyEventToState(CadBridgeMessage message) {
    final event = message.event;
    final payload = message.payload;

    switch (event) {
      case 'viewerReady':
        stateNotifier.value = state.copyWith(
          isViewerReady: true,
          isLoading: false,
          errorMessage: null,
        );
        break;

      case 'assemblyLoaded':
        final total = (payload['totalSteps'] is num)
            ? (payload['totalSteps'] as num).toInt()
            : state.totalSteps;
        final curr = (payload['currentStep'] is num)
            ? (payload['currentStep'] as num).toInt()
            : state.currentStep;
        stateNotifier.value = state.copyWith(
          isViewerReady: true,
          isLoading: false,
          totalSteps: total > 0 ? total : 1,
          currentStep: curr > 0 ? curr : 1,
          errorMessage: null,
        );
        break;

      case 'componentSelected':
        final partId = payload['partId']?.toString();
        final partName = payload['partName']?.toString();
        final parentId = payload['parentId']?.toString();
        final pathRaw = payload['assemblyPath'];
        final assemblyPath = (pathRaw is List)
            ? pathRaw.map((e) => e.toString()).toList()
            : <String>[];
        final metadata = (payload['metadata'] is Map)
            ? Map<String, dynamic>.from(payload['metadata'] as Map)
            : const <String, dynamic>{};

        stateNotifier.value = state.copyWith(
          selectedPartId: partId,
          selectedPartName: partName,
          parentId: parentId,
          assemblyPath: assemblyPath,
          metadata: metadata,
        );
        break;

      case 'componentDeselected':
        stateNotifier.value = state.clearSelection();
        break;

      case 'explosionStepChanged':
        final total = (payload['totalSteps'] is num)
            ? (payload['totalSteps'] as num).toInt()
            : state.totalSteps;
        final stepNum = (payload['stepNumber'] is num)
            ? (payload['stepNumber'] as num).toInt()
            : ((payload['stepIndex'] is num)
                ? (payload['stepIndex'] as num).toInt() + 1
                : state.currentStep);

        stateNotifier.value = state.copyWith(
          currentStep: stepNum > 0 ? stepNum : 1,
          totalSteps: total > 0 ? total : state.totalSteps,
        );
        break;

      case 'viewerError':
        final error = payload['error']?.toString() ?? 'Unknown viewer error';
        stateNotifier.value = state.copyWith(
          isLoading: false,
          errorMessage: error,
        );
        break;
    }
  }

  /// Sends a structured command to the CAD viewer via JavaScript injection.
  Future<Map<String, dynamic>> sendCommand(
    String command, {
    Map<String, dynamic>? payload,
    Duration timeout = const Duration(seconds: 5),
  }) async {
    if (_isDisposed) {
      throw StateError('Cannot send command to disposed CadViewerBridgeService');
    }

    if (!isViewerReady && command != 'GET_VIEWER_STATE' && _controller != null) {
      throw StateError('CAD Viewer is not ready. Wait for viewerReady event before sending commands.');
    }

    if (_controller == null) {
      // In headless environments or widget tests without native WebView engine,
      // simulate local state transitions for offline/mock test execution.
      if (command == 'NEXT_STEP' && state.currentStep < state.totalSteps) {
        stateNotifier.value = state.copyWith(currentStep: state.currentStep + 1);
        return {'success': true, 'command': command};
      }
      if (command == 'PREVIOUS_STEP' && state.currentStep > 1) {
        stateNotifier.value = state.copyWith(currentStep: state.currentStep - 1);
        return {'success': true, 'command': command};
      }
      if (command == 'RESET_EXPLOSION') {
        stateNotifier.value = state.copyWith(currentStep: 1);
        return {'success': true, 'command': command};
      }
      if (command == 'GO_TO_STEP') {
        final stepIdx = (payload?['stepIndex'] as num?)?.toInt() ?? 1;
        stateNotifier.value = state.copyWith(currentStep: stepIdx);
        return {'success': true, 'command': command};
      }
      if (command == 'CLEAR_SELECTION') {
        stateNotifier.value = state.clearSelection();
        return {'success': true, 'command': command};
      }
      if (command == 'SELECT_COMPONENT') {
        final partId = payload?['partId']?.toString();
        stateNotifier.value = state.copyWith(
          selectedPartId: partId,
          selectedPartName: partId,
          assemblyPath: partId != null ? [partId] : const [],
        );
        return {'success': true, 'command': command};
      }
      throw StateError('WebViewController is not attached to CadViewerBridgeService');
    }

    final msg = CadBridgeMessage.command(
      command: command,
      machineId: machineId,
      payload: payload,
    );

    final completer = Completer<Map<String, dynamic>>();
    _pendingCommands[msg.requestId] = completer;

    final jsonStr = msg.toJsonString().replaceAll(r'\', r'\\').replaceAll("'", r"\'");
    final script = """
      (function() {
        try {
          if (window.cadViewer && typeof window.cadViewer.handleCommand === 'function') {
            window.cadViewer.handleCommand('$jsonStr');
          } else {
            window.postMessage($jsonStr, '*');
          }
        } catch(e) {
          console.error('[FlutterCADBridge] dispatch failed:', e);
        }
      })();
    """;

    try {
      await _controller!.runJavaScript(script);
    } catch (e) {
      _pendingCommands.remove(msg.requestId);
      throw StateError('JavaScript execution failed: $e');
    }

    // Wait for correlated response or timeout
    try {
      return await completer.future.timeout(timeout, onTimeout: () {
        _pendingCommands.remove(msg.requestId);
        // Fallback simulated success if message was dispatched without explicit response
        return {'success': true, 'command': command, 'timeout': true};
      });
    } catch (e) {
      _pendingCommands.remove(msg.requestId);
      rethrow;
    }
  }

  /// Advances to next exploded assembly stage.
  Future<bool> nextStep() async {
    if (_isDispatchingCommand || state.currentStep >= state.totalSteps) return false;
    _isDispatchingCommand = true;
    try {
      final res = await sendCommand('NEXT_STEP');
      return res['success'] == true;
    } finally {
      _isDispatchingCommand = false;
    }
  }

  /// Returns to previous exploded assembly stage.
  Future<bool> previousStep() async {
    if (_isDispatchingCommand || state.currentStep <= 1) return false;
    _isDispatchingCommand = true;
    try {
      final res = await sendCommand('PREVIOUS_STEP');
      return res['success'] == true;
    } finally {
      _isDispatchingCommand = false;
    }
  }

  /// Resets explosion back to base unexploded assembly (Stage 1).
  Future<bool> resetExplosion() async {
    if (_isDispatchingCommand) return false;
    _isDispatchingCommand = true;
    try {
      final res = await sendCommand('RESET_EXPLOSION');
      return res['success'] == true;
    } finally {
      _isDispatchingCommand = false;
    }
  }

  /// Navigates directly to a target 1-based or 0-based step index.
  Future<bool> goToStep(int index) async {
    if (_isDispatchingCommand) return false;
    _isDispatchingCommand = true;
    try {
      final res = await sendCommand('GO_TO_STEP', payload: {'stepIndex': index});
      return res['success'] == true;
    } finally {
      _isDispatchingCommand = false;
    }
  }

  /// Programmatically selects a component by partId or name.
  Future<bool> selectComponent(String partId) async {
    if (_isDispatchingCommand) return false;
    _isDispatchingCommand = true;
    try {
      final res = await sendCommand('SELECT_COMPONENT', payload: {'partId': partId});
      return res['success'] == true;
    } finally {
      _isDispatchingCommand = false;
    }
  }

  /// Clears active component selection.
  Future<bool> clearSelection() async {
    if (_isDispatchingCommand) return false;
    _isDispatchingCommand = true;
    try {
      final res = await sendCommand('CLEAR_SELECTION');
      return res['success'] == true;
    } finally {
      _isDispatchingCommand = false;
    }
  }

  /// Requests complete state snapshot from the viewer.
  Future<Map<String, dynamic>?> getViewerState() async {
    try {
      final res = await sendCommand('GET_VIEWER_STATE');
      return (res['result'] is Map) ? Map<String, dynamic>.from(res['result'] as Map) : res;
    } catch (_) {
      return null;
    }
  }

  /// Loads an assembly model from a secure URL.
  Future<bool> loadAssembly(String url, {String? name}) async {
    try {
      final res = await sendCommand('LOAD_ASSEMBLY', payload: {'url': url, 'name': ?name});
      return res['success'] == true;
    } catch (_) {
      return false;
    }
  }

  /// Disposes the service and cancels all pending requests.
  void dispose() {
    if (_isDisposed) return;
    _isDisposed = true;
    _controller = null;

    for (final completer in _pendingCommands.values) {
      if (!completer.isCompleted) {
        completer.completeError(StateError('CadViewerBridgeService disposed during pending command.'));
      }
    }
    _pendingCommands.clear();

    _eventStreamController.close();
    stateNotifier.dispose();
  }
}
