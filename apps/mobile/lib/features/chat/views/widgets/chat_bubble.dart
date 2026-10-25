import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import '../../../../core/theme/app_colors.dart';
import '../../models/chat_message_model.dart';
import 'citation_card.dart';

class ChatBubble extends StatefulWidget {
  final ChatMessageModel message;

  const ChatBubble({
    super.key,
    required this.message,
  });

  @override
  State<ChatBubble> createState() => _ChatBubbleState();
}

class _ChatBubbleState extends State<ChatBubble> {
  bool _showCitations = false;

  void _copyToClipboard(BuildContext context) {
    Clipboard.setData(ClipboardData(text: widget.message.content));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Answer copied to clipboard'),
        duration: Duration(seconds: 2),
        backgroundColor: AppColors.surface3,
      ),
    );
  }

  Widget _buildWarningLevelBanner(String level) {
    Color borderColor;
    Color bgColor;
    IconData icon;
    String label;

    switch (level.toLowerCase()) {
      case 'critical':
        borderColor = AppColors.danger;
        bgColor = AppColors.danger.withValues(alpha: 0.15);
        icon = Icons.warning_amber_rounded;
        label = 'CRITICAL INDUSTRIAL SAFETY DIRECTIVE';
        break;
      case 'warning':
        borderColor = AppColors.warning;
        bgColor = AppColors.warning.withValues(alpha: 0.15);
        icon = Icons.report_problem_outlined;
        label = 'OPERATIONAL SAFETY WARNING';
        break;
      case 'caution':
        borderColor = AppColors.warning;
        bgColor = AppColors.warning.withValues(alpha: 0.10);
        icon = Icons.info_outline_rounded;
        label = 'PROCEDURAL CAUTION';
        break;
      default:
        return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12.0),
      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 8.0),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6.0),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: borderColor, size: 16.0),
          const SizedBox(width: 8.0),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: borderColor,
                fontSize: 11.0,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isUser = widget.message.isUser;

    if (isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          margin: const EdgeInsets.only(left: 48.0, bottom: 16.0),
          padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
          decoration: BoxDecoration(
            color: AppColors.surface3,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(14.0),
              topRight: Radius.circular(14.0),
              bottomLeft: Radius.circular(14.0),
              bottomRight: Radius.circular(4.0),
            ),
            border: Border.all(color: AppColors.hairlineStrong),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                widget.message.content,
                style: const TextStyle(
                  color: AppColors.ink,
                  fontSize: 14.0,
                  height: 1.45,
                ),
              ),
              if (widget.message.createdAt != null) ...[
                const SizedBox(height: 4.0),
                Text(
                  _formatTime(widget.message.createdAt!),
                  style: const TextStyle(
                    color: AppColors.inkSubtle,
                    fontSize: 10.0,
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    }

    // Assistant Message
    final hasCitations = widget.message.citations.isNotEmpty;
    final warningLevel = widget.message.warningLevel;
    final confidence = widget.message.confidenceScore;

    return Container(
      margin: const EdgeInsets.only(right: 24.0, bottom: 20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Copilot Avatar & Metadata Header
          Row(
            children: [
              Container(
                width: 28.0,
                height: 28.0,
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(8.0),
                  border: Border.all(color: AppColors.hairlineStrong),
                ),
                child: const Icon(
                  Icons.precision_manufacturing_rounded,
                  color: AppColors.primary,
                  size: 16.0,
                ),
              ),
              const SizedBox(width: 8.0),
              const Text(
                'MAN-U-AI Copilot',
                style: TextStyle(
                  color: AppColors.ink,
                  fontSize: 12.0,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 8.0),
              if (confidence != null && confidence > 0) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                  decoration: BoxDecoration(
                    color: AppColors.surface3,
                    borderRadius: BorderRadius.circular(4.0),
                    border: Border.all(color: AppColors.hairline),
                  ),
                  child: Text(
                    '${(confidence * 100).toInt()}% Grounded',
                    style: const TextStyle(
                      fontSize: 10.0,
                      fontWeight: FontWeight.w500,
                      color: AppColors.inkSubtle,
                    ),
                  ),
                ),
              ],
              const Spacer(),
              IconButton(
                key: const Key('copy_answer_button'),
                icon: const Icon(Icons.copy_rounded, size: 16.0, color: AppColors.inkSubtle),
                tooltip: 'Copy answer',
                onPressed: () => _copyToClipboard(context),
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          const SizedBox(height: 8.0),

          // Message Card
          Container(
            padding: const EdgeInsets.all(14.0),
            decoration: BoxDecoration(
              color: AppColors.surface1,
              borderRadius: BorderRadius.circular(12.0),
              border: Border.all(color: AppColors.hairline),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (warningLevel != null && warningLevel != 'none')
                  _buildWarningLevelBanner(warningLevel),

                MarkdownBody(
                  data: widget.message.content,
                  selectable: true,
                  styleSheet: MarkdownStyleSheet(
                    p: const TextStyle(
                      color: AppColors.ink,
                      fontSize: 13.5,
                      height: 1.5,
                    ),
                    code: const TextStyle(
                      color: AppColors.primaryHover,
                      backgroundColor: AppColors.canvas,
                      fontSize: 12.0,
                      fontFamily: 'monospace',
                    ),
                    codeblockDecoration: BoxDecoration(
                      color: AppColors.canvas,
                      borderRadius: BorderRadius.circular(8.0),
                      border: Border.all(color: AppColors.hairline),
                    ),
                    strong: const TextStyle(
                      color: AppColors.ink,
                      fontWeight: FontWeight.w700,
                    ),
                    h1: const TextStyle(
                      color: AppColors.ink,
                      fontSize: 18.0,
                      fontWeight: FontWeight.w700,
                    ),
                    h2: const TextStyle(
                      color: AppColors.ink,
                      fontSize: 16.0,
                      fontWeight: FontWeight.w700,
                    ),
                    h3: const TextStyle(
                      color: AppColors.ink,
                      fontSize: 14.0,
                      fontWeight: FontWeight.w600,
                    ),
                    listBullet: const TextStyle(color: AppColors.primary),
                  ),
                ),

                // Citations Section
                if (hasCitations) ...[
                  const SizedBox(height: 14.0),
                  const Divider(color: AppColors.hairline, height: 1.0),
                  const SizedBox(height: 8.0),
                  InkWell(
                    key: const Key('toggle_citations_button'),
                    borderRadius: BorderRadius.circular(6.0),
                    onTap: () {
                      setState(() {
                        _showCitations = !_showCitations;
                      });
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4.0),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.menu_book_rounded,
                            size: 15.0,
                            color: AppColors.primaryHover,
                          ),
                          const SizedBox(width: 6.0),
                          Text(
                            'Technical Citations (${widget.message.citations.length})',
                            style: const TextStyle(
                              fontSize: 12.0,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primaryHover,
                            ),
                          ),
                          const Spacer(),
                          Icon(
                            _showCitations
                                ? Icons.expand_less_rounded
                                : Icons.expand_more_rounded,
                            color: AppColors.inkSubtle,
                            size: 18.0,
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_showCitations) ...[
                    ...widget.message.citations.asMap().entries.map(
                          (entry) => CitationCard(
                            key: Key('citation_card_${entry.key}'),
                            index: entry.key,
                            citation: entry.value,
                          ),
                        ),
                  ],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final local = dt.toLocal();
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }
}
