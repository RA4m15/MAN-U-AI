import 'dart:async';
import 'package:camera/camera.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../models/media_item_model.dart';
import '../repositories/media_repository.dart';

enum CaptureMode { photo, video }

@immutable
class MediaCaptureState {
  final bool isInitializing;
  final bool isCameraInitialized;
  final String? cameraErrorMessage;
  final List<CameraDescription> cameras;
  final int selectedCameraIndex;
  final CaptureMode captureMode;
  final FlashMode flashMode;
  final bool isRecording;
  final int recordingDurationSeconds;
  final List<XFile> capturedPhotos;
  final XFile? capturedVideo;
  final bool isUploading;
  final double uploadProgress;
  final String? uploadErrorMessage;
  final MediaItemModel? lastUploadedMedia;
  final bool isSuccess;

  const MediaCaptureState({
    this.isInitializing = false,
    this.isCameraInitialized = false,
    this.cameraErrorMessage,
    this.cameras = const [],
    this.selectedCameraIndex = 0,
    this.captureMode = CaptureMode.photo,
    this.flashMode = FlashMode.auto,
    this.isRecording = false,
    this.recordingDurationSeconds = 0,
    this.capturedPhotos = const [],
    this.capturedVideo,
    this.isUploading = false,
    this.uploadProgress = 0.0,
    this.uploadErrorMessage,
    this.lastUploadedMedia,
    this.isSuccess = false,
  });

  MediaCaptureState copyWith({
    bool? isInitializing,
    bool? isCameraInitialized,
    String? Function()? cameraErrorMessage,
    List<CameraDescription>? cameras,
    int? selectedCameraIndex,
    CaptureMode? captureMode,
    FlashMode? flashMode,
    bool? isRecording,
    int? recordingDurationSeconds,
    List<XFile>? capturedPhotos,
    XFile? Function()? capturedVideo,
    bool? isUploading,
    double? uploadProgress,
    String? Function()? uploadErrorMessage,
    MediaItemModel? Function()? lastUploadedMedia,
    bool? isSuccess,
  }) {
    return MediaCaptureState(
      isInitializing: isInitializing ?? this.isInitializing,
      isCameraInitialized: isCameraInitialized ?? this.isCameraInitialized,
      cameraErrorMessage: cameraErrorMessage != null
          ? cameraErrorMessage()
          : this.cameraErrorMessage,
      cameras: cameras ?? this.cameras,
      selectedCameraIndex: selectedCameraIndex ?? this.selectedCameraIndex,
      captureMode: captureMode ?? this.captureMode,
      flashMode: flashMode ?? this.flashMode,
      isRecording: isRecording ?? this.isRecording,
      recordingDurationSeconds:
          recordingDurationSeconds ?? this.recordingDurationSeconds,
      capturedPhotos: capturedPhotos ?? this.capturedPhotos,
      capturedVideo:
          capturedVideo != null ? capturedVideo() : this.capturedVideo,
      isUploading: isUploading ?? this.isUploading,
      uploadProgress: uploadProgress ?? this.uploadProgress,
      uploadErrorMessage: uploadErrorMessage != null
          ? uploadErrorMessage()
          : this.uploadErrorMessage,
      lastUploadedMedia: lastUploadedMedia != null
          ? lastUploadedMedia()
          : this.lastUploadedMedia,
      isSuccess: isSuccess ?? this.isSuccess,
    );
  }
}

final mediaCaptureControllerProvider =
    StateNotifierProvider.autoDispose<MediaCaptureController, MediaCaptureState>(
        (ref) {
  final repo = ref.watch(mediaRepositoryProvider);
  return MediaCaptureController(repo);
});

class MediaCaptureController extends StateNotifier<MediaCaptureState> {
  final MediaRepository _repository;
  CameraController? _cameraController;
  final ImagePicker _picker = ImagePicker();
  Timer? _recordingTimer;
  CancelToken? _cancelToken;

  MediaCaptureController(this._repository) : super(const MediaCaptureState());

  CameraController? get cameraController => _cameraController;

  /// Initializes the device camera or fails gracefully with clear message.
  Future<void> initCamera() async {
    if (state.isInitializing) return;

    state = state.copyWith(
      isInitializing: true,
      cameraErrorMessage: () => null,
    );

    try {
      final available = await availableCameras();
      if (available.isEmpty) {
        state = state.copyWith(
          isInitializing: false,
          isCameraInitialized: false,
          cameras: [],
          cameraErrorMessage: () =>
              'No physical camera detected on this device. You can select photos or videos from your gallery.',
        );
        return;
      }

      final camera = available[0];
      final controller = CameraController(
        camera,
        ResolutionPreset.high,
        enableAudio: true,
      );

      await controller.initialize();
      _cameraController = controller;

      state = state.copyWith(
        isInitializing: false,
        isCameraInitialized: true,
        cameras: available,
        selectedCameraIndex: 0,
        flashMode: FlashMode.auto,
      );
    } catch (e) {
      state = state.copyWith(
        isInitializing: false,
        isCameraInitialized: false,
        cameraErrorMessage: () =>
            'Camera initialization failed (${e.toString()}). You can select photos or videos from your gallery.',
      );
    }
  }

  /// Switches between front and rear cameras where supported.
  Future<void> switchCamera() async {
    if (state.cameras.length < 2 || state.isRecording) return;

    final nextIndex = (state.selectedCameraIndex + 1) % state.cameras.length;
    await _cameraController?.dispose();
    _cameraController = null;

    try {
      final controller = CameraController(
        state.cameras[nextIndex],
        ResolutionPreset.high,
        enableAudio: true,
      );
      await controller.initialize();
      _cameraController = controller;

      state = state.copyWith(
        selectedCameraIndex: nextIndex,
        isCameraInitialized: true,
      );
    } catch (e) {
      state = state.copyWith(
        cameraErrorMessage: () => 'Failed to switch camera: ${e.toString()}',
      );
    }
  }

  /// Cycles flash mode (auto -> always -> off -> auto).
  Future<void> toggleFlash() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return;
    }

    FlashMode nextMode;
    switch (state.flashMode) {
      case FlashMode.auto:
        nextMode = FlashMode.always;
        break;
      case FlashMode.always:
        nextMode = FlashMode.off;
        break;
      case FlashMode.off:
      default:
        nextMode = FlashMode.auto;
        break;
    }

    try {
      await _cameraController!.setFlashMode(nextMode);
      state = state.copyWith(flashMode: nextMode);
    } catch (e) {
      // Ignore unsupported flash mode errors on devices without torch
    }
  }

  /// Changes mode between photo and video.
  void setCaptureMode(CaptureMode mode) {
    if (state.isRecording) return;
    state = state.copyWith(captureMode: mode);
  }

  /// Takes a photograph.
  Future<void> takePhoto() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return;
    }

    try {
      final xFile = await _cameraController!.takePicture();
      final updatedList = List<XFile>.from(state.capturedPhotos)..add(xFile);
      state = state.copyWith(
        capturedPhotos: updatedList,
        uploadErrorMessage: () => null,
      );
    } catch (e) {
      state = state.copyWith(
        uploadErrorMessage: () => 'Failed to capture photo: ${e.toString()}',
      );
    }
  }

  /// Starts recording machine video evidence.
  Future<void> startVideoRecording() async {
    if (_cameraController == null ||
        !_cameraController!.value.isInitialized ||
        state.isRecording) {
      return;
    }

    try {
      await _cameraController!.startVideoRecording();
      state = state.copyWith(
        isRecording: true,
        recordingDurationSeconds: 0,
        capturedVideo: () => null,
        uploadErrorMessage: () => null,
      );

      _recordingTimer?.cancel();
      _recordingTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        final newSec = state.recordingDurationSeconds + 1;
        if (newSec >= 60) {
          // Auto-stop at 60s hard ceiling
          stopVideoRecording();
        } else {
          state = state.copyWith(recordingDurationSeconds: newSec);
        }
      });
    } catch (e) {
      state = state.copyWith(
        isRecording: false,
        uploadErrorMessage: () => 'Failed to start video recording: ${e.toString()}',
      );
    }
  }

  /// Stops video recording and stores the captured video file.
  Future<void> stopVideoRecording() async {
    _recordingTimer?.cancel();
    _recordingTimer = null;

    if (_cameraController == null || !state.isRecording) return;

    try {
      final xFile = await _cameraController!.stopVideoRecording();
      state = state.copyWith(
        isRecording: false,
        capturedVideo: () => xFile,
      );
    } catch (e) {
      state = state.copyWith(
        isRecording: false,
        uploadErrorMessage: () => 'Failed to stop video recording: ${e.toString()}',
      );
    }
  }

  /// Picks media from device gallery.
  Future<void> pickFromGallery() async {
    try {
      if (state.captureMode == CaptureMode.photo) {
        final picked = await _picker.pickImage(
          source: ImageSource.gallery,
          imageQuality: 95,
        );
        if (picked != null) {
          final updated = List<XFile>.from(state.capturedPhotos)..add(picked);
          state = state.copyWith(
            capturedPhotos: updated,
            uploadErrorMessage: () => null,
          );
        }
      } else {
        final picked = await _picker.pickVideo(
          source: ImageSource.gallery,
          maxDuration: const Duration(seconds: 60),
        );
        if (picked != null) {
          state = state.copyWith(
            capturedVideo: () => picked,
            uploadErrorMessage: () => null,
          );
        }
      }
    } catch (e) {
      state = state.copyWith(
        uploadErrorMessage: () => 'Failed to select media from gallery: ${e.toString()}',
      );
    }
  }

  /// Removes a captured photograph at index.
  void removePhoto(int index) {
    if (index >= 0 && index < state.capturedPhotos.length) {
      final updated = List<XFile>.from(state.capturedPhotos)..removeAt(index);
      state = state.copyWith(capturedPhotos: updated);
    }
  }

  /// Clears captured video.
  void clearVideo() {
    state = state.copyWith(capturedVideo: () => null);
  }

  /// Submits the captured media to the backend ingestion endpoint.
  Future<bool> uploadMedia({
    required String title,
    String? description,
    String? equipmentId,
  }) async {
    final isPhoto = state.captureMode == CaptureMode.photo;

    if (isPhoto && state.capturedPhotos.isEmpty) {
      state = state.copyWith(
        uploadErrorMessage: () => 'Please capture or select at least one photograph.',
      );
      return false;
    }

    if (!isPhoto && state.capturedVideo == null) {
      state = state.copyWith(
        uploadErrorMessage: () => 'Please record or select a video to upload.',
      );
      return false;
    }

    state = state.copyWith(
      isUploading: true,
      uploadProgress: 0.05,
      uploadErrorMessage: () => null,
      isSuccess: false,
    );

    _cancelToken = CancelToken();

    try {
      if (isPhoto) {
        // Ingest primary photo (or first photo)
        final photo = state.capturedPhotos.first;
        final bytes = await photo.readAsBytes();
        final fileName = photo.name.isNotEmpty ? photo.name : 'inspection_photo.jpg';

        final result = await _repository.ingestMedia(
          fileName: fileName,
          bytes: bytes,
          title: title,
          description: description,
          equipmentId: equipmentId,
          tags: ['machine_evidence', 'field_photo'],
          onSendProgress: (sent, total) {
            if (total > 0) {
              state = state.copyWith(uploadProgress: sent / total);
            }
          },
          cancelToken: _cancelToken,
        );

        state = state.copyWith(
          isUploading: false,
          uploadProgress: 1.0,
          lastUploadedMedia: () => result,
          isSuccess: true,
        );
        return true;
      } else {
        final video = state.capturedVideo!;
        final bytes = await video.readAsBytes();
        final fileName = video.name.isNotEmpty ? video.name : 'inspection_video.mp4';

        final result = await _repository.ingestMedia(
          fileName: fileName,
          bytes: bytes,
          title: title,
          description: description,
          equipmentId: equipmentId,
          tags: ['machine_evidence', 'field_video'],
          onSendProgress: (sent, total) {
            if (total > 0) {
              state = state.copyWith(uploadProgress: sent / total);
            }
          },
          cancelToken: _cancelToken,
        );

        state = state.copyWith(
          isUploading: false,
          uploadProgress: 1.0,
          lastUploadedMedia: () => result,
          isSuccess: true,
        );
        return true;
      }
    } on DioException catch (dioErr) {
      String msg = 'Media upload failed.';
      if (dioErr.type == DioExceptionType.cancel) {
        msg = 'Media upload was cancelled.';
      } else if (dioErr.response?.data is Map<String, dynamic>) {
        final data = dioErr.response!.data as Map<String, dynamic>;
        msg = data['error']?['message']?.toString() ??
            dioErr.message ??
            'Server rejected upload.';
      } else {
        msg = dioErr.message ?? 'Network connection error during upload.';
      }

      state = state.copyWith(
        isUploading: false,
        uploadErrorMessage: () => msg,
      );
      return false;
    } catch (e) {
      state = state.copyWith(
        isUploading: false,
        uploadErrorMessage: () => 'Upload failed: ${e.toString()}',
      );
      return false;
    } finally {
      _cancelToken = null;
    }
  }

  /// Cancels an in-flight upload.
  void cancelUpload() {
    _cancelToken?.cancel('User cancelled media upload.');
    state = state.copyWith(
      isUploading: false,
      uploadErrorMessage: () => 'Upload cancelled.',
    );
  }

  @override
  void dispose() {
    _recordingTimer?.cancel();
    _cancelToken?.cancel();
    _cameraController?.dispose();
    super.dispose();
  }
}

