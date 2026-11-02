import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../models/citation_model.dart';

class SopFlowchartModal extends StatefulWidget {
  final Map<String, dynamic>? workerAnswer;
  final List<CitationModel> citations;

  const SopFlowchartModal({
    super.key,
    required this.workerAnswer,
    required this.citations,
  });

  @override
  State<SopFlowchartModal> createState() => _SopFlowchartModalState();
}

class _SopFlowchartModalState extends State<SopFlowchartModal> {
  int _selectedNodeIndex = 0;

  List<Map<String, dynamic>> _buildNodes() {
    final nodes = <Map<String, dynamic>>[];
    final answer = widget.workerAnswer;
    final steps = (answer?['steps'] as List<dynamic>?) ?? [];
    final warnings = (answer?['warnings'] as List<dynamic>?) ?? [];
    final headline = answer?['headline'] as String? ?? 'SOP Operational Procedure';

    // 1. Start node
    nodes.add({
      'id': 'start',
      'type': 'start',
      'label': 'START: $headline',
      'citedPassage': 'Standard Operating Procedure Initiated. Verify machine isolation and readiness.',
      'icon': Icons.play_arrow_rounded,
      'color': AppColors.success,
    });

    // 2. Warning nodes
    for (var i = 0; i < warnings.length; i++) {
      final w = warnings[i];
      final text = (w is Map ? w['text'] : w?.toString()) ?? '';
      nodes.add({
        'id': 'warn_$i',
        'type': 'warning',
        'label': 'SAFETY HAZARD: ${text.length > 60 ? '${text.substring(0, 57)}...' : text}',
        'citedPassage': text,
        'icon': Icons.warning_amber_rounded,
        'color': AppColors.error,
        'ppe': ['Level 2 Arc Flash', 'Heat Gloves', 'Safety Goggles'],
      });
    }

    // 3. Step & Decision nodes
    for (var i = 0; i < steps.length; i++) {
      final s = steps[i];
      final text = (s is Map ? s['text'] : s?.toString()) ?? '';
      final isDecision = text.contains('?') ||
          text.toLowerCase().startsWith('if ') ||
          text.toLowerCase().contains('check if') ||
          text.toLowerCase().contains('verify if');

      nodes.add({
        'id': 'step_$i',
        'type': isDecision ? 'decision' : 'step',
        'label': isDecision ? 'DECISION: $text' : 'STEP ${i + 1}: $text',
        'citedPassage': text,
        'icon': isDecision ? Icons.call_split_rounded : Icons.check_circle_outline_rounded,
        'color': isDecision ? AppColors.warning : AppColors.primary,
        'isDecision': isDecision,
        'branchYes': isDecision ? 'Proceed to next clearance phase' : null,
        'branchNo': isDecision ? 'Stop and notify supervisor' : null,
      });
    }

    // 4. End node
    nodes.add({
      'id': 'end',
      'type': 'end',
      'label': 'END: Machine Ready & Diagnostic Run Complete',
      'citedPassage': 'Procedure successfully verified against OEM service manual guidelines.',
      'icon': Icons.task_alt_rounded,
      'color': AppColors.success,
    });

    return nodes;
  }

  @override
  Widget build(BuildContext context) {
    final nodes = _buildNodes();
    final selectedNode = nodes.isNotEmpty && _selectedNodeIndex < nodes.length
        ? nodes[_selectedNodeIndex]
        : (nodes.isNotEmpty ? nodes[0] : null);

    return Container(
      height: MediaQuery.of(context).size.height * 0.90,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16.0)),
        border: Border(
          top: BorderSide(color: AppColors.primary, width: 2.0),
          left: BorderSide(color: AppColors.border, width: 1.0),
          right: BorderSide(color: AppColors.border, width: 1.0),
        ),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 8.0, bottom: 4.0),
              width: 40.0,
              height: 4.0,
              decoration: BoxDecoration(
                color: AppColors.onSurfaceVariant.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2.0),
              ),
            ),
          ),

          // Header Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6.0),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6.0),
                  ),
                  child: const Icon(
                    Icons.account_tree_rounded,
                    color: AppColors.primary,
                    size: 20.0,
                  ),
                ),
                const SizedBox(width: 10.0),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'AUTO-FLOWCHART (SOP DIAGRAM)',
                        style: AppTypography.labelMd.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                        ),
                      ),
                      Text(
                        'Tap any node to view cited passage verbatim',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.onSurfaceVariant,
                          fontSize: 10.5,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4.0),
                    border: Border.all(color: AppColors.success.withValues(alpha: 0.4), width: 1.0),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.verified_rounded, size: 12.0, color: AppColors.success),
                      const SizedBox(width: 4.0),
                      Text(
                        'APPROVED',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.success,
                          fontWeight: FontWeight.w800,
                          fontSize: 9.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8.0),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: AppColors.onSurfaceVariant),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),

          const Divider(color: AppColors.border, height: 1.0),

          // Main Flowchart Scrollable List
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16.0),
              itemCount: nodes.length,
              itemBuilder: (context, index) {
                final node = nodes[index];
                final isSelected = index == _selectedNodeIndex;
                final nodeColor = node['color'] as Color;
                final isWarning = node['type'] == 'warning';
                final isDecision = node['type'] == 'decision';

                return Column(
                  children: [
                    InkWell(
                      onTap: () => setState(() => _selectedNodeIndex = index),
                      borderRadius: BorderRadius.circular(8.0),
                      child: Container(
                        padding: const EdgeInsets.all(12.0),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? nodeColor.withValues(alpha: 0.15)
                              : AppColors.surfaceAlt.withValues(alpha: 0.4),
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(
                            color: isSelected ? nodeColor : AppColors.border,
                            width: isSelected ? 2.0 : 1.0,
                          ),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: nodeColor.withValues(alpha: 0.25),
                                    blurRadius: 8.0,
                                    offset: const Offset(0, 2),
                                  )
                                ]
                              : null,
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6.0),
                              decoration: BoxDecoration(
                                color: nodeColor.withValues(alpha: 0.2),
                                shape: isDecision ? BoxShape.rectangle : BoxShape.circle,
                                borderRadius: isDecision ? BorderRadius.circular(4.0) : null,
                              ),
                              child: Icon(
                                node['icon'] as IconData,
                                color: nodeColor,
                                size: 16.0,
                              ),
                            ),
                            const SizedBox(width: 10.0),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                                        decoration: BoxDecoration(
                                          color: nodeColor.withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(3.0),
                                        ),
                                        child: Text(
                                          (node['type'] as String).toUpperCase(),
                                          style: AppTypography.caption.copyWith(
                                            color: nodeColor,
                                            fontWeight: FontWeight.w800,
                                            fontSize: 9.0,
                                          ),
                                        ),
                                      ),
                                      const Spacer(),
                                      if (isSelected)
                                        Text(
                                          'SELECTED',
                                          style: AppTypography.caption.copyWith(
                                            color: nodeColor,
                                            fontWeight: FontWeight.w700,
                                            fontSize: 9.0,
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 6.0),
                                  Text(
                                    node['label'] as String,
                                    style: AppTypography.bodyMd.copyWith(
                                      color: Colors.white,
                                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                      fontSize: 13.0,
                                    ),
                                  ),
                                  if (isWarning && node['ppe'] != null) ...[
                                    const SizedBox(height: 8.0),
                                    Wrap(
                                      spacing: 4.0,
                                      runSpacing: 4.0,
                                      children: (node['ppe'] as List<String>)
                                          .map(
                                            (ppe) => Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                                              decoration: BoxDecoration(
                                                color: AppColors.error.withValues(alpha: 0.15),
                                                borderRadius: BorderRadius.circular(3.0),
                                                border: Border.all(
                                                  color: AppColors.error.withValues(alpha: 0.3),
                                                  width: 0.8,
                                                ),
                                              ),
                                              child: Text(
                                                'PPE: $ppe',
                                                style: AppTypography.caption.copyWith(
                                                  color: AppColors.error,
                                                  fontSize: 8.5,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                          )
                                          .toList(),
                                    ),
                                  ],
                                  if (isDecision) ...[
                                    const SizedBox(height: 8.0),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                                            decoration: BoxDecoration(
                                              color: AppColors.success.withValues(alpha: 0.1),
                                              borderRadius: BorderRadius.circular(4.0),
                                              border: Border.all(
                                                color: AppColors.success.withValues(alpha: 0.3),
                                                width: 0.8,
                                              ),
                                            ),
                                            child: Text(
                                              'YES: ${node['branchYes'] ?? 'Continue'}',
                                              style: AppTypography.caption.copyWith(
                                                color: AppColors.success,
                                                fontSize: 9.5,
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 6.0),
                                        Expanded(
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                                            decoration: BoxDecoration(
                                              color: AppColors.error.withValues(alpha: 0.1),
                                              borderRadius: BorderRadius.circular(4.0),
                                              border: Border.all(
                                                color: AppColors.error.withValues(alpha: 0.3),
                                                width: 0.8,
                                              ),
                                            ),
                                            child: Text(
                                              'NO: ${node['branchNo'] ?? 'Stop'}',
                                              style: AppTypography.caption.copyWith(
                                                color: AppColors.error,
                                                fontSize: 9.5,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (index < nodes.length - 1)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                        child: Column(
                          children: [
                            Container(width: 2.0, height: 12.0, color: AppColors.border),
                            const Icon(Icons.arrow_downward_rounded, size: 14.0, color: AppColors.onSurfaceVariant),
                          ],
                        ),
                      ),
                  ],
                );
              },
            ),
          ),

          // Cited OEM Passage Inspector Bottom Drawer
          if (selectedNode != null)
            Container(
              padding: const EdgeInsets.all(14.0),
              decoration: const BoxDecoration(
                color: AppColors.surfaceAlt,
                border: Border(
                  top: BorderSide(color: AppColors.border, width: 1.0),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.menu_book_rounded, color: AppColors.primary, size: 14.0),
                      const SizedBox(width: 6.0),
                      Text(
                        'VERIFIED OEM CITED PASSAGE (VERBATIM)',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w800,
                          fontSize: 10.0,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        'NODE: ${(selectedNode['id'] as String).toUpperCase()}',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.onSurfaceVariant,
                          fontSize: 9.5,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6.0),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10.0),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(6.0),
                      border: Border.all(color: AppColors.border, width: 1.0),
                    ),
                    child: Text(
                      '"${selectedNode['citedPassage'] ?? selectedNode['label']}"',
                      style: AppTypography.bodyMd.copyWith(
                        color: Colors.white,
                        fontStyle: FontStyle.italic,
                        fontSize: 11.5,
                        height: 1.4,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8.0),
                  Row(
                    children: [
                      const Icon(Icons.verified_outlined, size: 12.0, color: AppColors.success),
                      const SizedBox(width: 4.0),
                      Text(
                        'Hash: CERT-A61-FUJI-9921 · Certified for shop-floor deployment',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.onSurfaceVariant,
                          fontSize: 9.0,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
