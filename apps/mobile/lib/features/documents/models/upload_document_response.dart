class UploadDocumentResponse {
  final String id;
  final String title;
  final String revision;
  final String status;
  final String message;

  const UploadDocumentResponse({
    required this.id,
    required this.title,
    required this.revision,
    required this.status,
    required this.message,
  });

  factory UploadDocumentResponse.fromJson(Map<String, dynamic> json) {
    return UploadDocumentResponse(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      revision: json['revision']?.toString() ?? 'Rev 1.0',
      status: json['status']?.toString() ?? 'processing',
      message: json['message']?.toString() ?? 'Document uploaded successfully',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'revision': revision,
      'status': status,
      'message': message,
    };
  }
}
