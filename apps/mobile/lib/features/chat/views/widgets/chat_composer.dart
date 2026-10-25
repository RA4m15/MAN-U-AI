import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../equipment/models/equipment_model.dart';

class ChatComposer extends StatefulWidget {
  final bool isSending;
  final EquipmentModel? selectedEquipment;
  final String? boundEquipmentName;
  final ValueChanged<String> onSend;
  final VoidCallback? onPickEquipment;
  final VoidCallback? onClearEquipment;
  final VoidCallback? onUploadDocument;

  const ChatComposer({
    super.key,
    required this.isSending,
    this.selectedEquipment,
    this.boundEquipmentName,
    required this.onSend,
    this.onPickEquipment,
    this.onClearEquipment,
    this.onUploadDocument,
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
        color: AppColors.canvas,
        border: Border(top: BorderSide(color: AppColors.hairline)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Equipment Context Pill
            if (activeEquipmentName != null && activeEquipmentName.isNotEmpty) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 8.0),
                padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(6.0),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.precision_manufacturing_rounded,
                      size: 13.0,
                      color: AppColors.primaryHover,
                    ),
                    const SizedBox(width: 6.0),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 220.0),
                      child: Text(
                        activeEquipmentName,
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.ink,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (widget.boundEquipmentName == null && widget.onClearEquipment != null) ...[
                      const SizedBox(width: 4.0),
                      InkWell(
                        onTap: widget.onClearEquipment,
                        child: const Icon(
                          Icons.close_rounded,
                          size: 14.0,
                          color: AppColors.inkSubtle,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],

            // Input Row
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (widget.boundEquipmentName == null && widget.onPickEquipment != null) ...[
                  IconButton(
                    key: const Key('pick_equipment_button'),
                    icon: Icon(
                      Icons.tune_rounded,
                      color: widget.selectedEquipment != null
                          ? AppColors.primary
                          : AppColors.inkSubtle,
                      size: 20.0,
                    ),
                    tooltip: 'Set equipment context',
                    onPressed: widget.isSending ? null : widget.onPickEquipment,
                    visualDensity: VisualDensity.compact,
                  ),
                  const SizedBox(width: 4.0),
                ],
                if (widget.onUploadDocument != null) ...[
                  IconButton(
                    key: const Key('attach_document_button'),
                    icon: const Icon(
                      Icons.attach_file_rounded,
                      color: AppColors.inkSubtle,
                      size: 20.0,
                    ),
                    tooltip: 'Ingest technical document (PDF)',
                    onPressed: widget.isSending ? null : widget.onUploadDocument,
                    visualDensity: VisualDensity.compact,
                  ),
                  const SizedBox(width: 4.0),
                ],
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface1,
                      borderRadius: BorderRadius.circular(10.0),
                      border: Border.all(color: AppColors.hairlineStrong),
                    ),
                    child: TextField(
                      key: const Key('chat_message_input'),
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _handleSend(),
                      enabled: !widget.isSending,
                      style: const TextStyle(
                        color: AppColors.ink,
                        fontSize: 14.0,
                        height: 1.4,
                      ),
                      decoration: const InputDecoration(
                        hintText: 'Ask technical question, SOP, or symptom...',
                        hintStyle: TextStyle(
                          color: AppColors.inkSubtle,
                          fontSize: 13.5,
                        ),
                        contentPadding: EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8.0),
                Container(
                  width: 44.0,
                  height: 44.0,
                  decoration: BoxDecoration(
                    color: _canSend && !widget.isSending
                        ? AppColors.primary
                        : AppColors.surface2,
                    borderRadius: BorderRadius.circular(10.0),
                    border: Border.all(
                      color: _canSend && !widget.isSending
                          ? AppColors.primaryHover
                          : AppColors.hairline,
                    ),
                  ),
                  child: widget.isSending
                      ? const Center(
                          child: SizedBox(
                            width: 18.0,
                            height: 18.0,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.0,
                              valueColor: AlwaysStoppedAnimation<Color>(AppColors.ink),
                            ),
                          ),
                        )
                      : IconButton(
                          key: const Key('chat_send_button'),
                          icon: Icon(
                            Icons.arrow_upward_rounded,
                            size: 20.0,
                            color: _canSend ? AppColors.ink : AppColors.inkSubtle,
                          ),
                          onPressed: _canSend && !widget.isSending ? _handleSend : null,
                          padding: EdgeInsets.zero,
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
