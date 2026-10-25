class CitationModel {
  final String? id;
  final String documentId;
  final String documentTitle;
  final String revision;
  final int page;
  final String? section;
  final String excerpt;
  final List<String> figures;

  const CitationModel({
    this.id,
    required this.documentId,
    required this.documentTitle,
    required this.revision,
    required this.page,
    this.section,
    required this.excerpt,
    this.figures = const [],
  });

  factory CitationModel.fromJson(Map<String, dynamic> json) {
    List<String> parsedFigures = [];
    if (json['figures'] is List) {
      for (final fig in json['figures']) {
        if (fig is String) {
          parsedFigures.add(fig);
        } else if (fig is Map && fig['storagePath'] is String) {
          parsedFigures.add(fig['storagePath'] as String);
        } else if (fig is Map && fig['figureId'] is String) {
          parsedFigures.add(fig['figureId'] as String);
        } else if (fig is Map && fig['id'] is String) {
          parsedFigures.add(fig['id'] as String);
        }
      }
    }

    return CitationModel(
      id: json['id']?.toString() ?? json['_id']?.toString(),
      documentId: json['documentId']?.toString() ?? '',
      documentTitle: json['documentTitle']?.toString() ?? 'Technical Document',
      revision: json['revision']?.toString() ?? 'Rev 1.0',
      page: (json['page'] is num) ? (json['page'] as num).toInt() : 1,
      section: json['section']?.toString(),
      excerpt: json['excerpt']?.toString() ?? '',
      figures: parsedFigures,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'documentId': documentId,
      'documentTitle': documentTitle,
      'revision': revision,
      'page': page,
      if (section != null) 'section': section,
      'excerpt': excerpt,
      'figures': figures,
    };
  }
}
