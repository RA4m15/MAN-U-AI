import 'dart:convert';

/// Reusable, versioned message schema for the CAD 3D Viewer bidirectional bridge.
class CadBridgeMessage {
  static const int currentVersion = 1;
  static const int maxMessageSizeBytes = 65536; // 64 KB

  static const Set<String> allowedEvents = {
    'viewerReady',
    'assemblyLoaded',
    'componentSelected',
    'componentDeselected',
    'explosionStepChanged',
    'viewerError',
    'commandResult',
  };

  static const Set<String> allowedCommands = {
    'LOAD_ASSEMBLY',
    'NEXT_STEP',
    'PREVIOUS_STEP',
    'RESET_EXPLOSION',
    'GO_TO_STEP',
    'SELECT_COMPONENT',
    'CLEAR_SELECTION',
    'GET_VIEWER_STATE',
  };

  final int version;
  final String type; // 'event' | 'command' | 'response'
  final String? event;
  final String? command;
  final String requestId;
  final String machineId;
  final String? viewerInstanceId;
  final Map<String, dynamic> payload;

  const CadBridgeMessage({
    this.version = currentVersion,
    required this.type,
    this.event,
    this.command,
    required this.requestId,
    required this.machineId,
    this.viewerInstanceId,
    this.payload = const {},
  });

  /// Factory for constructing a Flutter-to-JS command message.
  factory CadBridgeMessage.command({
    required String command,
    required String machineId,
    String? requestId,
    String? viewerInstanceId,
    Map<String, dynamic>? payload,
  }) {
    final sanitizedCommand = command.toUpperCase().trim();
    return CadBridgeMessage(
      version: currentVersion,
      type: 'command',
      command: sanitizedCommand,
      requestId: requestId ?? 'req_${DateTime.now().millisecondsSinceEpoch}_${(1000 + (DateTime.now().microsecond % 9000))}',
      machineId: machineId,
      viewerInstanceId: viewerInstanceId,
      payload: payload ?? const {},
    );
  }

  /// Deserializes and validates a JSON string or map safely.
  /// Returns `null` if the message is malformed, oversized, or fails schema validation.
  static CadBridgeMessage? tryParse(dynamic raw) {
    if (raw == null) return null;

    Map<String, dynamic>? map;
    if (raw is String) {
      if (raw.length > maxMessageSizeBytes) {
        return null; // Oversized message rejected for security
      }
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map) {
          map = Map<String, dynamic>.from(decoded);
        } else {
          return null;
        }
      } catch (_) {
        return null; // Malformed JSON rejected
      }
    } else if (raw is Map) {
      map = Map<String, dynamic>.from(raw);
    } else {
      return null;
    }

    // Protocol version check
    final ver = (map['version'] is num) ? (map['version'] as num).toInt() : null;
    if (ver != currentVersion) {
      return null; // Unsupported or missing protocol version
    }

    final type = map['type']?.toString().toLowerCase();
    if (type != 'event' && type != 'command' && type != 'response') {
      return null; // Invalid message type
    }

    final event = map['event']?.toString();
    final command = map['command']?.toString().toUpperCase();
    final requestId = map['requestId']?.toString() ?? '';
    final machineId = map['machineId']?.toString() ?? 'machine_001';
    final viewerInstanceId = map['viewerInstanceId']?.toString();

    // Validate event name whitelist
    if (type == 'event' && (event == null || !allowedEvents.contains(event))) {
      return null;
    }

    // Validate command name whitelist
    if (type == 'command' && (command == null || !allowedCommands.contains(command))) {
      return null;
    }

    Map<String, dynamic> payload = const {};
    if (map['payload'] is Map) {
      payload = Map<String, dynamic>.from(map['payload'] as Map);
    } else if (map['data'] is Map) {
      payload = Map<String, dynamic>.from(map['data'] as Map);
    }

    return CadBridgeMessage(
      version: ver ?? currentVersion,
      type: type!,
      event: event,
      command: command,
      requestId: requestId,
      machineId: machineId,
      viewerInstanceId: viewerInstanceId,
      payload: payload,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'version': version,
      'type': type,
      if (event != null) 'event': event,
      if (command != null) 'command': command,
      'requestId': requestId,
      'machineId': machineId,
      if (viewerInstanceId != null) 'viewerInstanceId': viewerInstanceId,
      'payload': payload,
    };
  }

  String toJsonString() => jsonEncode(toJson());

  bool get isEvent => type == 'event';
  bool get isCommand => type == 'command';
  bool get isResponse => type == 'response';

  @override
  String toString() => 'CadBridgeMessage(ver: $version, type: $type, event: $event, cmd: $command, req: $requestId, machine: $machineId, inst: $viewerInstanceId)';
}
