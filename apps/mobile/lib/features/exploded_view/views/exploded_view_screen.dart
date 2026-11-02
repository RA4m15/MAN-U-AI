import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../chat/controllers/chat_controller.dart';
import '../../chat/models/cad_component_selection_state.dart';
import '../../chat/services/cad_viewer_bridge_service.dart';
import '../../equipment/models/equipment_model.dart';
import 'widgets/component_tree_panel.dart';
import 'widgets/shared_cad_viewer.dart';

/// Dedicated Interactive Exploded View Screen for MAN-U-AI.
///
/// Enables plant engineers to directly explore 3D CAD machine assemblies,
/// advance through discrete explosion stages, select components, inspect
/// part hierarchies, and transition to AI chat with full machine/part context.
class ExplodedViewScreen extends ConsumerStatefulWidget {
  final EquipmentModel machine;

  const ExplodedViewScreen({
    super.key,
    required this.machine,
  });

  @override
  ConsumerState<ExplodedViewScreen> createState() => _ExplodedViewScreenState();
}

class _ExplodedViewScreenState extends ConsumerState<ExplodedViewScreen> {
  late final CadViewerBridgeService _bridgeService;
  bool _isFullscreen = false;

  @override
  void initState() {
    super.initState();
    _bridgeService = CadViewerBridgeService(
      machineId: widget.machine.id,
      initialStep: 1,
      totalSteps: 4,
    );
  }

  @override
  void dispose() {
    _bridgeService.dispose();
    super.dispose();
  }

  String _resolveModelUrl() {
    final ref = widget.machine.cadModel?.storageReference;
    if (ref != null && ref.isNotEmpty) {
      if (ref.startsWith('http://') || ref.startsWith('https://')) {
        return ref;
      }
      if (ref.startsWith('/')) {
        return ref;
      }
      return '/cad/models/$ref';
    }

    final mId = widget.machine.id.toLowerCase();
    if (mId.contains('cb-a61') || mId.contains('conveyor')) {
      return '/cad/models/conveyor_belt_a61.step';
    }
    return '/cad/models/slurry_pump_p102.step';
  }

  void _askAiAboutMachine() {
    final selection = _bridgeService.state;
    // Set selected equipment in chat controller
    ref.read(chatControllerProvider.notifier).setSelectedEquipment(widget.machine);

    // If a part is selected, inform chat controller with prompt suggestion or handoff
    if (selection.hasSelection && selection.selectedPartName != null) {
      final partName = selection.selectedPartName!;
      ref.read(chatControllerProvider.notifier).sendMessage('Explain SOP and specs for $partName');
    }

    // Navigate to Chat Screen
    if (mounted) {
      context.go('/home');
    }
  }

  void _askAiAboutComponent(String partName) {
    ref.read(chatControllerProvider.notifier).setSelectedEquipment(widget.machine);
    ref.read(chatControllerProvider.notifier).sendMessage('Explain specifications, lubrication and maintenance for $partName');
    if (mounted) {
      context.go('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAvailable = widget.machine.hasCadModel;
    final modelUrl = _resolveModelUrl();

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceAlt,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          key: const Key('exploded_viewer_back_button'),
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.onSurface),
          tooltip: 'Back to Explorer',
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/exploded-view');
            }
          },
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.machine.displayName.toUpperCase(),
              style: AppTypography.headlineMd.copyWith(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              'EQUIPMENT ID: ${widget.machine.id} • 3D EXPLORER',
              style: AppTypography.caption.copyWith(
                color: isAvailable ? AppColors.accentCyan : AppColors.accentCategorical5,
                fontWeight: FontWeight.w700,
                fontSize: 9.5,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        actions: [
          // CAD Status Pill
          Container(
            margin: const EdgeInsets.symmetric(vertical: 12.0),
            padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 2.0),
            decoration: BoxDecoration(
              color: (isAvailable ? AppColors.success : AppColors.accentCategorical5).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12.0),
              border: Border.all(
                color: isAvailable ? AppColors.success : AppColors.accentCategorical5,
                width: 0.8,
              ),
            ),
            child: Center(
              child: Text(
                isAvailable ? 'CAD ACTIVE' : 'CAD PENDING',
                style: TextStyle(
                  color: isAvailable ? AppColors.success : AppColors.accentCategorical5,
                  fontSize: 9.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8.0),
          // Fullscreen Toggle
          IconButton(
            key: const Key('exploded_viewer_fullscreen_button'),
            icon: Icon(
              _isFullscreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
              color: AppColors.onSurface,
            ),
            tooltip: _isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen',
            onPressed: () {
              setState(() {
                _isFullscreen = !_isFullscreen;
              });
            },
          ),
          const SizedBox(width: 4.0),
        ],
      ),
      body: SafeArea(
        child: ValueListenableBuilder<CadComponentSelectionState>(
          valueListenable: _bridgeService.stateNotifier,
          builder: (context, selectionState, _) {
            return Column(
              children: [
                // 3D CAD Viewport
                Expanded(
                  child: SharedCadViewer(
                    machineId: widget.machine.id,
                    machineName: widget.machine.name,
                    modelUrl: modelUrl,
                    isCadPending: !isAvailable,
                    referenceImage: widget.machine.referenceImage,
                    bridgeService: _bridgeService,
                    isFullscreen: _isFullscreen,
                    initialStep: 1,
                    totalSteps: 4,
                  ),
                ),

                // Component Tree & Hierarchy Panel (Hidden in Fullscreen)
                if (!_isFullscreen && isAvailable)
                  ComponentTreePanel(
                    machine: widget.machine,
                    selectionState: selectionState,
                    onSelectComponent: (partId) {
                      _bridgeService.selectComponent(partId);
                    },
                    onClearSelection: () {
                      _bridgeService.clearSelection();
                    },
                    onAskAiAboutComponent: _askAiAboutComponent,
                  ),

                // Bottom Action Bar: AI Assistance Handoff
                if (!_isFullscreen)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 10.0),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      border: const Border(
                        top: BorderSide(color: AppColors.border, width: 1.0),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 10.0,
                          offset: const Offset(0, -3),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            key: const Key('ask_ai_about_machine_button'),
                            icon: const Icon(Icons.auto_awesome_rounded, size: 18.0),
                            label: Text(
                              selectionState.hasSelection
                                  ? 'ASK MAN-U-AI ABOUT ${selectionState.selectedPartName?.toUpperCase() ?? "COMPONENT"}'
                                  : 'ASK MAN-U-AI ABOUT THIS MACHINE',
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 12.0, horizontal: 14.0),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12.0),
                              ),
                            ),
                            onPressed: _askAiAboutMachine,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
