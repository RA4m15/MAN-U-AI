import 'exploded_view_chat_message.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/widgets/terminal_components.dart';
import '../../models/chat_message_model.dart';
import '../../controllers/chat_controller.dart';
import '../../../tickets/repositories/ticket_repository.dart';
import '../../../diagram/views/interactive_diagram_viewer_screen.dart';
import 'citation_card.dart';
import 'step_to_source_modal.dart';
import 'sop_flowchart_modal.dart';
import 'safety_preconditions_card.dart';

/// Terminal Cobalt Mobile Chat Bubble
/// Industrial. Instrumented. Operational.
class ChatBubble extends ConsumerStatefulWidget {
  final ChatMessageModel message;
  final void Function(String prompt)? onSendMessage;

  const ChatBubble({
    super.key,
    required this.message,
    this.onSendMessage,
  });

  @override
  ConsumerState<ChatBubble> createState() => _ChatBubbleState();
}

class _ChatBubbleState extends ConsumerState<ChatBubble> {
  bool _showCitations = false;
  bool _isTicketSubmitting = false;
  bool _isTicketSubmitted = false;

  void _copyToClipboard(BuildContext context) {
    Clipboard.setData(ClipboardData(text: widget.message.content));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'ANSWER COPIED TO CLIPBOARD',
          style: AppTypography.caption.copyWith(color: Colors.white),
        ),
        duration: const Duration(seconds: 2),
        backgroundColor: AppColors.surfaceAlt,
      ),
    );
  }

  Future<void> _handleRequestDocumentation() async {
    final ticketInfo = widget.message.suggestedTicket;
    if (ticketInfo == null || _isTicketSubmitted) return;

    setState(() => _isTicketSubmitting = true);

    try {
      final repo = ref.read(ticketRepositoryProvider);
      final ticket = await repo.createTicket(
        userQuery: ticketInfo.query,
        equipmentId: ticketInfo.equipmentId,
        searchContext: ticketInfo.reason,
      );

      if (mounted) {
        setState(() {
          _isTicketSubmitting = false;
          _isTicketSubmitted = true;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'DOCUMENTATION TICKET ${ticket.ticketNumber} CREATED // PLANT ENGINEERING NOTIFIED',
              style: AppTypography.caption.copyWith(color: AppColors.success),
            ),
            backgroundColor: AppColors.surfaceAlt,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isTicketSubmitting = false);
      }
    }
  }

  Widget _buildWarningLevelBanner(String level) {
    Color barColor;
    String label;

    switch (level.toLowerCase()) {
      case 'critical':
        barColor = AppColors.error;
        label = 'CRITICAL INDUSTRIAL SAFETY DIRECTIVE';
        break;
      case 'warning':
        barColor = AppColors.warning;
        label = 'OPERATIONAL SAFETY WARNING';
        break;
      case 'caution':
        barColor = AppColors.warning;
        label = 'SAFETY CAUTION ADVISORY';
        break;
      default:
        return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12.0),
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
      decoration: BoxDecoration(
        color: barColor.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(4.0),
        border: Border.all(color: barColor.withValues(alpha: 0.20), width: 1.0),
      ),
      child: Row(
        children: [
          Container(
            width: 4.0,
            height: 16.0,
            decoration: BoxDecoration(
              color: barColor,
              borderRadius: BorderRadius.circular(2.0),
            ),
          ),
          const SizedBox(width: 8.0),
          Expanded(
            child: Text(
              label,
              style: AppTypography.caption.copyWith(
                color: barColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExplodedDiagramCard(BuildContext context) {
    const diagramsList = [
      {
        'id': 'FIG-CONVEYOR-BELT-A61',
        'title': 'Conveyor Belt A61',
        'subtitle': 'Bulk Transport & Optical Inspection',
        'badge': '3D SIMREADY',
        'pins': '7 PINS',
        'image': 'assets/images/conveyor_belt_a61.png',
        'networkUrl': 'http://localhost:4000/static/diagrams/conveyor_belt_a61.png',
      },
      {
        'id': 'FIG-TURBOCOMPRESSOR-B01',
        'title': 'Turbocompressor B01',
        'subtitle': 'Titanium Impeller & Gas Turbine',
        'badge': '3D SIMREADY',
        'pins': '6 PINS',
        'image': 'assets/images/turbocompressor_b01.png',
        'networkUrl': 'http://localhost:4000/static/diagrams/turbocompressor_b01.png',
      },
      {
        'id': 'FIG-P102-EXPLODED',
        'title': 'Slurry Pump P-102',
        'subtitle': 'Centrifugal Power & Wet End',
        'badge': 'CAD SCHEMATIC',
        'pins': '6 PINS',
        'image': null,
        'networkUrl': null,
      },
    ];

    const partsList = [
      {'code': '01', 'name': 'Drive Motor & Gearbox', 'query': 'What is the torque spec and maintenance procedure for the Conveyor Belt A61 drive motor and gearbox?'},
      {'code': '02', 'name': 'Idler Rollers (x36)', 'query': 'How are the 36 idler rollers inspected and aligned on Conveyor Belt A61?'},
      {'code': '03', 'name': 'Vulcanized Belt', 'query': 'What is the replacement and tensioning procedure for the vulcanized conveyor belt?'},
      {'code': '04', 'name': 'Optical Scanner', 'query': 'What are the cleaning and calibration steps for the optical inspection scanner?'},
      {'code': '05', 'name': 'E-Stop Console', 'query': 'Where is the emergency stop located and what are the recovery steps after E-Stop engagement?'},
      {'code': '06', 'name': 'Turbocompressor B01', 'query': 'What is the inspection procedure for the Turbocompressor B01 titanium impeller?'},
      {'code': '07', 'name': 'Auto Tensioner', 'query': 'What is the operating pressure range for the pneumatic belt tensioner?'},
      {'code': '08', 'name': 'DRYPIX Jam 221', 'query': 'How do I clear error code 221 or 223 film jam in the sheet-feeder on the Fuji DRYPIX Smart?'},
      {'code': '09', 'name': 'Thermal Jam 230', 'query': 'What is the procedure for clearing error 230 film jam in the thermal development unit of the DRYPIX 6000?'},
      {'code': '10', 'name': 'Laser Life (213/214)', 'query': 'What does error code 213 and 214 mean on the Fuji DRYPIX Smart and how is the 659nm laser serviced?'},
      {'code': '11', 'name': 'Density Calib (U-1)', 'query': 'How do I run automatic film density calibration U-1 on the Fuji DRYPIX Smart imager?'},
    ];

    return Container(
      margin: const EdgeInsets.only(top: 14.0),
      padding: const EdgeInsets.all(14.0),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(16.0),
        border: Border.all(color: AppColors.border, width: 1.0),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 4.0,
                height: 16.0,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(2.0),
                ),
              ),
              const SizedBox(width: 8.0),
              Expanded(
                child: Text(
                  'EXPLODED 3D DIAGRAMS & SIMULATIONS',
                  style: AppTypography.labelMd.copyWith(
                    color: AppColors.onSurface,
                    fontSize: 11.0,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              const BadgePill(
                label: 'MULTIPLE 3D ASSETS',
                color: AppColors.accentCategorical5,
              ),
            ],
          ),
          const SizedBox(height: 10.0),

          // Horizontal Scroll Section for Multiple Diagrams
          SizedBox(
            height: 150.0,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: diagramsList.length,
              separatorBuilder: (context, index) => const SizedBox(width: 10.0),
              itemBuilder: (context, idx) {
                final d = diagramsList[idx];
                final isTurbocompressor = d['id'] == 'FIG-TURBOCOMPRESSOR-B01';

                return GestureDetector(
                  key: Key('diagram_preview_tap_target_${d['id']}'),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => InteractiveDiagramViewerScreen(
                          figureId: d['id']!,
                          title: '${d['title']} Exploded Assembly',
                          onAskAboutPart: widget.onSendMessage,
                        ),
                      ),
                    );
                  },
                  child: Container(
                    width: 230.0,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(14.0),
                      border: Border.all(color: AppColors.border, width: 1.0),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.03),
                          blurRadius: 6.0,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Stack(
                      children: [
                        Center(
                          child: d['image'] != null
                              ? Image.asset(
                                  d['image']!,
                                  height: 120.0,
                                  fit: BoxFit.contain,
                                  errorBuilder: (context, error, stackTrace) => Image.network(
                                    d['networkUrl']!,
                                    height: 120.0,
                                    fit: BoxFit.contain,
                                    errorBuilder: (context, error2, stackTrace2) => Icon(
                                      isTurbocompressor
                                          ? Icons.cyclone_rounded
                                          : Icons.precision_manufacturing_rounded,
                                      color: AppColors.onSurfaceVariant,
                                      size: 32.0,
                                    ),
                                  ),
                                )
                              : const Icon(
                                  Icons.settings_input_composite_rounded,
                                  color: AppColors.primary,
                                  size: 40.0,
                                ),
                        ),
                        // Top Label
                        Positioned(
                          top: 8.0,
                          left: 8.0,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 3.0),
                            decoration: BoxDecoration(
                              color: AppColors.surface.withValues(alpha: 0.85),
                              borderRadius: BorderRadius.circular(3.0),
                              border: Border.all(color: AppColors.border, width: 1.0),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const StatusDot(color: AppColors.primary, size: 6.0),
                                const SizedBox(width: 5.0),
                                Text(
                                  d['title']!.toUpperCase(),
                                  style: AppTypography.caption.copyWith(
                                    fontSize: 9.0,
                                    color: AppColors.onSurface,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        // Bottom Badge
                        Positioned(
                          bottom: 8.0,
                          right: 8.0,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 3.0),
                            decoration: BoxDecoration(
                              color: AppColors.surface.withValues(alpha: 0.90),
                              borderRadius: BorderRadius.circular(4.0),
                              border: Border.all(color: AppColors.primary.withValues(alpha: 0.4), width: 1.0),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.touch_app_rounded, size: 11.0, color: AppColors.primary),
                                const SizedBox(width: 4.0),
                                Text(
                                  d['pins']!,
                                  style: AppTypography.caption.copyWith(
                                    fontSize: 9.0,
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 10.0),
          // Parts chips heading
          Row(
            children: [
              Text(
                'COMPONENTS & PARTS LIST (TAP TO QUERY)',
                style: AppTypography.caption.copyWith(
                  color: AppColors.onSurfaceVariant,
                  fontSize: 10.0,
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6.0),
          // Parts chips
          Wrap(
            spacing: 6.0,
            runSpacing: 6.0,
            children: partsList.map((part) {
              return InkWell(
                key: Key('part_chip_${part['code']}'),
                onTap: () {
                  if (widget.onSendMessage != null) {
                    widget.onSendMessage!(part['query']!);
                  }
                },
                borderRadius: BorderRadius.circular(4.0),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAlt,
                    borderRadius: BorderRadius.circular(4.0),
                    border: Border.all(color: AppColors.border, width: 1.0),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        part['code']!,
                        style: AppTypography.caption.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                          fontSize: 10.0,
                        ),
                      ),
                      const SizedBox(width: 4.0),
                      Text(
                        part['name']!,
                        style: AppTypography.caption.copyWith(
                          color: AppColors.onSurface,
                          fontSize: 10.5,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 10.0),
          // Machined button to open interactive exploded viewer
          MachinedPrimaryButton(
            buttonKey: const Key('open_exploded_diagram_button'),
            label: 'Open Interactive Exploded Diagram',
            icon: Icons.layers_rounded,
            height: 40.0,
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => InteractiveDiagramViewerScreen(
                    figureId: 'FIG-CONVEYOR-BELT-A61',
                    title: 'Conveyor Belt A61 Exploded Assembly',
                    onAskAboutPart: widget.onSendMessage,
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isUser = widget.message.isUser;
    final citations = widget.message.citations;
    final confidence = widget.message.confidenceScore;
    final warningLevel = widget.message.warningLevel;
    final safetyPreconditions = widget.message.safetyPreconditions;
    final ticketInfo = widget.message.suggestedTicket;
    final hasTicketSuggestion = ticketInfo != null;
    final expandedTerms = widget.message.expandedTerms;

    if (isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          margin: const EdgeInsets.only(top: 8.0, bottom: 8.0, left: 48.0),
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
          decoration: BoxDecoration(
            color: AppColors.primaryAction,
            borderRadius: BorderRadius.circular(18.0),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 8.0,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Flexible(
                child: Text(
                  widget.message.content,
                  style: AppTypography.bodyMd.copyWith(
                    fontWeight: FontWeight.w400,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Assistant Message Layout
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(top: 8.0, bottom: 12.0, right: 16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Copilot Header Telemetry
            Row(
              children: [
                const StatusDot(color: AppColors.success, size: 10.0),
                const SizedBox(width: 8.0),
                Text(
                  'MAN-U-AI Copilot',
                  style: AppTypography.labelMd.copyWith(
                    fontSize: 11.5,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(width: 8.0),
                if (confidence != null && confidence > 0)
                  BadgePill(
                    label: widget.message.isOfflineFallback
                        ? 'OFFLINE RETRIEVAL'
                        : '${(confidence * 100).toInt()}% Grounded',
                    color: widget.message.isOfflineFallback
                        ? AppColors.warning
                        : AppColors.primary,
                  ),
                if (widget.message.machineContext != null && widget.message.machineContext!['selectedPartName'] != null) ...[
                  const SizedBox(width: 6.0),
                  BadgePill(
                    key: const Key('bubble_component_badge'),
                    label: widget.message.machineContext!['selectedPartName'].toString().toUpperCase(),
                    color: AppColors.accentCategorical2,
                  ),
                ],
                const Spacer(),
                ButtonIconTile(
                  key: const Key('copy_answer_button'),
                  icon: Icons.copy_rounded,
                  size: 32.0,
                  tooltip: 'Copy Answer',
                  onPressed: () => _copyToClipboard(context),
                ),
              ],
            ),
            const SizedBox(height: 8.0),

            // Pinned Safety Preconditions Card (Pinned First)
            if (safetyPreconditions != null && safetyPreconditions.isNotEmpty)
              SafetyPreconditionsCard(preconditions: safetyPreconditions),

            // Plant Glossary Query Expansion indicator
            if (expandedTerms.isNotEmpty) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 8.0),
                padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 6.0),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(4.0),
                  border: Border.all(color: AppColors.border, width: 1.0),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 8.0,
                      height: 8.0,
                      decoration: const BoxDecoration(
                        color: AppColors.accentCategorical5, // Cyan
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8.0),
                    Expanded(
                      child: Text(
                        'PLANT GLOSSARY EXPANDED: ${expandedTerms.join(" • ")}'.toUpperCase(),
                        style: AppTypography.caption.copyWith(
                          color: AppColors.accentCategorical5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Message Body Card
            Container(
              padding: const EdgeInsets.all(18.0),
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(20.0),
                border: Border.all(color: AppColors.border, width: 1.0),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 10.0,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (warningLevel != null && warningLevel != 'none')
                    _buildWarningLevelBanner(warningLevel),

                  if (widget.message.isExplodedView && widget.message.explodedView != null)
                    ExplodedViewChatMessage(
                      key: Key('exploded_view_message_${widget.message.id ?? widget.message.explodedView!.machineId}'),
                      payload: widget.message.explodedView!,
                      onComponentSelected: (compState) {
                        ref.read(chatControllerProvider.notifier).setActiveComponentContext(compState);
                      },
                    ),

                  if (widget.message.content.trim().isNotEmpty)
                    MarkdownBody(
                      data: widget.message.content,
                      selectable: true,
                    styleSheet: MarkdownStyleSheet(
                      p: AppTypography.bodyMdRegular.copyWith(
                        color: AppColors.onSurface,
                        fontSize: 13.5,
                        height: 1.5,
                      ),
                      code: AppTypography.bodySm.copyWith(
                        color: AppColors.primary,
                        backgroundColor: AppColors.surfaceMuted,
                      ),
                      codeblockDecoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(4.0),
                        border: Border.all(color: AppColors.border, width: 1.0),
                      ),
                      strong: AppTypography.bodyMd.copyWith(
                        color: AppColors.onSurface,
                        fontWeight: FontWeight.w700,
                      ),
                      h1: AppTypography.headlineLg.copyWith(fontSize: 18.0),
                      h2: AppTypography.headlineMd.copyWith(fontSize: 16.0),
                      h3: AppTypography.headlineMd.copyWith(fontSize: 14.0),
                      listBullet: AppTypography.bodyMd.copyWith(color: AppColors.primary),
                    ),
                  ),

                  if (widget.message.workerAnswer != null) ...[
                  // Step-to-Source Fidelity Verification Button
                  const SizedBox(height: 10.0),
                  InkWell(
                    key: const Key('step_to_source_lines_button'),
                    onTap: () {
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => StepToSourceModal(
                          workerAnswer: widget.message.workerAnswer,
                          citations: citations,
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(6.0),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 8.0),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(6.0),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.35), width: 1.0),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.linear_scale_rounded, color: AppColors.primary, size: 16.0),
                          const SizedBox(width: 8.0),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'STEP-TO-SOURCE FIDELITY LINES',
                                  style: AppTypography.labelMd.copyWith(
                                    color: Colors.white,
                                    fontSize: 11.0,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                                Text(
                                  'Trace steps to OEM manual with matching numbers',
                                  style: AppTypography.caption.copyWith(
                                    color: AppColors.onSurfaceVariant,
                                    fontSize: 9.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const BadgePill(
                            label: 'VERIFIED',
                            color: AppColors.success,
                          ),
                          const SizedBox(width: 4.0),
                          const Icon(Icons.chevron_right_rounded, color: AppColors.primary, size: 18.0),
                        ],
                      ),
                    ),
                  ),

                  // SOP Auto-Flowchart Diagram Button
                  const SizedBox(height: 8.0),
                  InkWell(
                    key: const Key('sop_auto_flowchart_button'),
                    onTap: () {
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => SopFlowchartModal(
                          workerAnswer: widget.message.workerAnswer,
                          citations: citations,
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(6.0),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 8.0),
                      decoration: BoxDecoration(
                        color: AppColors.accentCategorical5.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(6.0),
                        border: Border.all(color: AppColors.accentCategorical5.withValues(alpha: 0.35), width: 1.0),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.account_tree_rounded, color: AppColors.accentCategorical5, size: 16.0),
                          const SizedBox(width: 8.0),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'SOP AUTO-FLOWCHART DIAGRAM',
                                  style: AppTypography.labelMd.copyWith(
                                    color: Colors.white,
                                    fontSize: 11.0,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                                Text(
                                  'Start, decisions & red warnings · Tap node for OEM citation',
                                  style: AppTypography.caption.copyWith(
                                    color: AppColors.onSurfaceVariant,
                                    fontSize: 9.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const BadgePill(
                            label: 'APPROVED',
                            color: AppColors.success,
                          ),
                          const SizedBox(width: 4.0),
                          const Icon(Icons.chevron_right_rounded, color: AppColors.accentCategorical5, size: 18.0),
                        ],
                      ),
                    ),
                  ),
                  ],

                  // Citations Drawer Section
                  if (citations.isNotEmpty) ...[
                    const SizedBox(height: 12.0),
                    const Divider(color: AppColors.border, height: 1.0),
                    const SizedBox(height: 8.0),
                    InkWell(
                      key: const Key('toggle_citations_button'),
                      onTap: () => setState(() => _showCitations = !_showCitations),
                      borderRadius: BorderRadius.circular(6.0),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                        child: Row(
                          children: [
                            BadgePill(
                              label: '${citations.length} VERIFIED CITATIONS',
                              color: AppColors.accentCategorical2,
                              icon: Icons.menu_book_rounded,
                            ),
                            const Spacer(),
                            Icon(
                              _showCitations
                                  ? Icons.expand_less_rounded
                                  : Icons.expand_more_rounded,
                              size: 18.0,
                              color: AppColors.onSurfaceVariant,
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (_showCitations) ...[
                      const SizedBox(height: 8.0),
                      ...citations.asMap().entries.map((entry) => CitationCard(
                            key: Key('citation_card_${entry.key}'),
                            citation: entry.value,
                            onAskAboutFigure: widget.onSendMessage,
                          )),
                    ],
                  ],

                  // SimReady Exploded Diagrams & Simulations Card (Multi-Asset Scroll)
                  _buildExplodedDiagramCard(context),

                  // Refusal-to-Fix Loop Card (One-Tap Request Documentation)
                  if (hasTicketSuggestion) ...[
                    const SizedBox(height: 16.0),
                    Container(
                      padding: const EdgeInsets.all(12.0),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(6.0),
                        border: Border.all(color: AppColors.border, width: 1.0),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 4.0,
                                height: 16.0,
                                decoration: BoxDecoration(
                                  color: AppColors.warning,
                                  borderRadius: BorderRadius.circular(2.0),
                                ),
                              ),
                              const SizedBox(width: 8.0),
                              Expanded(
                                child: Text(
                                  'DOCUMENTATION GAP DETECTED',
                                  style: AppTypography.labelMd.copyWith(
                                    color: AppColors.warning,
                                    fontSize: 11.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6.0),
                          Text(
                            ticketInfo.reason,
                            style: AppTypography.caption.copyWith(
                              color: AppColors.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: 12.0),
                          _isTicketSubmitted
                              ? Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10.0, vertical: 6.0),
                                  decoration: BoxDecoration(
                                    color: AppColors.success.withValues(alpha: 0.10),
                                    borderRadius: BorderRadius.circular(4.0),
                                    border: Border.all(
                                      color: AppColors.success.withValues(alpha: 0.20),
                                      width: 1.0,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(
                                        Icons.check_rounded,
                                        size: 14.0,
                                        color: AppColors.success,
                                      ),
                                      const SizedBox(width: 6.0),
                                      Text(
                                        'DOCUMENTATION REQUEST LOGGED',
                                        style: AppTypography.caption.copyWith(
                                          color: AppColors.success,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              : MachinedPrimaryButton(
                                  buttonKey: const Key('request_documentation_button'),
                                  label: 'Request Documentation From Owner',
                                  isLoading: _isTicketSubmitting,
                                  icon: Icons.assignment_late_rounded,
                                  height: 44.0,
                                  onPressed: _handleRequestDocumentation,
                                ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
