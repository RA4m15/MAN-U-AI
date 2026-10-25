import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/controllers/auth_controller.dart';
import '../../../auth/models/auth_state.dart';
import '../../../equipment/controllers/equipment_controller.dart';
import '../../../equipment/models/equipment_model.dart';
import '../../controllers/document_upload_controller.dart';

class DocumentUploadModal extends ConsumerStatefulWidget {
  final EquipmentModel? defaultEquipment;

  const DocumentUploadModal({
    super.key,
    this.defaultEquipment,
  });

  @override
  ConsumerState<DocumentUploadModal> createState() => _DocumentUploadModalState();
}

class _DocumentUploadModalState extends ConsumerState<DocumentUploadModal> {
  final _titleController = TextEditingController();
  final _revisionController = TextEditingController(text: 'Rev 1.0');
  EquipmentModel? _selectedEquipment;

  @override
  void initState() {
    super.initState();
    _selectedEquipment = widget.defaultEquipment;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _revisionController.dispose();
    super.dispose();
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(2)} MB';
  }

  void _handleUpload() {
    final uploadState = ref.read(documentUploadControllerProvider);
    final doc = uploadState.selectedDocument;
    if (doc == null || uploadState.isUploading) return;

    final title = _titleController.text.trim().isNotEmpty
        ? _titleController.text.trim()
        : doc.name.replaceAll(RegExp(r'\.pdf$', caseSensitive: false), '');

    final revision = _revisionController.text.trim().isNotEmpty
        ? _revisionController.text.trim()
        : 'Rev 1.0';

    ref.read(documentUploadControllerProvider.notifier).upload(
          title: title,
          revision: revision,
          equipmentId: _selectedEquipment?.id,
        );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final user = authState is Authenticated ? authState.user : null;
    final isPermitted = user?.role == 'admin' || user?.role == 'engineer';

    final uploadState = ref.watch(documentUploadControllerProvider);
    final equipmentAsync = ref.watch(equipmentListProvider);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 20.0),
      decoration: const BoxDecoration(
        color: AppColors.surface1,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16.0)),
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                children: [
                  Container(
                    width: 32.0,
                    height: 32.0,
                    decoration: BoxDecoration(
                      color: AppColors.surface2,
                      borderRadius: BorderRadius.circular(8.0),
                      border: Border.all(color: AppColors.hairlineStrong),
                    ),
                    child: const Icon(
                      Icons.upload_file_rounded,
                      color: AppColors.primary,
                      size: 18.0,
                    ),
                  ),
                  const SizedBox(width: 10.0),
                  const Text(
                    'Ingest Technical Document',
                    style: TextStyle(
                      fontSize: 15.0,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: AppColors.inkSubtle),
                    onPressed: () {
                      ref.read(documentUploadControllerProvider.notifier).clearSelection();
                      Navigator.of(context).pop();
                    },
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
              const SizedBox(height: 12.0),

              // Non-permitted role banner (Viewer role)
              if (!isPermitted) ...[
                Container(
                  padding: const EdgeInsets.all(14.0),
                  decoration: BoxDecoration(
                    color: AppColors.surface2,
                    borderRadius: BorderRadius.circular(8.0),
                    border: Border.all(color: AppColors.warning.withValues(alpha: 0.5)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.lock_outline_rounded, color: AppColors.warning, size: 18.0),
                          SizedBox(width: 8.0),
                          Text(
                            'Document Ingestion Restricted',
                            style: TextStyle(
                              color: AppColors.warning,
                              fontWeight: FontWeight.w700,
                              fontSize: 13.0,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8.0),
                      Text(
                        'Your account has ${user?.role.toUpperCase() ?? 'VIEWER'} permissions. Ingestion of facility SOPs and equipment manuals is restricted to Engineers and Administrators.',
                        style: const TextStyle(
                          color: AppColors.inkMuted,
                          fontSize: 12.0,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 14.0),
                      ElevatedButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text('Close'),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                // Permitted Role Form
                const Text(
                  'Upload PDF equipment manuals, blueprints, and SOPs (max 50MB) for background OCR and vector ingestion into the plant knowledge base.',
                  style: TextStyle(fontSize: 11.5, color: AppColors.inkSubtle, height: 1.4),
                ),
                const SizedBox(height: 16.0),

                // Error Banner
                if (uploadState.errorMessage != null) ...[
                  Container(
                    key: const Key('upload_error_banner'),
                    padding: const EdgeInsets.all(12.0),
                    margin: const EdgeInsets.only(bottom: 14.0),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8.0),
                      border: Border.all(color: AppColors.danger.withValues(alpha: 0.6)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.error_outline_rounded,
                            color: AppColors.danger, size: 16.0),
                        const SizedBox(width: 8.0),
                        Expanded(
                          child: Text(
                            uploadState.errorMessage!,
                            style: const TextStyle(
                              color: AppColors.ink,
                              fontSize: 12.0,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Success State
                if (uploadState.successResult != null) ...[
                  Container(
                    key: const Key('upload_success_banner'),
                    padding: const EdgeInsets.all(14.0),
                    margin: const EdgeInsets.only(bottom: 16.0),
                    decoration: BoxDecoration(
                      color: AppColors.brandSecure.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8.0),
                      border: Border.all(color: AppColors.brandSecure.withValues(alpha: 0.6)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.check_circle_rounded,
                                color: AppColors.brandSecure, size: 18.0),
                            const SizedBox(width: 8.0),
                            Text(
                              'Document Queued for Ingestion',
                              style: TextStyle(
                                color: AppColors.brandSecure,
                                fontWeight: FontWeight.w700,
                                fontSize: 13.0,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8.0),
                        Text(
                          '${uploadState.successResult!.title} (${uploadState.successResult!.revision}) was uploaded successfully. Background OCR and vector indexing have started.',
                          style: const TextStyle(color: AppColors.ink, fontSize: 12.0, height: 1.4),
                        ),
                        const SizedBox(height: 12.0),
                        ElevatedButton(
                          onPressed: () {
                            ref.read(documentUploadControllerProvider.notifier).clearSelection();
                            Navigator.of(context).pop();
                          },
                          child: const Text('Done'),
                        ),
                      ],
                    ),
                  ),
                ] else ...[
                  // File Selection Area
                  if (uploadState.selectedDocument == null) ...[
                    OutlinedButton.icon(
                      key: const Key('pick_pdf_button'),
                      icon: const Icon(Icons.picture_as_pdf_outlined, color: AppColors.primaryHover),
                      label: const Text('Select PDF Document'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16.0),
                        side: const BorderSide(color: AppColors.hairlineStrong),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.0)),
                      ),
                      onPressed: uploadState.isUploading
                          ? null
                          : () {
                              ref
                                  .read(documentUploadControllerProvider.notifier)
                                  .pickPdfFile();
                            },
                    ),
                  ] else ...[
                    // File Preview Card
                    Container(
                      key: const Key('selected_file_card'),
                      padding: const EdgeInsets.all(12.0),
                      decoration: BoxDecoration(
                        color: AppColors.surface2,
                        borderRadius: BorderRadius.circular(8.0),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.picture_as_pdf_rounded,
                              color: AppColors.primary, size: 28.0),
                          const SizedBox(width: 12.0),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  uploadState.selectedDocument!.name,
                                  style: const TextStyle(
                                    color: AppColors.ink,
                                    fontSize: 13.0,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2.0),
                                Text(
                                  _formatFileSize(uploadState.selectedDocument!.size),
                                  style: const TextStyle(
                                    color: AppColors.inkSubtle,
                                    fontSize: 11.0,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (!uploadState.isUploading) ...[
                            IconButton(
                              icon: const Icon(Icons.delete_outline_rounded,
                                  color: AppColors.danger, size: 18.0),
                              tooltip: 'Remove file',
                              onPressed: () {
                                ref
                                    .read(documentUploadControllerProvider.notifier)
                                    .clearSelection();
                              },
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 14.0),

                    // Optional Document Title
                    const Text('Document Title (Optional)',
                        style: TextStyle(fontSize: 11.5, color: AppColors.inkMuted)),
                    const SizedBox(height: 6.0),
                    TextFormField(
                      key: const Key('upload_title_input'),
                      controller: _titleController,
                      enabled: !uploadState.isUploading,
                      style: const TextStyle(color: AppColors.ink, fontSize: 13.0),
                      decoration: InputDecoration(
                        hintText: uploadState.selectedDocument!.name
                            .replaceAll(RegExp(r'\.pdf$', caseSensitive: false), ''),
                        hintStyle: const TextStyle(color: AppColors.inkSubtle, fontSize: 12.5),
                        contentPadding:
                            const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
                      ),
                    ),
                    const SizedBox(height: 12.0),

                    // Optional Revision
                    const Text('Document Revision',
                        style: TextStyle(fontSize: 11.5, color: AppColors.inkMuted)),
                    const SizedBox(height: 6.0),
                    TextFormField(
                      key: const Key('upload_revision_input'),
                      controller: _revisionController,
                      enabled: !uploadState.isUploading,
                      style: const TextStyle(color: AppColors.ink, fontSize: 13.0),
                      decoration: const InputDecoration(
                        hintText: 'e.g. Rev 2.1 or v1',
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
                      ),
                    ),
                    const SizedBox(height: 12.0),

                    // Optional Equipment Context Association
                    if (equipmentAsync.hasValue && equipmentAsync.value!.isNotEmpty) ...[
                      const Text('Link to Plant Equipment (Optional)',
                          style: TextStyle(fontSize: 11.5, color: AppColors.inkMuted)),
                      const SizedBox(height: 6.0),
                      DropdownButtonFormField<EquipmentModel?>(
                        initialValue: _selectedEquipment,
                        dropdownColor: AppColors.surface2,
                        style: const TextStyle(color: AppColors.ink, fontSize: 13.0),
                        decoration: const InputDecoration(
                          contentPadding:
                              EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                        ),
                        items: [
                          const DropdownMenuItem<EquipmentModel?>(
                            value: null,
                            child: Text('General Plant Standard (No equipment bound)'),
                          ),
                          ...equipmentAsync.value!.map(
                            (eq) => DropdownMenuItem<EquipmentModel?>(
                              value: eq,
                              child: Text(eq.displayName, maxLines: 1, overflow: TextOverflow.ellipsis),
                            ),
                          ),
                        ],
                        onChanged: uploadState.isUploading
                            ? null
                            : (val) {
                                setState(() {
                                  _selectedEquipment = val;
                                });
                              },
                      ),
                      const SizedBox(height: 16.0),
                    ],

                    // In-Flight Upload Progress
                    if (uploadState.isUploading) ...[
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Uploading PDF: ${(uploadState.uploadProgress * 100).toInt()}%',
                                style: const TextStyle(
                                  color: AppColors.primaryHover,
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const Spacer(),
                              TextButton(
                                onPressed: () {
                                  ref
                                      .read(documentUploadControllerProvider.notifier)
                                      .cancelUpload();
                                },
                                child: const Text(
                                  'Cancel',
                                  style: TextStyle(color: AppColors.danger, fontSize: 12.0),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4.0),
                          LinearProgressIndicator(
                            value: uploadState.uploadProgress,
                            backgroundColor: AppColors.surface3,
                            color: AppColors.primary,
                          ),
                          const SizedBox(height: 12.0),
                        ],
                      ),
                    ],

                    // Submit Upload Button
                    ElevatedButton(
                      key: const Key('submit_upload_button'),
                      onPressed: uploadState.isUploading ? null : _handleUpload,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14.0),
                      ),
                      child: uploadState.isUploading
                          ? const SizedBox(
                              width: 18.0,
                              height: 18.0,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.0,
                                valueColor: AlwaysStoppedAnimation<Color>(AppColors.ink),
                              ),
                            )
                          : const Text('Upload & Ingest Document'),
                    ),
                  ],
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}
