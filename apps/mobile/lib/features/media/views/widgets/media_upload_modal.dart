import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/network/connectivity_controller.dart';
import '../../../../core/storage/local_cache_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/widgets/terminal_components.dart';
import '../../../equipment/controllers/equipment_controller.dart';
import '../../../equipment/models/equipment_model.dart';
import '../../repositories/media_repository.dart';

/// Represents a media item chosen by the user before upload.
class SelectedMediaItem {
  final XFile file;
  final String name;
  final int sizeBytes;
  final String mimeType;
  final String mediaType; // 'image' or 'video'

  const SelectedMediaItem({
    required this.file,
    required this.name,
    required this.sizeBytes,
    required this.mimeType,
    required this.mediaType,
  });
}

/// Industrial Gallery Media Upload Modal.
/// Supports multi-image selection, video selection, metadata editing,
/// and backend ingestion via /api/v1/media/ingest or offline queuing.
class MediaUploadModal extends ConsumerStatefulWidget {
  final EquipmentModel? initialEquipment;
  final ImagePicker? picker;
  final List<SelectedMediaItem>? initialItems;

  const MediaUploadModal({
    super.key,
    this.initialEquipment,
    this.picker,
    this.initialItems,
  });

  @override
  ConsumerState<MediaUploadModal> createState() => _MediaUploadModalState();
}

class _MediaUploadModalState extends ConsumerState<MediaUploadModal> {
  late final ImagePicker _picker;
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();

  EquipmentModel? _selectedEquipment;
  final List<SelectedMediaItem> _selectedItems = [];

  bool _isUploading = false;
  double _uploadProgress = 0.0;
  String? _errorMessage;
  String? _successMessage;

  static const int maxImageSizeBytes = 15 * 1024 * 1024; // 15MB
  static const int maxVideoSizeBytes = 100 * 1024 * 1024; // 100MB

  static const supportedImageExtensions = ['.jpg', '.jpeg', '.png'];
  static const supportedVideoExtensions = ['.mp4', '.mov'];

  @override
  void initState() {
    super.initState();
    _picker = widget.picker ?? ImagePicker();
    _selectedEquipment = widget.initialEquipment;

    final eqName = _selectedEquipment?.name ?? 'Machine';
    _titleController.text = '$eqName Visual Inspection';

    if (widget.initialItems != null) {
      _selectedItems.addAll(widget.initialItems!);
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(2)} MB';
  }

  String _detectMimeType(String fileName, String? declaredMime) {
    final lower = fileName.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (declaredMime != null && declaredMime.isNotEmpty) return declaredMime;
    return 'application/octet-stream';
  }

  String? _validateFile(String fileName, int sizeBytes, bool isVideo, [String? mimeType]) {
    final lower = fileName.toLowerCase();
    final lowerMime = mimeType?.toLowerCase() ?? '';
    if (isVideo) {
      final isSupported = supportedVideoExtensions.any((ext) => lower.endsWith(ext)) ||
          lowerMime == 'video/mp4' ||
          lowerMime == 'video/quicktime';
      if (!isSupported) {
        return 'Unsupported video format for "$fileName". Only MP4 and MOV are supported.';
      }
      if (sizeBytes > maxVideoSizeBytes) {
        return 'Video "$fileName" exceeds maximum size of 100 MB (${_formatFileSize(sizeBytes)}).';
      }
    } else {
      final isSupported = supportedImageExtensions.any((ext) => lower.endsWith(ext)) ||
          lowerMime == 'image/jpeg' ||
          lowerMime == 'image/jpg' ||
          lowerMime == 'image/png';
      if (!isSupported) {
        return 'Unsupported image format for "$fileName". Only JPEG and PNG are supported.';
      }
      if (sizeBytes > maxImageSizeBytes) {
        return 'Image "$fileName" exceeds maximum size of 15 MB (${_formatFileSize(sizeBytes)}).';
      }
    }
    return null;
  }

  Future<void> _pickPhotos() async {
    setState(() {
      _errorMessage = null;
    });

    try {
      final pickedFiles = await _picker.pickMultiImage(imageQuality: 95);
      if (pickedFiles.isEmpty) return;

      final List<SelectedMediaItem> newItems = [];
      String? validationError;

      for (final file in pickedFiles) {
        final length = await file.length();
        final effectiveName = file.name.isNotEmpty
            ? file.name
            : (file.path.isNotEmpty
                ? file.path.split(RegExp(r'[/\\]')).last
                : 'photo_${DateTime.now().millisecondsSinceEpoch}.${(file.mimeType?.contains('png') == true) ? 'png' : 'jpg'}');
        final err = _validateFile(effectiveName, length, false, file.mimeType);
        if (err != null) {
          validationError = err;
          break;
        }
        newItems.add(
          SelectedMediaItem(
            file: file,
            name: effectiveName,
            sizeBytes: length,
            mimeType: _detectMimeType(effectiveName, file.mimeType),
            mediaType: 'image',
          ),
        );
      }

      if (validationError != null) {
        setState(() {
          _errorMessage = validationError;
        });
        return;
      }

      setState(() {
        _selectedItems.addAll(newItems);
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to select photos from gallery: ${e.toString()}';
      });
    }
  }

  Future<void> _pickVideo() async {
    setState(() {
      _errorMessage = null;
    });

    try {
      final pickedFile = await _picker.pickVideo(
        source: ImageSource.gallery,
        maxDuration: const Duration(seconds: 60),
      );
      if (pickedFile == null) return;

      final length = await pickedFile.length();
      final effectiveName = pickedFile.name.isNotEmpty
          ? pickedFile.name
          : (pickedFile.path.isNotEmpty
              ? pickedFile.path.split(RegExp(r'[/\\]')).last
              : 'video_${DateTime.now().millisecondsSinceEpoch}.mp4');
      final err = _validateFile(effectiveName, length, true, pickedFile.mimeType);
      if (err != null) {
        setState(() {
          _errorMessage = err;
        });
        return;
      }

      setState(() {
        _selectedItems.add(
          SelectedMediaItem(
            file: pickedFile,
            name: effectiveName,
            sizeBytes: length,
            mimeType: _detectMimeType(effectiveName, pickedFile.mimeType),
            mediaType: 'video',
          ),
        );
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to select video from gallery: ${e.toString()}';
      });
    }
  }

  void _removeItem(int index) {
    if (index >= 0 && index < _selectedItems.length) {
      setState(() {
        _selectedItems.removeAt(index);
      });
    }
  }

  Future<void> _submitUpload() async {
    if (_selectedItems.isEmpty || _isUploading) return;

    final title = _titleController.text.trim();
    if (title.isEmpty) {
      setState(() {
        _errorMessage = 'Please provide a title for the media evidence.';
      });
      return;
    }

    setState(() {
      _isUploading = true;
      _uploadProgress = 0.05;
      _errorMessage = null;
      _successMessage = null;
    });

    final isDeadZone = ref.read(isDeadZoneProvider);
    final cache = ref.read(localCacheServiceProvider);
    final mediaRepo = ref.read(mediaRepositoryProvider);

    try {
      if (isDeadZone) {
        // Enqueue offline items
        for (final item in _selectedItems) {
          await cache.addPendingMedia(
            PendingMediaItem(
              id: 'pending_media_${DateTime.now().microsecondsSinceEpoch}',
              filePath: item.file.path,
              fileName: item.name,
              title: title,
              description: _descriptionController.text.trim(),
              equipmentId: _selectedEquipment?.id,
              mediaType: item.mediaType,
              tags: ['machine_evidence', 'gallery_upload', item.mediaType],
              createdAt: DateTime.now(),
              status: 'pending',
            ),
          );
        }

        setState(() {
          _isUploading = false;
          _uploadProgress = 1.0;
          _successMessage = 'SAVED TO OFFLINE QUEUE // WILL SYNC ON RECONNECT';
        });

        Future.delayed(const Duration(milliseconds: 1400), () {
          if (mounted) Navigator.of(context).pop(true);
        });
        return;
      }

      // Online Upload
      final total = _selectedItems.length;
      for (int i = 0; i < total; i++) {
        final item = _selectedItems[i];
        final bytes = await item.file.readAsBytes();
        final itemTitle = total > 1 ? '$title (${i + 1}/$total)' : title;

        await mediaRepo.ingestMedia(
          fileName: item.name,
          bytes: bytes,
          title: itemTitle,
          description: _descriptionController.text.trim(),
          equipmentId: _selectedEquipment?.id,
          tags: ['machine_evidence', 'gallery_upload', item.mediaType],
          onSendProgress: (sent, fileTotal) {
            if (fileTotal > 0) {
              final fileFraction = sent / fileTotal;
              final overall = (i + fileFraction) / total;
              if (mounted) {
                setState(() {
                  _uploadProgress = overall.clamp(0.0, 0.98);
                });
              }
            }
          },
        );
      }

      setState(() {
        _isUploading = false;
        _uploadProgress = 1.0;
        _successMessage = 'MEDIA EVIDENCE INGESTED SUCCESSFULLY';
      });

      Future.delayed(const Duration(milliseconds: 1200), () {
        if (mounted) Navigator.of(context).pop(true);
      });
    } on Exception catch (e) {
      String msg = e.toString();
      try {
        final dynamic err = e;
        if (err.response?.data is Map<String, dynamic>) {
          msg = err.response.data['error']?['message']?.toString() ?? msg;
        }
      } catch (_) {}
      setState(() {
        _isUploading = false;
        _errorMessage = 'Upload failed: $msg';
      });
    } catch (e) {
      setState(() {
        _isUploading = false;
        _errorMessage = 'Upload failed: ${e.toString()}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final equipmentAsync = ref.watch(equipmentListProvider);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 16.0),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16.0)),
        border: Border(
          top: BorderSide(color: AppColors.border, width: 1.0),
        ),
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top Accent Indicator Bar
              Center(
                child: Container(
                  width: 48.0,
                  height: 4.0,
                  margin: const EdgeInsets.only(bottom: 12.0),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(2.0),
                  ),
                ),
              ),
              // Header
              Row(
                children: [
                  Container(
                    width: 32.0,
                    height: 32.0,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(6.0),
                      border: Border.all(color: AppColors.primary, width: 1.0),
                    ),
                    child: const Icon(
                      Icons.photo_library_rounded,
                      color: AppColors.primary,
                      size: 18.0,
                    ),
                  ),
                  const SizedBox(width: 10.0),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'UPLOAD MACHINE EVIDENCE',
                          style: AppTypography.headlineMd.copyWith(fontSize: 14.0),
                        ),
                        Text(
                          'GALLERY PHOTO & VIDEO INGESTION // EVIDENCE LOG',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.primary,
                            fontSize: 10.0,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    key: const Key('close_media_upload_modal'),
                    icon: const Icon(Icons.close_rounded, size: 20.0, color: AppColors.onSurfaceVariant),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 14.0),
              const Divider(color: AppColors.border, height: 1.0),
              const SizedBox(height: 14.0),

              // Pick Action Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      key: const Key('pick_photos_button'),
                      onPressed: _isUploading ? null : _pickPhotos,
                      icon: const Icon(Icons.add_photo_alternate_rounded, size: 18.0, color: AppColors.primary),
                      label: Text(
                        'SELECT PHOTOS',
                        style: AppTypography.labelUppercase.copyWith(fontSize: 11.0, color: AppColors.primary),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.primary, width: 1.0),
                        backgroundColor: AppColors.surfaceAlt,
                        padding: const EdgeInsets.symmetric(vertical: 12.0),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.0)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10.0),
                  Expanded(
                    child: OutlinedButton.icon(
                      key: const Key('pick_video_button'),
                      onPressed: _isUploading ? null : _pickVideo,
                      icon: const Icon(Icons.video_library_rounded, size: 18.0, color: AppColors.accentCategorical2),
                      label: Text(
                        'SELECT VIDEO',
                        style: AppTypography.labelUppercase.copyWith(
                          fontSize: 11.0,
                          color: AppColors.accentCategorical2,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.border, width: 1.0),
                        backgroundColor: AppColors.surfaceAlt,
                        padding: const EdgeInsets.symmetric(vertical: 12.0),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.0)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14.0),

              // Error Banner
              if (_errorMessage != null) ...[
                Container(
                  key: const Key('media_upload_error_banner'),
                  padding: const EdgeInsets.all(10.0),
                  decoration: BoxDecoration(
                    color: AppColors.error.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6.0),
                    border: Border.all(color: AppColors.error, width: 1.0),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 16.0),
                      const SizedBox(width: 8.0),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: AppTypography.caption.copyWith(color: AppColors.error),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12.0),
              ],

              // Success Banner
              if (_successMessage != null) ...[
                Container(
                  key: const Key('media_upload_success_banner'),
                  padding: const EdgeInsets.all(10.0),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6.0),
                    border: Border.all(color: AppColors.success, width: 1.0),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_outline_rounded, color: AppColors.success, size: 16.0),
                      const SizedBox(width: 8.0),
                      Expanded(
                        child: Text(
                          _successMessage!,
                          style: AppTypography.caption.copyWith(color: AppColors.success),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12.0),
              ],

              // Selected Items Preview List
              if (_selectedItems.isNotEmpty) ...[
                Text(
                  'SELECTED EVIDENCE ITEMS (${_selectedItems.length})',
                  style: AppTypography.labelUppercase.copyWith(fontSize: 10.5, color: AppColors.onSurfaceVariant),
                ),
                const SizedBox(height: 8.0),
                ...List.generate(_selectedItems.length, (index) {
                  final item = _selectedItems[index];
                  final isVideo = item.mediaType == 'video';
                  return Container(
                    key: Key('selected_media_card_$index'),
                    margin: const EdgeInsets.only(bottom: 8.0),
                    padding: const EdgeInsets.all(10.0),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(8.0),
                      border: Border.all(color: AppColors.border, width: 1.0),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 36.0,
                          height: 36.0,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceMuted,
                            borderRadius: BorderRadius.circular(6.0),
                          ),
                          child: Icon(
                            isVideo ? Icons.videocam_rounded : Icons.image_rounded,
                            size: 20.0,
                            color: isVideo ? AppColors.accentCategorical2 : AppColors.primary,
                          ),
                        ),
                        const SizedBox(width: 10.0),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.bodyMd.copyWith(fontSize: 12.0, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 2.0),
                              Text(
                                '${item.mimeType.toUpperCase()} // ${_formatFileSize(item.sizeBytes)}',
                                style: AppTypography.caption.copyWith(fontSize: 10.0),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          key: Key('remove_media_item_$index'),
                          icon: const Icon(Icons.close_rounded, size: 18.0, color: AppColors.onSurfaceVariant),
                          onPressed: _isUploading ? null : () => _removeItem(index),
                          tooltip: 'Remove',
                        ),
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 12.0),
              ] else ...[
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 24.0, horizontal: 16.0),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAlt.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(8.0),
                    border: Border.all(color: AppColors.border, width: 1.0),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.cloud_upload_outlined, size: 36.0, color: AppColors.onSurfaceVariant),
                      const SizedBox(height: 8.0),
                      Text(
                        'NO MEDIA SELECTED',
                        style: AppTypography.labelUppercase.copyWith(fontSize: 11.5),
                      ),
                      const SizedBox(height: 4.0),
                      Text(
                        'Select machine photographs (JPEG/PNG, max 15MB) or diagnostic video (MP4/MOV, max 100MB).',
                        textAlign: TextAlign.center,
                        style: AppTypography.caption.copyWith(fontSize: 10.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14.0),
              ],

              // Metadata: Title Input
              Text(
                'EVIDENCE TITLE',
                style: AppTypography.labelUppercase.copyWith(fontSize: 10.5, color: AppColors.onSurfaceVariant),
              ),
              const SizedBox(height: 6.0),
              TextField(
                key: const Key('media_title_input'),
                controller: _titleController,
                enabled: !_isUploading,
                style: AppTypography.bodyMd.copyWith(color: Colors.white, fontSize: 13.0),
                decoration: InputDecoration(
                  hintText: 'e.g. Slurry Pump Seal Leakage Inspection',
                  hintStyle: AppTypography.caption,
                  filled: true,
                  fillColor: AppColors.surfaceMuted,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8.0),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8.0),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8.0),
                    borderSide: const BorderSide(color: AppColors.primary),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
                ),
              ),
              const SizedBox(height: 12.0),

              // Metadata: Description / Observations Input
              Text(
                'OBSERVATIONS & DIAGNOSTIC NOTES (OPTIONAL)',
                style: AppTypography.labelUppercase.copyWith(fontSize: 10.5, color: AppColors.onSurfaceVariant),
              ),
              const SizedBox(height: 6.0),
              TextField(
                key: const Key('media_description_input'),
                controller: _descriptionController,
                enabled: !_isUploading,
                maxLines: 2,
                style: AppTypography.bodyMd.copyWith(color: Colors.white, fontSize: 13.0),
                decoration: InputDecoration(
                  hintText: 'Note vibration, overheating, acoustic anomalies, or part wear...',
                  hintStyle: AppTypography.caption,
                  filled: true,
                  fillColor: AppColors.surfaceMuted,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8.0),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8.0),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8.0),
                    borderSide: const BorderSide(color: AppColors.primary),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
                ),
              ),
              const SizedBox(height: 12.0),

              // Equipment Association
              Text(
                'ASSOCIATED EQUIPMENT',
                style: AppTypography.labelUppercase.copyWith(fontSize: 10.5, color: AppColors.onSurfaceVariant),
              ),
              const SizedBox(height: 6.0),
              equipmentAsync.when(
                data: (equipmentList) {
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12.0),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceMuted,
                      borderRadius: BorderRadius.circular(8.0),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String?>(
                        key: const Key('media_equipment_dropdown'),
                        isExpanded: true,
                        dropdownColor: AppColors.surface,
                        value: _selectedEquipment?.id,
                        hint: Text(
                          'No specific machine (General)',
                          style: AppTypography.caption,
                        ),
                        items: [
                          DropdownMenuItem<String?>(
                            value: null,
                            child: Text(
                              'NO EQUIPMENT SPECIFIED',
                              style: AppTypography.bodyMd.copyWith(fontSize: 12.0),
                            ),
                          ),
                          ...equipmentList.map((eq) => DropdownMenuItem<String?>(
                                value: eq.id,
                                child: Text(
                                  eq.displayName.toUpperCase(),
                                  style: AppTypography.bodyMd.copyWith(fontSize: 12.0),
                                ),
                              )),
                        ],
                        onChanged: _isUploading
                            ? null
                            : (id) {
                                setState(() {
                                  if (id == null) {
                                    _selectedEquipment = null;
                                  } else {
                                    _selectedEquipment = equipmentList.firstWhere((e) => e.id == id);
                                  }
                                });
                              },
                      ),
                    ),
                  );
                },
                loading: () => const SizedBox(
                  height: 36.0,
                  child: Center(child: CircularProgressIndicator(strokeWidth: 2.0)),
                ),
                error: (e, s) => Text(
                  _selectedEquipment?.displayName ?? 'General Equipment',
                  style: AppTypography.caption,
                ),
              ),
              const SizedBox(height: 16.0),

              // Upload Progress Indicator
              if (_isUploading) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(4.0),
                  child: LinearProgressIndicator(
                    value: _uploadProgress,
                    backgroundColor: AppColors.surfaceAlt,
                    valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                    minHeight: 6.0,
                  ),
                ),
                const SizedBox(height: 8.0),
                Text(
                  'INGESTING EVIDENCE (${(_uploadProgress * 100).toInt()}%)...',
                  textAlign: TextAlign.center,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12.0),
              ],

              // Submit Button
              MachinedPrimaryButton(
                buttonKey: const Key('submit_media_upload_button'),
                label: _selectedItems.isEmpty
                    ? 'SELECT MEDIA TO SUBMIT'
                    : 'SUBMIT ${_selectedItems.length} EVIDENCE ITEM${_selectedItems.length > 1 ? 'S' : ''}',
                icon: Icons.cloud_upload_rounded,
                height: 44.0,
                onPressed: (_selectedItems.isNotEmpty && !_isUploading) ? _submitUpload : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
