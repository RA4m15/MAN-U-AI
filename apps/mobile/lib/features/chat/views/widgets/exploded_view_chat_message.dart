import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../core/config/env_config.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../models/cad_component_selection_state.dart';
import '../../models/exploded_view_model.dart';
import '../../services/cad_viewer_bridge_service.dart';

/// Interactive Exploded-View 3D CAD Chat Widget for MAN-U-AI.
///
/// Embeds the standalone CAD 3D viewer directly inside chat messages.
/// Enables plant engineers to explore machine assembly structures,
/// advance through discrete explosion stages, inspect part hierarchy,
/// receive real-time component selection updates, and expand to fullscreen mode.
class ExplodedViewChatMessage extends StatefulWidget {
  final ExplodedViewModel payload;
  final VoidCallback? onExpandFullscreen;
  final CadViewerBridgeService? bridgeService;
  final ValueChanged<CadComponentSelectionState>? onComponentSelected;

  const ExplodedViewChatMessage({
    super.key,
    required this.payload,
    this.onExpandFullscreen,
    this.bridgeService,
    this.onComponentSelected,
  });

  @override
  State<ExplodedViewChatMessage> createState() => _ExplodedViewChatMessageState();
}

class _ExplodedViewChatMessageState extends State<ExplodedViewChatMessage>
    with AutomaticKeepAliveClientMixin {
  late final WebViewController? _controller;
  late final CadViewerBridgeService _bridgeService;
  bool _ownsBridgeService = false;

  bool _isLoading = true;
  bool _hasError = false;
  String? _errorMessage;
  bool _isCollapsed = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    if (widget.bridgeService != null) {
      _bridgeService = widget.bridgeService!;
      _ownsBridgeService = false;
    } else {
      _bridgeService = CadViewerBridgeService(
        machineId: widget.payload.machineId,
        initialStep: widget.payload.initialStep ?? 1,
        totalSteps: widget.payload.totalSteps ?? 4,
      );
      _ownsBridgeService = true;
    }
    _bridgeService.stateNotifier.addListener(_onStateNotifierChanged);
    _initWebViewController();
  }

  void _onStateNotifierChanged() {
    if (mounted) {
      widget.onComponentSelected?.call(_bridgeService.state);
    }
  }

  @override
  void dispose() {
    if (_ownsBridgeService) {
      _bridgeService.dispose();
    } else {
      _bridgeService.detachController();
    }
    _bridgeService.stateNotifier.removeListener(_onStateNotifierChanged);
    super.dispose();
  }

  bool get _isPlatformSupported {
    if (kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.android ||
        defaultTargetPlatform == TargetPlatform.iOS;
  }

  void _initWebViewController() {
    if (!_isPlatformSupported) {
      _isLoading = false;
      _controller = null;
      return;
    }

    try {
      final controller = WebViewController();
      controller.setJavaScriptMode(JavaScriptMode.unrestricted);

      controller.setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (NavigationRequest request) {
            if (!EnvConfig.isAllowedViewerOrigin(request.url)) {
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
          onPageStarted: (String url) {
            if (mounted) {
              setState(() {
                _isLoading = true;
                _hasError = false;
                _errorMessage = null;
              });
            }
          },
          onPageFinished: (String url) {
            if (mounted) {
              setState(() {
                _isLoading = false;
                _hasError = false;
              });
            }
          },
          onWebResourceError: (WebResourceError error) {
            if (mounted) {
              setState(() {
                _isLoading = false;
                _hasError = true;
                _errorMessage = error.description.isNotEmpty
                    ? error.description
                    : 'Failed to load 3D CAD rendering engine.';
              });
            }
          },
        ),
      );

      // JavaScript Channel for two-way host communication (Task 4)
      controller.addJavaScriptChannel(
        'FlutterCADBridge',
        onMessageReceived: (JavaScriptMessage message) {
          _bridgeService.handleInboundRawMessage(message.message);
        },
      );

      _controller = controller;
      _bridgeService.attachController(controller);
      _loadViewerUrl();
    } catch (e) {
      _controller = null;
      _isLoading = false;
      _hasError = true;
      _errorMessage = 'WebView initialization unavailable on this platform: $e';
    }
  }

  void _loadViewerUrl() {
    if (_controller == null) return;

    final modelUrl = widget.payload.modelUrl;
    if (!EnvConfig.isValidModelUrl(modelUrl)) {
      setState(() {
        _hasError = true;
        _errorMessage = 'Invalid or insecure model URL: $modelUrl';
        _isLoading = false;
      });
      return;
    }

    final fullViewerUrl = EnvConfig.buildCadViewerUrl(modelUrl);
    final uri = Uri.tryParse(fullViewerUrl);
    if (uri != null) {
      _controller.loadRequest(uri);
    } else {
      setState(() {
        _hasError = true;
        _errorMessage = 'Malformed CAD viewer URL.';
        _isLoading = false;
      });
    }
  }

  void _nextStage() {
    _bridgeService.nextStep();
  }

  void _prevStage() {
    _bridgeService.previousStep();
  }

  void _resetAssembly() {
    _bridgeService.resetExplosion();
  }

  void _retry() {
    setState(() {
      _isLoading = true;
      _hasError = false;
      _errorMessage = null;
    });
    if (_controller != null) {
      _loadViewerUrl();
    } else {
      _initWebViewController();
    }
  }

  void _openFullscreen(BuildContext context) {
    if (widget.onExpandFullscreen != null) {
      widget.onExpandFullscreen!();
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          backgroundColor: AppColors.surface,
          appBar: AppBar(
            backgroundColor: AppColors.surfaceAlt,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.close_rounded, color: AppColors.onSurface),
              onPressed: () => Navigator.of(context).pop(),
            ),
            title: Text(
              widget.payload.machineName.toUpperCase(),
              style: AppTypography.headlineMd.copyWith(fontSize: 14.0),
            ),
            actions: [
              IconButton(
                key: const Key('fullscreen_reset_button'),
                icon: const Icon(Icons.refresh_rounded, color: AppColors.onSurface),
                tooltip: 'Reset Assembly',
                onPressed: _resetAssembly,
              ),
            ],
          ),
          body: SafeArea(
            child: ValueListenableBuilder<CadComponentSelectionState>(
              valueListenable: _bridgeService.stateNotifier,
              builder: (context, selectionState, _) {
                return Column(
                  children: [
                    Expanded(
                      child: _buildViewport(context, isFullscreen: true),
                    ),
                    _buildControlsBar(context, selectionState),
                    if (selectionState.hasSelection)
                      _buildComponentInfoSection(context, selectionState),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildViewport(BuildContext context, {bool isFullscreen = false}) {
    if (_hasError) {
      return Container(
        key: const Key('cad_viewer_error_container'),
        padding: const EdgeInsets.all(20.0),
        alignment: Alignment.center,
        color: AppColors.surfaceMuted,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 36.0),
            const SizedBox(height: 10.0),
            Text(
              '3D CAD MODEL UNAVAILABLE',
              style: AppTypography.labelMd.copyWith(
                color: AppColors.error,
                fontWeight: FontWeight.w700,
                fontSize: 12.0,
              ),
            ),
            const SizedBox(height: 6.0),
            Text(
              _errorMessage ?? 'Unable to connect to CAD 3D Viewer module.',
              textAlign: TextAlign.center,
              style: AppTypography.caption.copyWith(color: AppColors.onSurfaceVariant),
            ),
            const SizedBox(height: 14.0),
            OutlinedButton.icon(
              key: const Key('cad_viewer_retry_button'),
              icon: const Icon(Icons.refresh_rounded, size: 16.0),
              label: const Text('Retry Connection'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              ),
              onPressed: _retry,
            ),
          ],
        ),
      );
    }

    Widget content;
    if (_controller != null && _isPlatformSupported) {
      content = WebViewWidget(
        key: const Key('cad_webview_widget'),
        controller: _controller,
        gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
          Factory<OneSequenceGestureRecognizer>(
            () => EagerGestureRecognizer(),
          ),
        },
      );
    } else {
      // Headless / Widget Test / Simulated Viewport Representation
      final currentStep = _bridgeService.state.currentStep;
      final totalSteps = _bridgeService.state.totalSteps;

      content = Container(
        key: const Key('simulated_cad_viewport'),
        color: const Color(0xFF1E2228), // Dark 3D canvas background
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Wireframe / Machine Simulation Grid
            CustomPaint(
              size: Size.infinite,
              painter: _GridBackgroundPainter(),
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.view_in_ar_rounded,
                  color: AppColors.accentCyan,
                  size: 48.0,
                ),
                const SizedBox(height: 10.0),
                Text(
                  widget.payload.machineName.toUpperCase(),
                  style: AppTypography.labelMd.copyWith(
                    color: Colors.white,
                    letterSpacing: 1.0,
                  ),
                ),
                const SizedBox(height: 4.0),
                Text(
                  'INTERACTIVE 3D CAD ENGINE // STAGE $currentStep OF $totalSteps',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.accentCyan,
                    fontSize: 10.0,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            Positioned(
              bottom: 12.0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(12.0),
                  border: Border.all(color: Colors.white24),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.touch_app_rounded, size: 12.0, color: Colors.white70),
                    const SizedBox(width: 4.0),
                    Text(
                      'Drag to Orbit • Pinch to Zoom',
                      style: AppTypography.caption.copyWith(
                        color: Colors.white70,
                        fontSize: 10.0,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Stack(
      children: [
        Positioned.fill(child: content),
        if (_isLoading)
          Container(
            key: const Key('cad_viewer_loading_indicator'),
            color: AppColors.surfaceAlt.withValues(alpha: 0.85),
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(
                  width: 28.0,
                  height: 28.0,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 12.0),
                Text(
                  'LOADING CAD MODEL & WASM KERNEL...',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildControlsBar(BuildContext context, CadComponentSelectionState state) {
    final currentStage = state.currentStep;
    final totalStages = state.totalSteps;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
      decoration: const BoxDecoration(
        color: AppColors.surfaceAlt,
        border: Border(top: BorderSide(color: AppColors.border, width: 1.0)),
      ),
      child: Row(
        children: [
          // Previous Step Button
          IconButton(
            key: const Key('cad_prev_stage_button'),
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 16.0),
            color: currentStage > 1 ? AppColors.primary : AppColors.textMuted,
            tooltip: 'Previous Stage',
            onPressed: currentStage > 1 ? _prevStage : null,
          ),

          // Current Stage Badge & Status
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'STAGE $currentStage OF $totalStages',
                  key: const Key('cad_stage_indicator'),
                  style: AppTypography.labelMd.copyWith(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 2.0),
                LinearProgressIndicator(
                  key: const Key('cad_stage_progress_bar'),
                  value: totalStages > 0 ? currentStage / totalStages : 0.0,
                  backgroundColor: AppColors.surfaceMuted,
                  color: AppColors.primary,
                  minHeight: 3.0,
                ),
              ],
            ),
          ),

          // Next Step Button
          IconButton(
            key: const Key('cad_next_stage_button'),
            icon: const Icon(Icons.arrow_forward_ios_rounded, size: 16.0),
            color: currentStage < totalStages ? AppColors.primary : AppColors.textMuted,
            tooltip: 'Next Stage',
            onPressed: currentStage < totalStages ? _nextStage : null,
          ),

          const SizedBox(width: 4.0),

          // Reset Assembly Button
          IconButton(
            key: const Key('cad_reset_stage_button'),
            icon: const Icon(Icons.refresh_rounded, size: 20.0),
            color: AppColors.onSurfaceVariant,
            tooltip: 'Reset to Assembled State',
            onPressed: _resetAssembly,
          ),
        ],
      ),
    );
  }

  Widget _buildComponentInfoSection(BuildContext context, CadComponentSelectionState state) {
    if (!state.hasSelection) return const SizedBox.shrink();

    return Container(
      key: const Key('cad_component_info_card'),
      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.05),
        border: const Border(
          top: BorderSide(color: AppColors.border, width: 1.0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(4.0),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.precision_manufacturing_rounded,
                  size: 13.0,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 6.0),
              Text(
                'SELECTED COMPONENT',
                style: AppTypography.caption.copyWith(
                  fontSize: 10.0,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: AppColors.primary,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                decoration: BoxDecoration(
                  color: AppColors.accentCategorical2.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4.0),
                ),
                child: Text(
                  'STAGE ${state.currentStep} OF ${state.totalSteps}',
                  key: const Key('cad_selected_component_stage'),
                  style: AppTypography.caption.copyWith(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.accentCategorical2,
                  ),
                ),
              ),
              const SizedBox(width: 4.0),
              IconButton(
                key: const Key('cad_clear_selection_button'),
                icon: const Icon(Icons.close_rounded, size: 16.0),
                color: AppColors.onSurfaceVariant,
                tooltip: 'Clear selection',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                onPressed: () => _bridgeService.clearSelection(),
              ),
            ],
          ),
          const SizedBox(height: 6.0),
          Text(
            state.displayName,
            key: const Key('cad_selected_component_name'),
            style: AppTypography.labelMd.copyWith(
              fontSize: 13.0,
              fontWeight: FontWeight.w700,
              color: AppColors.onSurface,
            ),
          ),
          const SizedBox(height: 2.0),
          Row(
            children: [
              Text(
                'ID: ',
                style: AppTypography.caption.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.onSurfaceVariant,
                  fontSize: 11.0,
                ),
              ),
              Expanded(
                child: Text(
                  state.selectedPartId ?? 'N/A',
                  key: const Key('cad_selected_component_id'),
                  style: AppTypography.caption.copyWith(
                    fontFamily: 'monospace',
                    fontSize: 11.0,
                    color: AppColors.onSurface,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          if (state.parentId != null && state.parentId!.isNotEmpty) ...[
            const SizedBox(height: 2.0),
            Row(
              children: [
                Text(
                  'Parent: ',
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.onSurfaceVariant,
                    fontSize: 11.0,
                  ),
                ),
                Expanded(
                  child: Text(
                    state.parentId!,
                    key: const Key('cad_selected_component_parent'),
                    style: AppTypography.caption.copyWith(
                      fontSize: 11.0,
                      color: AppColors.onSurface,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
          if (state.assemblyPath.isNotEmpty) ...[
            const SizedBox(height: 2.0),
            Row(
              children: [
                Text(
                  'Hierarchy: ',
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.onSurfaceVariant,
                    fontSize: 11.0,
                  ),
                ),
                Expanded(
                  child: Text(
                    state.breadcrumbs,
                    key: const Key('cad_selected_component_path'),
                    style: AppTypography.caption.copyWith(
                      fontSize: 10.5,
                      color: AppColors.onSurfaceVariant,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return Container(
      key: const Key('exploded_view_chat_message_card'),
      margin: const EdgeInsets.only(top: 8.0, bottom: 12.0),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(18.0),
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10.0,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Header with Machine Info & Expand/Collapse controls
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            color: AppColors.surfaceCard,
            child: Row(
              children: [
                Container(
                  width: 32.0,
                  height: 32.0,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8.0),
                  ),
                  child: const Icon(
                    Icons.layers_rounded,
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
                        widget.payload.title,
                        key: const Key('cad_message_title'),
                        style: AppTypography.headlineMd.copyWith(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.onSurface,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2.0),
                      Text(
                        widget.payload.machineName.toUpperCase(),
                        key: const Key('cad_message_machine_name'),
                        style: AppTypography.caption.copyWith(
                          fontSize: 10.5,
                          color: AppColors.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),

                // Fullscreen Expand Action
                IconButton(
                  key: const Key('cad_fullscreen_button'),
                  icon: const Icon(Icons.fullscreen_rounded, size: 20.0),
                  color: AppColors.onSurfaceVariant,
                  tooltip: 'Fullscreen View',
                  onPressed: () => _openFullscreen(context),
                ),

                // Collapse/Expand Toggle
                IconButton(
                  key: const Key('cad_collapse_toggle_button'),
                  icon: Icon(
                    _isCollapsed ? Icons.expand_more_rounded : Icons.expand_less_rounded,
                    size: 20.0,
                  ),
                  color: AppColors.onSurfaceVariant,
                  tooltip: _isCollapsed ? 'Expand 3D View' : 'Collapse 3D View',
                  onPressed: () => setState(() => _isCollapsed = !_isCollapsed),
                ),
              ],
            ),
          ),

          // 2. Interactive 3D Viewport
          if (!_isCollapsed) ...[
            AspectRatio(
              aspectRatio: 16 / 10,
              child: _buildViewport(context),
            ),
            ValueListenableBuilder<CadComponentSelectionState>(
              valueListenable: _bridgeService.stateNotifier,
              builder: (context, selectionState, _) {
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // 3. Navigation Controls Bar
                    _buildControlsBar(context, selectionState),
                    // 4. Selected Component Info Card (Part 7)
                    if (selectionState.hasSelection)
                      _buildComponentInfoSection(context, selectionState),
                  ],
                );
              },
            ),
          ],

          // 5. Description Footer
          if (widget.payload.description.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 10.0),
              child: Text(
                widget.payload.description,
                key: const Key('cad_message_description'),
                style: AppTypography.bodySm.copyWith(
                  color: AppColors.onSurfaceVariant,
                  fontSize: 12.0,
                  height: 1.35,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Simple subtle background painter simulating CAD canvas grid.
class _GridBackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF282E38)
      ..strokeWidth = 1.0;

    const step = 24.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
