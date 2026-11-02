import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/widgets/terminal_components.dart';
import '../../documents/views/widgets/document_upload_modal.dart';
import '../../equipment/models/equipment_model.dart';
import '../controllers/media_capture_controller.dart';
import '../models/media_item_model.dart';

class MediaCaptureScreen extends ConsumerStatefulWidget {
  final EquipmentModel? initialEquipment;

  const MediaCaptureScreen({
    super.key,
    this.initialEquipment,
  });

  @override
  ConsumerState<MediaCaptureScreen> createState() => _MediaCaptureScreenState();
}

class _MediaCaptureScreenState extends ConsumerState<MediaCaptureScreen> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  EquipmentModel? _selectedEquipment;
  bool _showReviewSheet = false;

  @override
  void initState() {
    super.initState();
    _selectedEquipment = widget.initialEquipment;
    _titleController.text = _selectedEquipment != null
        ? '${_selectedEquipment!.name} Visual Inspection'
        : 'Machine Evidence Capture';

    // Initialize camera on mount
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(mediaCaptureControllerProvider.notifier).initCamera();
    });
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  void _openPdfUploadModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => DocumentUploadModal(
        defaultEquipment: _selectedEquipment,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(mediaCaptureControllerProvider);
    final controllerNotifier = ref.read(mediaCaptureControllerProvider.notifier);
    final hasMedia = state.capturedPhotos.isNotEmpty || state.capturedVideo != null;

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            // 1. Live Camera Preview or Graceful Fallback
            Positioned.fill(
              child: _buildCameraPreview(state, controllerNotifier),
            ),

            // 2. Top Industrial Control Header
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: _buildTopBar(state, controllerNotifier),
            ),

            // 3. Recording Indicator Bar (when recording)
            if (state.isRecording)
              Positioned(
                top: 72,
                left: 0,
                right: 0,
                child: _buildRecordingBanner(state),
              ),

            // 4. Bottom Controls (Shutter, Mode selector, Gallery)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: _buildBottomBar(state, controllerNotifier, hasMedia),
            ),

            // 5. Review & Submission Drawer (when reviewing or uploading)
            if (_showReviewSheet || state.isUploading || state.isSuccess)
              Positioned.fill(
                child: _buildReviewOverlay(state, controllerNotifier),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCameraPreview(
    MediaCaptureState state,
    MediaCaptureController notifier,
  ) {
    if (state.isInitializing) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppColors.primary),
            SizedBox(height: 16.0),
            Text(
              'INITIALIZING OPTICAL SENSORS...',
              style: TextStyle(
                color: AppColors.onSurfaceVariant,
                fontSize: 12.0,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.0,
              ),
            ),
          ],
        ),
      );
    }

    final camController = notifier.cameraController;
    if (state.isCameraInitialized && camController != null && camController.value.isInitialized) {
      return Center(
        child: CameraPreview(camController),
      );
    }

    // Hardware Unavailable or Permission Denied Industrial Fallback
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.all(24.0),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.videocam_off_rounded,
              size: 54.0,
              color: AppColors.onSurfaceVariant,
            ),
            const SizedBox(height: 16.0),
            const Text(
              'OPTICAL SENSOR STANDBY',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16.0,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 8.0),
            Text(
              state.cameraErrorMessage ??
                  'Camera unavailable in current environment. You can select inspection photos/videos from storage or ingest PDF manuals directly.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.onSurfaceVariant,
                fontSize: 13.0,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24.0),
            Wrap(
              spacing: 12.0,
              runSpacing: 12.0,
              alignment: WrapAlignment.center,
              children: [
                ElevatedButton.icon(
                  key: const Key('gallery_fallback_button'),
                  onPressed: () => notifier.pickFromGallery(),
                  icon: const Icon(Icons.photo_library_outlined, size: 18.0),
                  label: const Text('DEVICE GALLERY'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.surfaceAlt,
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: AppColors.border),
                  ),
                ),
                ElevatedButton.icon(
                  key: const Key('pdf_fallback_button'),
                  onPressed: _openPdfUploadModal,
                  icon: const Icon(Icons.picture_as_pdf_outlined, size: 18.0),
                  label: const Text('INGEST PDF'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTopBar(
    MediaCaptureState state,
    MediaCaptureController notifier,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black.withValues(alpha: 0.85),
            Colors.transparent,
          ],
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Close button
          IconButton(
            key: const Key('media_capture_close_button'),
            icon: const Icon(Icons.close_rounded, color: Colors.white, size: 26.0),
            tooltip: 'Exit Inspection Console',
            onPressed: () => Navigator.of(context).pop(),
          ),

          // Title badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(16.0),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.5)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                StatusDot(color: AppColors.primary, size: 6.0),
                SizedBox(width: 6.0),
                Text(
                  'INSPECTION OPTICS // 4K',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11.0,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),

          // Action icons: PDF upload, Flash, Switch Camera
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // PDF manual ingestion shortcut
              IconButton(
                key: const Key('open_pdf_ingest_button'),
                icon: const Icon(Icons.picture_as_pdf_rounded, color: Colors.white, size: 22.0),
                tooltip: 'Ingest PDF Manual',
                onPressed: _openPdfUploadModal,
              ),

              // Flash toggle
              if (state.isCameraInitialized)
                IconButton(
                  key: const Key('toggle_flash_button'),
                  icon: Icon(
                    state.flashMode == FlashMode.always
                        ? Icons.flash_on_rounded
                        : state.flashMode == FlashMode.off
                            ? Icons.flash_off_rounded
                            : Icons.flash_auto_rounded,
                    color: state.flashMode == FlashMode.off
                        ? AppColors.onSurfaceVariant
                        : AppColors.warning,
                    size: 22.0,
                  ),
                  tooltip: 'Flash Mode',
                  onPressed: () => notifier.toggleFlash(),
                ),

              // Switch camera
              if (state.cameras.length > 1)
                IconButton(
                  key: const Key('switch_camera_button'),
                  icon: const Icon(Icons.cameraswitch_rounded, color: Colors.white, size: 22.0),
                  tooltip: 'Switch Camera',
                  onPressed: () => notifier.switchCamera(),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRecordingBanner(MediaCaptureState state) {
    final minutes = (state.recordingDurationSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (state.recordingDurationSeconds % 60).toString().padLeft(2, '0');

    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
        decoration: BoxDecoration(
          color: AppColors.error.withValues(alpha: 0.85),
          borderRadius: BorderRadius.circular(20.0),
          boxShadow: [
            BoxShadow(
              color: AppColors.error.withValues(alpha: 0.4),
              blurRadius: 10.0,
              spreadRadius: 2.0,
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const StatusDot(color: Colors.white, size: 10.0),
            const SizedBox(width: 8.0),
            Text(
              'REC $minutes:$seconds / 01:00',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 13.0,
                letterSpacing: 1.0,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomBar(
    MediaCaptureState state,
    MediaCaptureController notifier,
    bool hasMedia,
  ) {
    return Container(
      padding: const EdgeInsets.only(top: 16.0, bottom: 24.0, left: 24.0, right: 24.0),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [
            Colors.black.withValues(alpha: 0.95),
            Colors.transparent,
          ],
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 1. Photo / Video Mode Selector
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildModeTab(
                label: 'PHOTO',
                isSelected: state.captureMode == CaptureMode.photo,
                onTap: () => notifier.setCaptureMode(CaptureMode.photo),
              ),
              const SizedBox(width: 24.0),
              _buildModeTab(
                label: 'VIDEO',
                isSelected: state.captureMode == CaptureMode.video,
                onTap: () => notifier.setCaptureMode(CaptureMode.video),
              ),
            ],
          ),
          const SizedBox(height: 20.0),

          // 2. Action Controls: Gallery, Shutter, Review Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              // Gallery Picker Button
              IconButton(
                key: const Key('media_gallery_button'),
                icon: const Icon(Icons.photo_library_outlined, color: Colors.white, size: 28.0),
                tooltip: 'Select From Gallery',
                onPressed: () => notifier.pickFromGallery(),
              ),

              // Shutter / Record Button
              _buildShutterButton(state, notifier),

              // Review / Submit Pill
              if (hasMedia)
                GestureDetector(
                  key: const Key('media_review_button'),
                  onTap: () {
                    setState(() {
                      _showReviewSheet = true;
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(20.0),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.check_rounded, color: Colors.white, size: 16.0),
                        const SizedBox(width: 4.0),
                        Text(
                          state.captureMode == CaptureMode.photo
                              ? '${state.capturedPhotos.length} PENDING'
                              : '1 VIDEO',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11.0,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                const SizedBox(width: 48.0), // Spacer to balance gallery button
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildModeTab({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Text(
        label,
        style: TextStyle(
          color: isSelected ? AppColors.primary : AppColors.onSurfaceVariant,
          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
          fontSize: 13.0,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildShutterButton(
    MediaCaptureState state,
    MediaCaptureController notifier,
  ) {
    if (state.captureMode == CaptureMode.photo) {
      return GestureDetector(
        key: const Key('photo_shutter_button'),
        onTap: () => notifier.takePhoto(),
        child: Container(
          width: 76.0,
          height: 76.0,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 4.0),
          ),
          child: Center(
            child: Container(
              width: 60.0,
              height: 60.0,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
              ),
            ),
          ),
        ),
      );
    } else {
      // Video record button
      final isRec = state.isRecording;
      return GestureDetector(
        key: const Key('video_shutter_button'),
        onTap: () {
          if (isRec) {
            notifier.stopVideoRecording();
          } else {
            notifier.startVideoRecording();
          }
        },
        child: Container(
          width: 76.0,
          height: 76.0,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: isRec ? AppColors.error : Colors.white,
              width: 4.0,
            ),
          ),
          child: Center(
            child: isRec
                ? Container(
                    width: 32.0,
                    height: 32.0,
                    decoration: BoxDecoration(
                      color: AppColors.error,
                      borderRadius: BorderRadius.circular(6.0),
                    ),
                  )
                : Container(
                    width: 60.0,
                    height: 60.0,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.error,
                    ),
                  ),
          ),
        ),
      );
    }
  }

  Widget _buildReviewOverlay(
    MediaCaptureState state,
    MediaCaptureController notifier,
  ) {
    return Container(
      color: Colors.black.withValues(alpha: 0.90),
      child: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'INSPECTION EVIDENCE REVIEW',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14.0,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.0,
                    ),
                  ),
                  if (!state.isUploading)
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white),
                      onPressed: () {
                        setState(() {
                          _showReviewSheet = false;
                        });
                      },
                    ),
                ],
              ),
            ),
            const Divider(color: AppColors.border, height: 1.0),

            // Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Captured media preview strip
                    if (state.captureMode == CaptureMode.photo)
                      _buildPhotosPreviewStrip(state, notifier)
                    else
                      _buildVideoPreviewCard(state, notifier),

                    const SizedBox(height: 20.0),

                    // Title input
                    Text('EVIDENCE TITLE', style: AppTypography.labelUppercase),
                    const SizedBox(height: 6.0),
                    TextField(
                      key: const Key('media_title_input'),
                      controller: _titleController,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                        hintText: 'e.g. Pump P-102 Impeller Seal Inspection',
                      ),
                    ),
                    const SizedBox(height: 16.0),

                    // Description input
                    Text('OBSERVATIONS & CONTEXT', style: AppTypography.labelUppercase),
                    const SizedBox(height: 6.0),
                    TextField(
                      key: const Key('media_description_input'),
                      controller: _descriptionController,
                      style: const TextStyle(color: Colors.white),
                      maxLines: 3,
                      decoration: const InputDecoration(
                        hintText: 'Describe machine condition, gauge readings, or wear indicators...',
                      ),
                    ),
                    const SizedBox(height: 20.0),

                    // Equipment association
                    if (_selectedEquipment != null)
                      Container(
                        padding: const EdgeInsets.all(12.0),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.precision_manufacturing_rounded,
                                color: AppColors.primary, size: 20.0),
                            const SizedBox(width: 10.0),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'ASSOCIATED EQUIPMENT',
                                    style: AppTypography.caption,
                                  ),
                                  Text(
                                    _selectedEquipment!.name,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13.0,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                    const SizedBox(height: 24.0),

                    // Error banner
                    if (state.uploadErrorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12.0),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(color: AppColors.error),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded,
                                color: AppColors.error, size: 20.0),
                            const SizedBox(width: 10.0),
                            Expanded(
                              child: Text(
                                state.uploadErrorMessage!,
                                style: const TextStyle(
                                  color: AppColors.error,
                                  fontSize: 12.0,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16.0),
                    ],

                    // Upload Progress / Status feedback
                    if (state.isUploading) ...[
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'INGESTING & VECTOR INDEXING...',
                                style: TextStyle(
                                  color: AppColors.primary,
                                  fontSize: 12.0,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                '${(state.uploadProgress * 100).toInt()}%',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12.0,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8.0),
                          LinearProgressIndicator(
                            value: state.uploadProgress > 0 ? state.uploadProgress : null,
                            color: AppColors.primary,
                            backgroundColor: AppColors.surfaceAlt,
                          ),
                          const SizedBox(height: 12.0),
                          Center(
                            child: TextButton(
                              onPressed: () => notifier.cancelUpload(),
                              child: const Text('CANCEL INGESTION',
                                  style: TextStyle(color: AppColors.error)),
                            ),
                          ),
                        ],
                      ),
                    ] else if (state.isSuccess) ...[
                      _buildSuccessCard(state.lastUploadedMedia),
                    ] else ...[
                      MachinedPrimaryButton(
                        buttonKey: const Key('submit_media_button'),
                        label: 'SUBMIT & INDEX EVIDENCE',
                        icon: Icons.cloud_upload_rounded,
                        onPressed: () async {
                          final ok = await notifier.uploadMedia(
                            title: _titleController.text,
                            description: _descriptionController.text,
                            equipmentId: _selectedEquipment?.id,
                          );
                          if (ok) {
                            setState(() {});
                          }
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotosPreviewStrip(
    MediaCaptureState state,
    MediaCaptureController notifier,
  ) {
    return SizedBox(
      height: 100.0,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: state.capturedPhotos.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: 10.0),
        itemBuilder: (ctx, idx) {
          if (idx == state.capturedPhotos.length) {
            // Add more photo tile
            return InkWell(
              onTap: () {
                setState(() {
                  _showReviewSheet = false;
                });
              },
              child: Container(
                width: 100.0,
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(8.0),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.add_a_photo_outlined, color: Colors.white, size: 24.0),
                    SizedBox(height: 4.0),
                    Text('ADD MORE', style: TextStyle(color: Colors.white, fontSize: 10.0)),
                  ],
                ),
              ),
            );
          }

          final photo = state.capturedPhotos[idx];
          return Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8.0),
                child: kIsWeb
                    ? Container(
                        width: 100.0,
                        color: AppColors.surfaceAlt,
                        child: const Icon(Icons.image, color: Colors.white),
                      )
                    : Image.file(
                        File(photo.path),
                        width: 100.0,
                        height: 100.0,
                        fit: BoxFit.cover,
                      ),
              ),
              Positioned(
                top: 4.0,
                right: 4.0,
                child: GestureDetector(
                  onTap: () => notifier.removePhoto(idx),
                  child: Container(
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.black54,
                    ),
                    padding: const EdgeInsets.all(4.0),
                    child: const Icon(Icons.close, color: Colors.white, size: 14.0),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildVideoPreviewCard(
    MediaCaptureState state,
    MediaCaptureController notifier,
  ) {
    final video = state.capturedVideo;
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(8.0),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.videocam_rounded, color: AppColors.primary, size: 36.0),
          const SizedBox(width: 12.0),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'VIDEO EVIDENCE CAPTURED',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 13.0,
                  ),
                ),
                Text(
                  video?.name ?? 'inspection_video.mp4',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption,
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded, color: AppColors.error),
            onPressed: () {
              notifier.clearVideo();
              setState(() {
                _showReviewSheet = false;
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessCard(MediaItemModel? media) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8.0),
        border: Border.all(color: AppColors.success),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: AppColors.success, size: 22.0),
              SizedBox(width: 8.0),
              Text(
                'EVIDENCE INDEXED SUCCESSFULLY',
                style: TextStyle(
                  color: AppColors.success,
                  fontWeight: FontWeight.w800,
                  fontSize: 13.0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10.0),
          Text(
            media?.technicalFindings ??
                'Multimodal analysis complete. Technical findings stored in MongoDB and indexed in vector knowledge base.',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12.0,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16.0),
          MachinedPrimaryButton(
            buttonKey: const Key('evidence_done_button'),
            label: 'DONE',
            onPressed: () {
              Navigator.of(context).pop();
            },
          ),
        ],
      ),
    );
  }
}
