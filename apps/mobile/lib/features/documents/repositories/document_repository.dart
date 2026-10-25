import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../models/figure_model.dart';
import '../models/upload_document_response.dart';

class DocumentRepository {
  final Dio dio;

  static const int maxUploadSizeBytes = 50 * 1024 * 1024; // 50MB backend limit

  DocumentRepository({required this.dio});

  /// Streams genuine figure image bytes using authenticated session.
  Future<Uint8List> getFigureImageBytes({
    required String documentId,
    required String figureId,
  }) async {
    final response = await dio.get<List<int>>(
      '/documents/$documentId/figures/$figureId/image',
      options: Options(
        responseType: ResponseType.bytes,
      ),
    );

    if (response.data != null) {
      return Uint8List.fromList(response.data!);
    }
    throw Exception('Empty image response from server');
  }

  /// Retrieves figure metadata records for a document.
  Future<List<FigureModel>> getDocumentFigures({
    required String documentId,
    int? page,
  }) async {
    final queryParams = <String, dynamic>{};
    if (page != null) {
      queryParams['page'] = page;
    }

    final response = await dio.get(
      '/documents/$documentId/figures',
      queryParameters: queryParams,
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is List) {
      return (data['data'] as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => FigureModel.fromJson(item))
          .toList();
    }
    return [];
  }

  /// Uploads a genuine PDF document for background ingestion into the plant knowledge base.
  Future<UploadDocumentResponse> uploadDocument({
    required String fileName,
    required List<int> bytes,
    String? title,
    String? revision,
    String? equipmentId,
    ProgressCallback? onSendProgress,
    CancelToken? cancelToken,
  }) async {
    // Client-side guard 1: Supported file type validation (Only PDF)
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      throw const FormatException('Only PDF documents are supported for ingestion.');
    }

    // Client-side guard 2: Size limit (50MB)
    if (bytes.length > maxUploadSizeBytes) {
      throw const FormatException('File exceeds the 50MB upload limit.');
    }

    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(
        bytes,
        filename: fileName,
      ),
      if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
      if (revision != null && revision.trim().isNotEmpty) 'revision': revision.trim(),
      if (equipmentId != null && equipmentId.trim().isNotEmpty) 'equipmentId': equipmentId.trim(),
    });

    final response = await dio.post(
      '/documents/upload',
      data: formData,
      onSendProgress: onSendProgress,
      cancelToken: cancelToken,
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is Map<String, dynamic>) {
      return UploadDocumentResponse.fromJson(data['data'] as Map<String, dynamic>);
    }
    throw Exception('Malformed response when uploading document');
  }
}
