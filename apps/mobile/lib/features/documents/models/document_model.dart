/// Represents an ingested technical document in MAN-U-AI.
class DocumentModel {
  final String id;
  final String title;
  final String revision;
  final String filename;
  final int sizeBytes;
  final String status; // 'processing', 'indexed', 'failed'
  final int pageCount;
  final String? processingError;
  final List<String> tags;
  final String? equipmentId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const DocumentModel({
    required this.id,
    required this.title,
    required this.revision,
    required this.filename,
    required this.sizeBytes,
    required this.status,
    this.pageCount = 0,
    this.processingError,
    this.tags = const [],
    this.equipmentId,
    this.createdAt,
    this.updatedAt,
  });

  factory DocumentModel.fromJson(Map<String, dynamic> json) {
    return DocumentModel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      revision: json['revision']?.toString() ?? 'Rev 1.0',
      filename: json['filename']?.toString() ?? '',
      sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
      status: json['status']?.toString() ?? 'processing',
      pageCount: (json['pageCount'] as num?)?.toInt() ?? 0,
      processingError: json['processingError'] as String?,
      tags: (json['tags'] as List?)?.map((t) => t.toString()).toList() ?? const [],
      equipmentId: json['equipment']?.toString() ?? json['equipmentId']?.toString(),
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'] as String) : null,
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt'] as String) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'revision': revision,
      'filename': filename,
      'sizeBytes': sizeBytes,
      'status': status,
      'pageCount': pageCount,
      'processingError': processingError,
      'tags': tags,
      'equipmentId': equipmentId,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  bool get isReady => status == 'indexed';
  bool get isProcessing => status == 'processing';
  bool get isFailed => status == 'failed';
}

