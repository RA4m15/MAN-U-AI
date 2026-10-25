class FigureModel {
  final String id;
  final String documentId;
  final String figureId;
  final String? title;
  final String? caption;
  final int page;
  final String? storagePath;
  final String mimeType;
  final int? sizeBytes;

  const FigureModel({
    required this.id,
    required this.documentId,
    required this.figureId,
    this.title,
    this.caption,
    required this.page,
    this.storagePath,
    this.mimeType = 'image/jpeg',
    this.sizeBytes,
  });

  factory FigureModel.fromJson(Map<String, dynamic> json) {
    return FigureModel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      documentId: json['documentId']?.toString() ?? '',
      figureId: json['figureId']?.toString() ?? json['id']?.toString() ?? '',
      title: json['title'] as String?,
      caption: json['caption'] as String?,
      page: (json['page'] is num) ? (json['page'] as num).toInt() : 1,
      storagePath: json['storagePath'] as String?,
      mimeType: json['mimeType'] as String? ?? 'image/jpeg',
      sizeBytes: (json['sizeBytes'] is num) ? (json['sizeBytes'] as num).toInt() : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'documentId': documentId,
      'figureId': figureId,
      if (title != null) 'title': title,
      if (caption != null) 'caption': caption,
      'page': page,
      if (storagePath != null) 'storagePath': storagePath,
      'mimeType': mimeType,
      if (sizeBytes != null) 'sizeBytes': sizeBytes,
    };
  }
}
