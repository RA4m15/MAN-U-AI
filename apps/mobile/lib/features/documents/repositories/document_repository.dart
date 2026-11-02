import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../../../core/storage/local_cache_service.dart';
import '../models/document_model.dart';
import '../models/figure_model.dart';
import '../models/upload_document_response.dart';

class DocumentRepository {
  final Dio dio;
  final LocalCacheService? cache;

  static const int maxUploadSizeBytes = 50 * 1024 * 1024; // 50MB backend limit

  DocumentRepository({
    required this.dio,
    this.cache,
  });

  /// Retrieves list of all authorized facility documents.
  Future<List<DocumentModel>> getDocuments({String? equipmentId}) async {
    final queryParams = <String, dynamic>{};
    if (equipmentId != null && equipmentId.isNotEmpty) {
      queryParams['equipmentId'] = equipmentId;
    }

    try {
      final response = await dio.get(
        '/documents',
        queryParameters: queryParams,
      );

      final data = response.data;
      if (data is Map<String, dynamic> && data['data'] is List) {
        final list = (data['data'] as List)
            .whereType<Map<String, dynamic>>()
            .map((item) => DocumentModel.fromJson(item))
            .toList();

        if (equipmentId == null && cache != null && list.isNotEmpty) {
          await cache!.cacheDocuments(list);
        }
        return list;
      }
      return [];
    } catch (_) {
      if (cache != null) {
        final cached = await cache!.getCachedDocuments();
        if (cached.isNotEmpty) {
          if (equipmentId != null && equipmentId.isNotEmpty) {
            return cached.where((d) => d.equipmentId == equipmentId).toList();
          }
          return cached;
        }
      }
      return [];
    }
  }

  /// Retrieves metadata for a specific document by ID.
  Future<DocumentModel?> getDocumentById(String documentId) async {
    try {
      final response = await dio.get('/documents/$documentId');
      final data = response.data;
      if (data is Map<String, dynamic> && data['data'] is Map<String, dynamic>) {
        return DocumentModel.fromJson(data['data'] as Map<String, dynamic>);
      }
      return null;
    } catch (_) {
      if (cache != null) {
        final cached = await cache!.getCachedDocuments();
        try {
          return cached.firstWhere((d) => d.id == documentId);
        } catch (_) {
          return null;
        }
      }
      return null;
    }
  }

  /// Downloads and caches a document PDF locally for offline viewing.
  Future<String?> downloadAndCacheDocumentPdf(
    String documentId, {
    ProgressCallback? onProgress,
  }) async {
    try {
      final response = await dio.get<List<int>>(
        '/documents/$documentId/download',
        options: Options(responseType: ResponseType.bytes),
        onReceiveProgress: onProgress,
      );

      if (response.data != null && cache != null) {
        return await cache!.cacheDocumentPdf(documentId, response.data!);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Checks if a document PDF has been downloaded locally.
  Future<bool> isDocumentPdfCached(String documentId) async {
    if (cache == null) return false;
    return await cache!.isDocumentPdfCached(documentId);
  }

  /// Gets the local file path for a cached document PDF.
  Future<String?> getDocumentPdfPath(String documentId) async {
    if (cache == null) return null;
    return await cache!.getDocumentPdfPath(documentId);
  }

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
