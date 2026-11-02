import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import '../../features/chat/models/chat_message_model.dart';
import '../../features/chat/models/conversation_model.dart';
import '../../features/diagram/models/diagram_annotation_model.dart';
import '../../features/documents/models/document_model.dart';
import '../../features/equipment/models/equipment_model.dart';

final localCacheServiceProvider = Provider<LocalCacheService>((ref) {
  return LocalCacheService();
});

/// Model for a chat message composed while offline waiting for synchronization.
class PendingMessage {
  final String id;
  final String? conversationId;
  final String message;
  final String? equipmentId;
  final DateTime createdAt;

  const PendingMessage({
    required this.id,
    this.conversationId,
    required this.message,
    this.equipmentId,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'conversationId': conversationId,
        'message': message,
        'equipmentId': equipmentId,
        'createdAt': createdAt.toIso8601String(),
      };

  factory PendingMessage.fromJson(Map<String, dynamic> json) => PendingMessage(
        id: json['id'] as String,
        conversationId: json['conversationId'] as String?,
        message: json['message'] as String,
        equipmentId: json['equipmentId'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

/// Model for inspection media evidence captured offline waiting for upload.
class PendingMediaItem {
  final String id;
  final String filePath;
  final String fileName;
  final String title;
  final String? description;
  final String? equipmentId;
  final String mediaType; // 'image' | 'video'
  final List<String> tags;
  final DateTime createdAt;
  final String status; // 'pending' | 'uploading' | 'failed'
  final int retryCount;

  const PendingMediaItem({
    required this.id,
    required this.filePath,
    required this.fileName,
    required this.title,
    this.description,
    this.equipmentId,
    required this.mediaType,
    this.tags = const [],
    required this.createdAt,
    this.status = 'pending',
    this.retryCount = 0,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'filePath': filePath,
        'fileName': fileName,
        'title': title,
        'description': description,
        'equipmentId': equipmentId,
        'mediaType': mediaType,
        'tags': tags,
        'createdAt': createdAt.toIso8601String(),
        'status': status,
        'retryCount': retryCount,
      };

  factory PendingMediaItem.fromJson(Map<String, dynamic> json) =>
      PendingMediaItem(
        id: json['id'] as String,
        filePath: json['filePath'] as String,
        fileName: json['fileName'] as String,
        title: json['title'] as String,
        description: json['description'] as String?,
        equipmentId: json['equipmentId'] as String?,
        mediaType: json['mediaType'] as String? ?? 'image',
        tags: (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
        createdAt: DateTime.parse(json['createdAt'] as String),
        status: json['status'] as String? ?? 'pending',
        retryCount: json['retryCount'] as int? ?? 0,
      );

  PendingMediaItem copyWith({
    String? status,
    int? retryCount,
  }) {
    return PendingMediaItem(
      id: id,
      filePath: filePath,
      fileName: fileName,
      title: title,
      description: description,
      equipmentId: equipmentId,
      mediaType: mediaType,
      tags: tags,
      createdAt: createdAt,
      status: status ?? this.status,
      retryCount: retryCount ?? this.retryCount,
    );
  }
}

/// Central App-Private Local Persistent Cache Service for Offline-First Operation.
class LocalCacheService {
  final Directory? customBaseDir;
  final Map<String, String> _memoryFallback = {};
  final Map<String, Uint8List> _memoryFiles = {};

  LocalCacheService({this.customBaseDir});

  Future<Directory> _getBaseDirectory() async {
    if (customBaseDir != null) return customBaseDir!;
    try {
      final appDocDir = await getApplicationDocumentsDirectory();
      final cacheDir = Directory('${appDocDir.path}/manuai_cache');
      if (!await cacheDir.exists()) {
        await cacheDir.create(recursive: true);
      }
      return cacheDir;
    } catch (_) {
      // In test/mock environments where path_provider is not registered
      final fallback = Directory('${Directory.systemTemp.path}/manuai_cache_test');
      if (!fallback.existsSync()) {
        fallback.createSync(recursive: true);
      }
      return fallback;
    }
  }

  Future<File> _getFile(String filename) async {
    final dir = await _getBaseDirectory();
    return File('${dir.path}/$filename');
  }

  Future<void> _writeJson(String filename, dynamic data) async {
    try {
      final file = await _getFile(filename);
      await file.writeAsString(jsonEncode(data));
    } catch (_) {
      _memoryFallback[filename] = jsonEncode(data);
    }
  }

  Future<dynamic> _readJson(String filename) async {
    try {
      final file = await _getFile(filename);
      if (await file.exists()) {
        final content = await file.readAsString();
        return jsonDecode(content);
      }
    } catch (_) {}

    if (_memoryFallback.containsKey(filename)) {
      return jsonDecode(_memoryFallback[filename]!);
    }
    return null;
  }

  // -------------------------------------------------------------
  // Conversations & Chat Messages
  // -------------------------------------------------------------

  Future<void> cacheConversations(List<ConversationModel> list) async {
    final data = list.map((c) => c.toJson()).toList();
    await _writeJson('conversations.json', data);
  }

  Future<List<ConversationModel>> getCachedConversations() async {
    final raw = await _readJson('conversations.json');
    if (raw is List) {
      return raw
          .whereType<Map<String, dynamic>>()
          .map((item) => ConversationModel.fromJson(item))
          .toList();
    }
    return [];
  }

  Future<void> cacheMessages(
      String conversationId, List<ChatMessageModel> messages) async {
    final data = messages.map((m) => m.toJson()).toList();
    await _writeJson('messages_$conversationId.json', data);
  }

  Future<List<ChatMessageModel>> getCachedMessages(
      String conversationId) async {
    final raw = await _readJson('messages_$conversationId.json');
    if (raw is List) {
      return raw
          .whereType<Map<String, dynamic>>()
          .map((item) => ChatMessageModel.fromJson(item))
          .toList();
    }
    return [];
  }

  // -------------------------------------------------------------
  // Equipment
  // -------------------------------------------------------------

  Future<void> cacheEquipment(List<EquipmentModel> list) async {
    final data = list.map((e) => e.toJson()).toList();
    await _writeJson('equipment.json', data);
  }

  Future<List<EquipmentModel>> getCachedEquipment() async {
    final raw = await _readJson('equipment.json');
    if (raw is List) {
      return raw
          .whereType<Map<String, dynamic>>()
          .map((item) => EquipmentModel.fromJson(item))
          .toList();
    }
    return [];
  }

  // -------------------------------------------------------------
  // Documents Metadata & PDF Files
  // -------------------------------------------------------------

  Future<void> cacheDocuments(List<DocumentModel> list) async {
    final data = list.map((d) => d.toJson()).toList();
    await _writeJson('documents.json', data);
  }

  Future<List<DocumentModel>> getCachedDocuments() async {
    final raw = await _readJson('documents.json');
    if (raw is List) {
      return raw
          .whereType<Map<String, dynamic>>()
          .map((item) => DocumentModel.fromJson(item))
          .toList();
    }
    return [];
  }

  Future<String> cacheDocumentPdf(String docId, List<int> bytes) async {
    try {
      final base = await _getBaseDirectory();
      final docsDir = Directory('${base.path}/documents');
      if (!await docsDir.exists()) {
        await docsDir.create(recursive: true);
      }
      final file = File('${docsDir.path}/doc_$docId.pdf');
      await file.writeAsBytes(bytes, flush: true);
      return file.path;
    } catch (_) {
      _memoryFiles['doc_$docId.pdf'] = Uint8List.fromList(bytes);
      return 'memory://documents/doc_$docId.pdf';
    }
  }

  Future<bool> isDocumentPdfCached(String docId) async {
    if (_memoryFiles.containsKey('doc_$docId.pdf')) return true;
    try {
      final base = await _getBaseDirectory();
      final file = File('${base.path}/documents/doc_$docId.pdf');
      return await file.exists();
    } catch (_) {
      return false;
    }
  }

  Future<String?> getDocumentPdfPath(String docId) async {
    if (_memoryFiles.containsKey('doc_$docId.pdf')) {
      return 'memory://documents/doc_$docId.pdf';
    }
    try {
      final base = await _getBaseDirectory();
      final file = File('${base.path}/documents/doc_$docId.pdf');
      if (await file.exists()) {
        return file.path;
      }
    } catch (_) {}
    return null;
  }

  Future<Uint8List?> getDocumentPdfBytes(String docId) async {
    if (_memoryFiles.containsKey('doc_$docId.pdf')) {
      return _memoryFiles['doc_$docId.pdf'];
    }
    try {
      final base = await _getBaseDirectory();
      final file = File('${base.path}/documents/doc_$docId.pdf');
      if (await file.exists()) {
        return await file.readAsBytes();
      }
    } catch (_) {}
    return null;
  }

  // -------------------------------------------------------------
  // Diagrams & 3D Model Schematic Assets
  // -------------------------------------------------------------

  Future<void> cacheDiagramAnnotation(
      String figureId, DiagramAnnotationModel model) async {
    await _writeJson('diagram_$figureId.json', model.toJson());
  }

  Future<DiagramAnnotationModel?> getCachedDiagramAnnotation(
      String figureId) async {
    final raw = await _readJson('diagram_$figureId.json');
    if (raw is Map<String, dynamic>) {
      return DiagramAnnotationModel.fromJson(raw);
    }
    return null;
  }

  Future<String> cacheDiagramImage(String figureId, List<int> bytes) async {
    try {
      final base = await _getBaseDirectory();
      final diagDir = Directory('${base.path}/diagrams');
      if (!await diagDir.exists()) {
        await diagDir.create(recursive: true);
      }
      final file = File('${diagDir.path}/fig_$figureId.png');
      await file.writeAsBytes(bytes, flush: true);
      return file.path;
    } catch (_) {
      _memoryFiles['fig_$figureId.png'] = Uint8List.fromList(bytes);
      return 'memory://diagrams/fig_$figureId.png';
    }
  }

  Future<String?> getCachedDiagramImagePath(String figureId) async {
    if (_memoryFiles.containsKey('fig_$figureId.png')) {
      return 'memory://diagrams/fig_$figureId.png';
    }
    try {
      final base = await _getBaseDirectory();
      final file = File('${base.path}/diagrams/fig_$figureId.png');
      if (await file.exists()) return file.path;
    } catch (_) {}
    return null;
  }

  Future<bool> isDiagramImageCached(String figureId) async {
    if (_memoryFiles.containsKey('fig_$figureId.png')) return true;
    try {
      final base = await _getBaseDirectory();
      final file = File('${base.path}/diagrams/fig_$figureId.png');
      return await file.exists();
    } catch (_) {
      return false;
    }
  }

  // -------------------------------------------------------------
  // Pending Messages Queue (Offline Sync)
  // -------------------------------------------------------------

  Future<void> addPendingMessage(PendingMessage message) async {
    final list = await getPendingMessages();
    list.add(message);
    await _writeJson('pending_messages.json', list.map((m) => m.toJson()).toList());
  }

  Future<List<PendingMessage>> getPendingMessages() async {
    final raw = await _readJson('pending_messages.json');
    if (raw is List) {
      return raw
          .whereType<Map<String, dynamic>>()
          .map((item) => PendingMessage.fromJson(item))
          .toList();
    }
    return [];
  }

  Future<void> removePendingMessage(String id) async {
    final list = await getPendingMessages();
    list.removeWhere((m) => m.id == id);
    await _writeJson('pending_messages.json', list.map((m) => m.toJson()).toList());
  }

  // -------------------------------------------------------------
  // Pending Media Queue (Offline Camera / Inspection Uploads)
  // -------------------------------------------------------------

  Future<void> addPendingMedia(PendingMediaItem item) async {
    final list = await getPendingMedia();
    list.add(item);
    await _writeJson('pending_media.json', list.map((m) => m.toJson()).toList());
  }

  Future<List<PendingMediaItem>> getPendingMedia() async {
    final raw = await _readJson('pending_media.json');
    if (raw is List) {
      return raw
          .whereType<Map<String, dynamic>>()
          .map((item) => PendingMediaItem.fromJson(item))
          .toList();
    }
    return [];
  }

  Future<void> removePendingMedia(String id) async {
    final list = await getPendingMedia();
    list.removeWhere((m) => m.id == id);
    await _writeJson('pending_media.json', list.map((m) => m.toJson()).toList());
  }

  Future<void> updatePendingMediaStatus(String id, String status) async {
    final list = await getPendingMedia();
    final idx = list.indexWhere((m) => m.id == id);
    if (idx != -1) {
      list[idx] = list[idx].copyWith(
        status: status,
        retryCount: status == 'failed' ? list[idx].retryCount + 1 : list[idx].retryCount,
      );
      await _writeJson('pending_media.json', list.map((m) => m.toJson()).toList());
    }
  }

  /// Clears all cached user data upon safe logout (preserving app safety).
  Future<void> clearUserCache() async {
    _memoryFallback.clear();
    _memoryFiles.clear();
    try {
      final base = await _getBaseDirectory();
      if (await base.exists()) {
        await base.delete(recursive: true);
      }
    } catch (_) {}
  }
}
