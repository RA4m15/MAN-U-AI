import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../auth/models/auth_state.dart';
import '../models/picked_document.dart';
import '../models/upload_document_response.dart';
import '../repositories/document_repository.dart';

final documentRepositoryProvider = Provider<DocumentRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return DocumentRepository(dio: dio);
});

class DocumentUploadState {
  final PickedDocument? selectedDocument;
  final bool isUploading;
  final double uploadProgress;
  final String? errorMessage;
  final UploadDocumentResponse? successResult;

  const DocumentUploadState({
    this.selectedDocument,
    this.isUploading = false,
    this.uploadProgress = 0.0,
    this.errorMessage,
    this.successResult,
  });

  DocumentUploadState copyWith({
    PickedDocument? Function()? selectedDocument,
    bool? isUploading,
    double? uploadProgress,
    String? Function()? errorMessage,
    UploadDocumentResponse? Function()? successResult,
  }) {
    return DocumentUploadState(
      selectedDocument: selectedDocument != null ? selectedDocument() : this.selectedDocument,
      isUploading: isUploading ?? this.isUploading,
      uploadProgress: uploadProgress ?? this.uploadProgress,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
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
        selectedDocument: () => null,
      );
      return;
    }

    if (document.size > DocumentRepository.maxUploadSizeBytes) {
      state = state.copyWith(
        errorMessage: () => 'File exceeds the 50MB upload limit.',
        selectedDocument: () => null,
      );
      return;
    }

    state = state.copyWith(
      selectedDocument: () => document,
      errorMessage: () => null,
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
      );
    }
  }

  void clearSelection() {
    state = const DocumentUploadState();
  }

  void cancelUpload() {
    if (state.isUploading && _cancelToken != null && !_cancelToken!.isCancelled) {
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
    final userRole = authState is Authenticated ? authState.user.role : 'viewer';
    if (userRole != 'admin' && userRole != 'engineer') {
      state = state.copyWith(
        errorMessage: () =>
            'Access denied: Only administrators and engineers can upload facility documents.',
      );
      return;
    }

    _cancelToken = CancelToken();

    state = state.copyWith(
      isUploading: true,
      uploadProgress: 0.0,
      errorMessage: () => null,
      successResult: () => null,
    );

    try {
      final bytes = await doc.readBytes();
      if (bytes.isEmpty) {
        state = state.copyWith(
          isUploading: false,
          errorMessage: () => 'Unable to read document file contents.',
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
    } catch (err) {
      if (err is DioException && CancelToken.isCancel(err)) {
        state = state.copyWith(
          isUploading: false,
          errorMessage: () => 'Document upload was cancelled.',
        );
        return;
      }

      final errorMsg = _parseUploadError(err);
      state = state.copyWith(
        isUploading: false,
        errorMessage: () => errorMsg,
      );
    } finally {
      _cancelToken = null;
    }
  }

  String _parseUploadError(dynamic err) {
    if (err is FormatException) {
      return err.message;
    }
    if (err is DioException) {
      final statusCode = err.response?.statusCode;
      if (statusCode == 403) {
        return 'Access denied: Only administrators and engineers can upload facility documents.';
      }
      if (statusCode == 413) {
        return 'File exceeds the 50MB upload limit.';
      }
      if (statusCode == 429) {
        return 'Upload rate limit reached. Please wait a moment before trying again.';
      }
      if (statusCode == 503) {
        return 'Database or storage service is temporarily unavailable for document ingestion.';
      }
      if (statusCode == 400) {
        final data = err.response?.data;
        if (data is Map && data['error'] is Map && data['error']['message'] != null) {
          return data['error']['message'].toString();
        }
        return 'Invalid upload request parameters.';
      }
      if (err.type == DioExceptionType.connectionTimeout ||
          err.type == DioExceptionType.sendTimeout ||
          err.type == DioExceptionType.receiveTimeout ||
          err.type == DioExceptionType.connectionError) {
        return 'Network connection to facility server timed out. Please check connectivity.';
      }
    }
    return 'Failed to upload document. Please try again.';
  }
}
