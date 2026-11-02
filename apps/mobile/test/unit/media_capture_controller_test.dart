import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/features/media/controllers/media_capture_controller.dart';
import 'package:manuai_mobile/features/media/models/media_item_model.dart';
import 'package:manuai_mobile/features/media/repositories/media_repository.dart';
import 'package:dio/dio.dart';

class MockMediaRepository extends MediaRepository {
  MockMediaRepository() : super(Dio());

  bool wasIngestCalled = false;
  String? lastTitle;
  String? lastEquipmentId;

  @override
  Future<MediaItemModel> ingestMedia({
    required String fileName,
    required List<int> bytes,
    required String title,
    String? description,
    String? equipmentId,
    List<String>? tags,
    ProgressCallback? onSendProgress,
    CancelToken? cancelToken,
  }) async {
    wasIngestCalled = true;
    lastTitle = title;
    lastEquipmentId = equipmentId;

    onSendProgress?.call(50, 100);
    onSendProgress?.call(100, 100);

    return MediaItemModel(
      id: 'med-12345',
      title: title,
      description: description,
      mediaType: fileName.endsWith('.mp4') ? 'video' : 'image',
      originalFilename: fileName,
      mimeType: fileName.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg',
      sizeBytes: bytes.length,
      uploadedById: 'usr-eng-01',
      status: 'indexed',
      technicalFindings: 'Bearing vibration normal. No thermal hot spots detected.',
      tags: tags ?? [],
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<List<MediaItemModel>> fetchMediaList({String? equipmentId}) async {
    return [];
  }
}

void main() {
  group('MediaCaptureController Unit Tests', () {
    late MockMediaRepository mockRepo;
    late MediaCaptureController controller;

    setUp(() {
      mockRepo = MockMediaRepository();
      controller = MediaCaptureController(mockRepo);
    });

    tearDown(() {
      controller.dispose();
    });

    test('initial state has default values', () {
      expect(controller.state.isInitializing, isFalse);
      expect(controller.state.isCameraInitialized, isFalse);
      expect(controller.state.captureMode, equals(CaptureMode.photo));
      expect(controller.state.isRecording, isFalse);
      expect(controller.state.capturedPhotos, isEmpty);
      expect(controller.state.capturedVideo, isNull);
    });

    test('setCaptureMode toggles between photo and video', () {
      controller.setCaptureMode(CaptureMode.video);
      expect(controller.state.captureMode, equals(CaptureMode.video));

      controller.setCaptureMode(CaptureMode.photo);
      expect(controller.state.captureMode, equals(CaptureMode.photo));
    });

    test('fails gracefully when physical camera is unavailable in test environment', () async {
      await controller.initCamera();
      // In headless test runner without camera hardware, it should gracefully set error message
      expect(controller.state.isInitializing, isFalse);
      expect(controller.state.cameraErrorMessage, isNotNull);
    });

    test('validates that photo is required before uploading in photo mode', () async {
      final success = await controller.uploadMedia(title: 'Test Photo Upload');
      expect(success, isFalse);
      expect(controller.state.uploadErrorMessage, contains('Please capture or select at least one photograph'));
      expect(mockRepo.wasIngestCalled, isFalse);
    });

    test('validates that video is required before uploading in video mode', () async {
      controller.setCaptureMode(CaptureMode.video);
      final success = await controller.uploadMedia(title: 'Test Video Upload');
      expect(success, isFalse);
      expect(controller.state.uploadErrorMessage, contains('Please record or select a video'));
      expect(mockRepo.wasIngestCalled, isFalse);
    });

    test('cancels in-flight upload properly', () {
      controller.cancelUpload();
      expect(controller.state.isUploading, isFalse);
      expect(controller.state.uploadErrorMessage, equals('Upload cancelled.'));
    });
  });
}
