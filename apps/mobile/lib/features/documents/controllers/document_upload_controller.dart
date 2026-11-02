import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/storage/local_cache_service.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../auth/models/auth_state.dart';
import '../models/document_model.dart';
import '../models/picked_document.dart';
import '../models/upload_document_response.dart';
import '../repositories/document_repository.dart';

final documentRepositoryProvider = Provider<DocumentRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final cache = ref.watch(localCacheServiceProvider);
  return DocumentRepository(dio: dio, cache: cache);
});

/// Asynchronously provides the list of all facility documents authorized for the current user.
final documentListProvider = FutureProvider<List<DocumentModel>>((ref) async {
  final repository = ref.watch(documentRepositoryProvider);
  return await repository.getDocuments();
});

/// Structured upload error information capturing HTTP status, API error code, stage, and request ID.
class DocumentUploadDiagnostics {
  final int? statusCode;
  final String? errorCode;
  final String message;
  final String? requestId;
  final String? stage;

  const DocumentUploadDiagnostics({
    this.statusCode,
    this.errorCode,
    required this.message,
    this.requestId,
    this.stage,
  });

  /// Formatted diagnostic string for production error visibility.
  String get formattedDisplay {
    final buffer = StringBuffer();
    if (statusCode != null) {
      buffer.write('[HTTP $statusCode] ');
    }
    if (errorCode != null && errorCode!.isNotEmpty) {
      buffer.write('$errorCode: ');
    }
    buffer.write(message);
    if (stage != null && stage!.isNotEmpty) {
      buffer.write(' (Stage: $stage)');
    }
    if (requestId != null && requestId!.isNotEmpty) {
      buffer.write(' [Req: $requestId]');
    }
    return buffer.toString();
  }
}

class DocumentUploadState {
  final PickedDocument? selectedDocument;
  final bool isUploading;
  final double uploadProgress;
  final String? errorMessage;
  final DocumentUploadDiagnostics? diagnostics;
  final UploadDocumentResponse? successResult;

  const DocumentUploadState({
    this.selectedDocument,
    this.isUploading = false,
    this.uploadProgress = 0.0,
    this.errorMessage,
    this.diagnostics,
    this.successResult,
  });

  DocumentUploadState copyWith({
    PickedDocument? Function()? selectedDocument,
    bool? isUploading,
    double? uploadProgress,
    String? Function()? errorMessage,
    DocumentUploadDiagnostics? Function()? diagnostics,
    UploadDocumentResponse? Function()? successResult,
  }) {
    return DocumentUploadState(
      selectedDocument: selectedDocument != null ? selectedDocument() : this.selectedDocument,
      isUploading: isUploading ?? this.isUploading,
      uploadProgress: uploadProgress ?? this.uploadProgress,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
      diagnostics: diagnostics != null ? diagnostics() : this.diagnostics,
      successResult: successResult != null ? successResult() : this.successResult,
    );
  }
}

final documentUploadControllerProvider =
    NotifierProvider<DocumentUploadController, DocumentUploadState>(
  DocumentUploadController.new,
);

class DocumentUploadController extends Notifier<DocumentUploadState> {
  late final DocumentRepository _repository;
  CancelToken? _cancelToken;

  @override
  DocumentUploadState build() {
    _repository = ref.watch(documentRepositoryProvider);
    ref.onDispose(() {
      _cancelToken?.cancel();
    });
    return const DocumentUploadState();
  }

  /// Sets or selects a verified PDF document for upload.
  void selectDocument(PickedDocument document) {
    if (!document.name.toLowerCase().endsWith('.pdf')) {
      state = state.copyWith(
        errorMessage: () => 'Only PDF documents are supported for ingestion.',
        diagnostics: () => const DocumentUploadDiagnostics(
          statusCode: 400,
          errorCode: 'INVALID_FILE_TYPE',
          message: 'Only PDF documents are supported for ingestion.',
        ),
        selectedDocument: () => null,
      );
      return;
    }

    if (document.size > DocumentRepository.maxUploadSizeBytes) {
      state = state.copyWith(
        errorMessage: () => 'File exceeds the 50MB upload limit.',
        diagnostics: () => const DocumentUploadDiagnostics(
          statusCode: 413,
          errorCode: 'FILE_TOO_LARGE',
          message: 'File exceeds the 50MB upload limit.',
        ),
        selectedDocument: () => null,
      );
      return;
    }

    state = state.copyWith(
      selectedDocument: () => document,
      errorMessage: () => null,
      diagnostics: () => null,
      successResult: () => null,
      uploadProgress: 0.0,
    );
  }

  /// Native document picker for PDF files.
  Future<void> pickPdfFile() async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
      );

      if (result.isNotEmpty) {
        final f = result.first;
        final size = f.lengthSync() ?? (await f.length()) ?? 0;
        selectDocument(
          PickedDocument(
            name: f.name,
            size: size,
            readBytes: f.readAsBytes,
          ),
        );
      }
    } catch (err) {
      state = state.copyWith(
        errorMessage: () => 'Failed to access document picker: $err',
        diagnostics: () => DocumentUploadDiagnostics(
          message: 'Failed to access document picker: $err',
          stage: 'file_picker',
        ),
      );
    }
  }

  /// Resets the selected file and active upload status.
  void clearSelection() {
    state = state.copyWith(
      selectedDocument: () => null,
      errorMessage: () => null,
      diagnostics: () => null,
      successResult: () => null,
      uploadProgress: 0.0,
      isUploading: false,
    );
  }

  /// Cancels an in-progress upload request cleanly.
  void cancelUpload() {
    if (_cancelToken != null && !_cancelToken!.isCancelled) {
      _cancelToken!.cancel('User cancelled document upload');
    }
  }

  /// Dispatches the verified PDF to POST /api/v1/documents/upload.
  Future<void> upload({
    String? title,
    String? revision,
    String? equipmentId,
  }) async {
    final doc = state.selectedDocument;
    if (doc == null || state.isUploading) {
      return;
    }

    // Role verification: check if current user role permits document upload
    final authState = ref.read(authControllerProvider);
    final userRole = authState is Authenticated ? authState.user.role : 'operator';
    if (userRole != 'admin' && userRole != 'engineer' && userRole != 'manager') {
      const diag = DocumentUploadDiagnostics(
        statusCode: 403,
        errorCode: 'FORBIDDEN',
        message: 'Access denied: Only administrators and engineers can upload facility documents.',
        stage: 'client_role_guard',
      );
      state = state.copyWith(
        errorMessage: () => diag.message,
        diagnostics: () => diag,
      );
      return;
    }

    _cancelToken = CancelToken();

    state = state.copyWith(
      isUploading: true,
      uploadProgress: 0.0,
      errorMessage: () => null,
      diagnostics: () => null,
      successResult: () => null,
    );

    try {
      final bytes = await doc.readBytes();
      if (bytes.isEmpty) {
        const diag = DocumentUploadDiagnostics(
          statusCode: 400,
          errorCode: 'EMPTY_FILE',
          message: 'Unable to read document file contents.',
          stage: 'file_read',
        );
        state = state.copyWith(
          isUploading: false,
          errorMessage: () => diag.message,
          diagnostics: () => diag,
        );
        return;
      }

      final result = await _repository.uploadDocument(
        fileName: doc.name,
        bytes: bytes,
        title: title,
        revision: revision,
        equipmentId: equipmentId,
        cancelToken: _cancelToken,
        onSendProgress: (sent, total) {
          if (total > 0) {
            state = state.copyWith(uploadProgress: sent / total);
          }
        },
      );

      state = state.copyWith(
        isUploading: false,
        uploadProgress: 1.0,
        successResult: () => result,
      );

      // Refresh documents list cache so the new document appears immediately
      ref.invalidate(documentListProvider);
    } catch (err) {
      if (err is DioException && CancelToken.isCancel(err)) {
        state = state.copyWith(
          isUploading: false,
          errorMessage: () => 'Document upload was cancelled.',
          diagnostics: () => const DocumentUploadDiagnostics(
            errorCode: 'CANCELLED',
            message: 'Document upload was cancelled.',
          ),
        );
        return;
      }

      final diag = _parseUploadError(err);
      state = state.copyWith(
        isUploading: false,
        errorMessage: () => diag.message,
        diagnostics: () => diag,
      );
    } finally {
      _cancelToken = null;
    }
  }

  /// Retries upload for the currently selected file.
  Future<void> retryUpload({
    String? title,
    String? revision,
    String? equipmentId,
  }) async {
    await upload(title: title, revision: revision, equipmentId: equipmentId);
  }

  DocumentUploadDiagnostics _parseUploadError(dynamic err) {
    if (err is FormatException) {
      return DocumentUploadDiagnostics(
        statusCode: 400,
        errorCode: 'CLIENT_VALIDATION',
        message: err.message,
      );
    }
    if (err is DioException) {
      final statusCode = err.response?.statusCode;
      final data = err.response?.data;
      String? errorCode;
      String? serverMsg;
      String? requestId;
      String? stage;

      if (data is Map) {
        if (data['error'] is Map) {
          final errObj = data['error'] as Map;
          errorCode = errObj['code']?.toString();
          serverMsg = errObj['message']?.toString();
          requestId = errObj['requestId']?.toString();
          stage = errObj['stage']?.toString();
        } else if (data['message'] != null) {
          serverMsg = data['message'].toString();
        }
      }

      requestId ??= err.response?.headers.value('x-request-id');

      if (statusCode == 401) {
        return DocumentUploadDiagnostics(
          statusCode: 401,
          errorCode: errorCode ?? 'UNAUTHORIZED',
          message: serverMsg ?? 'Session expired or unauthenticated. Please sign in again.',
          requestId: requestId,
          stage: stage ?? 'authentication',
        );
      }
      if (statusCode == 403) {
        return DocumentUploadDiagnostics(
          statusCode: 403,
          errorCode: errorCode ?? 'FORBIDDEN',
          message: serverMsg ?? 'Access denied: Only administrators and engineers can upload facility documents.',
          requestId: requestId,
          stage: stage ?? 'authorization',
        );
      }
      if (statusCode == 413) {
        return DocumentUploadDiagnostics(
          statusCode: 413,
          errorCode: errorCode ?? 'FILE_TOO_LARGE',
          message: serverMsg ?? 'File exceeds the 50MB upload limit.',
          requestId: requestId,
          stage: stage ?? 'upload_limits',
        );
      }
      if (statusCode == 429) {
        return DocumentUploadDiagnostics(
          statusCode: 429,
          errorCode: errorCode ?? 'RATE_LIMIT_EXCEEDED',
          message: serverMsg ?? 'Upload rate limit reached. Please wait a moment before trying again.',
          requestId: requestId,
          stage: stage ?? 'rate_limiter',
        );
      }
      if (statusCode == 400) {
        return DocumentUploadDiagnostics(
          statusCode: 400,
          errorCode: errorCode ?? 'BAD_REQUEST',
          message: serverMsg ?? 'Invalid document upload metadata or file format.',
          requestId: requestId,
          stage: stage ?? 'validation',
        );
      }
      if (statusCode == 503) {
        return DocumentUploadDiagnostics(
          statusCode: 503,
          errorCode: errorCode ?? 'SERVICE_UNAVAILABLE',
          message: serverMsg ?? 'Database or storage service is temporarily unavailable for document ingestion.',
          requestId: requestId,
          stage: stage ?? 'storage_pipeline',
        );
      }
      if (statusCode != null && statusCode >= 500) {
        return DocumentUploadDiagnostics(
          statusCode: statusCode,
          errorCode: errorCode ?? 'SERVER_ERROR',
          message: serverMsg ?? 'Server encountered an internal error during document processing.',
          requestId: requestId,
          stage: stage ?? 'server_processing',
        );
      }
      if (err.type == DioExceptionType.connectionTimeout ||
          err.type == DioExceptionType.sendTimeout ||
          err.type == DioExceptionType.receiveTimeout ||
          err.type == DioExceptionType.connectionError) {
        return const DocumentUploadDiagnostics(
          statusCode: null,
          errorCode: 'NETWORK_TIMEOUT',
          message: 'Network connection to facility server timed out. Please check connectivity.',
          stage: 'network_transport',
        );
      }
    }
    return const DocumentUploadDiagnostics(
      statusCode: null,
      errorCode: 'UPLOAD_FAILED',
      message: 'Failed to upload document. Please try again.',
    );
  }
}
