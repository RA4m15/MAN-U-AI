import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/widgets/terminal_components.dart';
import '../../../equipment/models/equipment_model.dart';

/// Terminal Cobalt Mobile Chat Composer
/// Inputs: surface-muted (#2C2C2C), 1px border (#333333), focus ring #0057FF.
class ChatComposer extends StatefulWidget {
  final bool isSending;
  final EquipmentModel? selectedEquipment;
  final String? boundEquipmentName;
  final ValueChanged<String> onSend;
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

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 10.0),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border, width: 1.0)),
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
                padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(4.0),
                  border: Border.all(color: AppColors.border, width: 1.0),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const StatusDot(color: AppColors.accentCategorical2, size: 8.0),
                    const SizedBox(width: 8.0),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 240.0),
                      child: Text(
                        activeEquipmentName.toUpperCase(),
                        style: AppTypography.caption.copyWith(
                          color: AppColors.onSurface,
                          fontWeight: FontWeight.w700,
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
                          size: 13.0,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],

            // Input Bar Row
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (widget.boundEquipmentName == null && widget.onPickEquipment != null) ...[
                  ButtonIconTile(
                    key: const Key('pick_equipment_button'),
                    icon: Icons.precision_manufacturing_rounded,
                    tooltip: 'Set equipment context',
                    size: 44.0,
                    iconColor: widget.selectedEquipment != null
                        ? AppColors.primary
                        : AppColors.onSurfaceVariant,
                    onPressed: widget.isSending ? null : widget.onPickEquipment,
                  ),
                  const SizedBox(width: 8.0),
                ],
                if (widget.onUploadDocument != null) ...[
                  ButtonIconTile(
                    key: const Key('attach_document_button'),
                    icon: Icons.attach_file_rounded,
                    tooltip: 'Upload technical document / manual',
                    size: 44.0,
                    iconColor: AppColors.onSurfaceVariant,
                    onPressed: widget.isSending ? null : widget.onUploadDocument,
                  ),
                  const SizedBox(width: 8.0),
                  ButtonIconTile(
                    key: const Key('attach_photo_button'),
                    icon: Icons.add_a_photo_outlined,
                    tooltip: 'Upload inspection photo / diagram',
                    size: 44.0,
                    iconColor: AppColors.onSurfaceVariant,
                    onPressed: widget.isSending ? null : (widget.onUploadPhoto ?? widget.onUploadDocument),
                  ),
                  const SizedBox(width: 8.0),
                ],
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surfaceMuted,
                      borderRadius: BorderRadius.circular(8.0), // rounded.lg
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
                        color: Colors.white,
                      ),
                      decoration: InputDecoration(
                        hintText: 'QUERY EQUIPMENT SOP OR FAULT CODE...',
                        hintStyle: AppTypography.labelUppercase.copyWith(
                          color: AppColors.onSurfaceVariant,
                          fontSize: 11.5,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8.0),

                // Cobalt Primary Machined Send Button
                Container(
                  width: 44.0,
                  height: 44.0,
                  decoration: BoxDecoration(
                    color: _canSend && !widget.isSending
                        ? AppColors.primary
                        : AppColors.surfaceAlt,
                    borderRadius: BorderRadius.circular(8.0), // rounded.lg
                    border: Border.all(
                      color: _canSend && !widget.isSending
                          ? const Color(0x800057FF)
                          : AppColors.border,
                      width: 1.0,
                    ),
                    boxShadow: _canSend && !widget.isSending
                        ? const [
                            BoxShadow(
                              color: Color(0x4D0057FF),
                              blurRadius: 15.0,
                              spreadRadius: 1.0,
                            ),
                          ]
                        : null,
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      key: const Key('chat_send_button'),
                      borderRadius: BorderRadius.circular(8.0),
                      onTap: _canSend && !widget.isSending ? _handleSend : null,
                      child: Center(
                        child: widget.isSending
                            ? const SizedBox(
                                width: 18.0,
                                height: 18.0,
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
                                    : AppColors.onSurfaceVariant,
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
