import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/widgets/terminal_components.dart';
import '../../../equipment/models/equipment_model.dart';

/// MAN-U-AI Modern Light Chat Composer
/// Sleek floating card on light canvas with crisp squircle actions.
/// Layout: [ Camera ] [ Media Upload ] [ Message input ........ ] [ Send ]
class ChatComposer extends StatefulWidget {
  final bool isSending;
  final EquipmentModel? selectedEquipment;
  final String? boundEquipmentName;
  final ValueChanged<String> onSend;
  final VoidCallback? onOpenCamera;
  final VoidCallback? onUploadMedia;

  // Deprecated/legacy parameters preserved for compatibility
  final VoidCallback? onPickEquipment;
  final VoidCallback? onClearEquipment;
  final VoidCallback? onUploadDocument;
  final VoidCallback? onUploadPhoto;

  const ChatComposer({
    super.key,
    required this.isSending,
    this.selectedEquipment,
    this.boundEquipmentName,
    required this.onSend,
    this.onOpenCamera,
    this.onUploadMedia,
    this.onPickEquipment,
    this.onClearEquipment,
    this.onUploadDocument,
    this.onUploadPhoto,
  });

  @override
  State<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends State<ChatComposer> {
  final _controller = TextEditingController();
  bool _canSend = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_updateCanSend);
  }

  void _updateCanSend() {
    final hasText = _controller.text.trim().isNotEmpty;
    if (hasText != _canSend) {
      setState(() {
        _canSend = hasText;
      });
    }
  }

  void _handleSend() {
    if (!_canSend || widget.isSending) return;
    final text = _controller.text;
    _controller.clear();
    widget.onSend(text);
  }

  @override
  void dispose() {
    _controller.removeListener(_updateCanSend);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activeEquipmentName = widget.boundEquipmentName ?? widget.selectedEquipment?.displayName;
    final cameraAction = widget.onOpenCamera ?? widget.onUploadPhoto;
    final mediaUploadAction = widget.onUploadMedia ?? widget.onUploadDocument;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        border: const Border(top: BorderSide(color: AppColors.border, width: 1.0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10.0,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Active Equipment Context Tag
            if (activeEquipmentName != null && activeEquipmentName.isNotEmpty) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 8.0),
                padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.5),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(12.0),
                  border: Border.all(color: AppColors.border, width: 1.0),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const StatusDot(color: AppColors.primary, size: 8.0),
                    const SizedBox(width: 8.0),
                    Flexible(
                      child: Text(
                        activeEquipmentName.toUpperCase(),
                        style: AppTypography.caption.copyWith(
                          color: AppColors.onSurface,
                          fontWeight: FontWeight.w700,
                          fontSize: 10.5,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (widget.boundEquipmentName == null && widget.onClearEquipment != null) ...[
                      const SizedBox(width: 6.0),
                      InkWell(
                        onTap: widget.onClearEquipment,
                        child: const Icon(
                          Icons.close_rounded,
                          size: 14.0,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],

            // Input Bar Row: Exactly 4 elements:
            // [ Camera ] [ Media Upload ] [ Message input ........ ] [ Send ]
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // 1. Camera Button
                ButtonIconTile(
                  key: const Key('composer_camera_button'),
                  icon: Icons.camera_alt_rounded,
                  tooltip: 'Capture Machine Photo or Video',
                  size: 42.0,
                  iconColor: AppColors.onSurface,
                  onPressed: widget.isSending ? null : cameraAction,
                ),
                const SizedBox(width: 8.0),

                // 2. Media Upload Button
                ButtonIconTile(
                  key: const Key('composer_media_upload_button'),
                  icon: Icons.add_photo_alternate_rounded,
                  tooltip: 'Upload Photos & Videos',
                  size: 42.0,
                  iconColor: AppColors.onSurface,
                  onPressed: widget.isSending ? null : mediaUploadAction,
                ),
                const SizedBox(width: 8.0),

                // 3. Message Input Field (takes the majority of available width)
                Expanded(
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 42.0, maxHeight: 110.0),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceMuted,
                      borderRadius: BorderRadius.circular(16.0),
                      border: Border.all(color: AppColors.border, width: 1.0),
                    ),
                    child: TextField(
                      key: const Key('chat_message_input'),
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _handleSend(),
                      enabled: !widget.isSending,
                      style: AppTypography.bodyMd.copyWith(
                        fontWeight: FontWeight.w400,
                        color: AppColors.onSurface,
                        fontSize: 13.5,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Describe anomaly or prompt Copilot...',
                        hintStyle: AppTypography.bodyMd.copyWith(
                          color: AppColors.textMuted,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w400,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8.0),

                // 4. Primary Dark Send Button
                Container(
                  width: 42.0,
                  height: 42.0,
                  decoration: BoxDecoration(
                    color: _canSend && !widget.isSending
                        ? AppColors.primaryAction
                        : AppColors.surfaceMuted,
                    shape: BoxShape.circle,
                    boxShadow: _canSend && !widget.isSending
                        ? [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.15),
                              blurRadius: 8.0,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      key: const Key('chat_send_button'),
                      customBorder: const CircleBorder(),
                      onTap: _canSend && !widget.isSending ? _handleSend : null,
                      child: Center(
                        child: widget.isSending
                            ? const SizedBox(
                                width: 16.0,
                                height: 16.0,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.0,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : Icon(
                                Icons.arrow_upward_rounded,
                                size: 20.0,
                                color: _canSend && !widget.isSending
                                    ? Colors.white
                                    : AppColors.textMuted,
                              ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
