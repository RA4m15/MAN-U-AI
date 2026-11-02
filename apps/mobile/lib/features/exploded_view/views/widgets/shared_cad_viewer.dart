import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../core/config/env_config.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../chat/models/cad_component_selection_state.dart';
import '../../../chat/services/cad_viewer_bridge_service.dart';

/// Reusable Shared CAD 3D Viewer Widget.
///
/// Used by both:
/// 1. ExplodedViewScreen (Dedicated Exploded View Section)
/// 2. ExplodedViewChatMessage (AI Chat Response Bubble)
///
/// Encapsulates WebViewController lifecycle, JavaScript bridge communication,
/// stage step navigation, component selection, error handling, and headless test simulation.
class SharedCadViewer extends StatefulWidget {
  final String machineId;
  final String machineName;
  final String modelUrl;
  final bool isCadPending;
  final String? referenceImage;
  final CadViewerBridgeService? bridgeService;
  final ValueChanged<CadComponentSelectionState>? onComponentSelected;
  final ValueChanged<CadComponentSelectionState>? onStateChanged;
  final VoidCallback? onExpandFullscreen;
  final bool showControls;
  final bool isFullscreen;
  final int initialStep;
  final int totalSteps;

  const SharedCadViewer({
    super.key,
    required this.machineId,
    required this.machineName,
    required this.modelUrl,
    this.isCadPending = false,
    this.referenceImage,
    this.bridgeService,
    this.onComponentSelected,
    this.onStateChanged,
    this.onExpandFullscreen,
    this.showControls = true,
    this.isFullscreen = false,
    this.initialStep = 1,
    this.totalSteps = 4,
  });

  @override
  State<SharedCadViewer> createState() => _SharedCadViewerState();
}

class _SharedCadViewerState extends State<SharedCadViewer>
    with AutomaticKeepAliveClientMixin {
  WebViewController? _controller;
  late final CadViewerBridgeService _bridgeService;
  bool _ownsBridgeService = false;

  bool _isLoading = true;
  bool _hasError = false;
  String? _errorMessage;

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
        machineId: widget.machineId,
        initialStep: widget.initialStep,
        totalSteps: widget.totalSteps,
      );
      _ownsBridgeService = true;
    }
    _bridgeService.stateNotifier.addListener(_onStateNotifierChanged);
    _initWebViewController();
  }

  void _onStateNotifierChanged() {
    if (mounted) {
      widget.onComponentSelected?.call(_bridgeService.state);
      widget.onStateChanged?.call(_bridgeService.state);
    }
  }

  @override
  void dispose() {
    _bridgeService.stateNotifier.removeListener(_onStateNotifierChanged);
    if (_ownsBridgeService) {
      _bridgeService.dispose();
    } else {
      _bridgeService.detachController();
    }
    super.dispose();
  }

  bool get _isPlatformSupported {
    if (kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.android ||
        defaultTargetPlatform == TargetPlatform.iOS;
  }

  void _initWebViewController() {
    if (widget.isCadPending || !_isPlatformSupported) {
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

      // JavaScript Channel for two-way host communication
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
      // Headless / test / unsupported WebView fallback to simulated viewport
      _hasError = false;
    }
  }

  void _loadViewerUrl() {
    if (_controller == null) return;

    final modelUrl = widget.modelUrl;
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
      _controller!.loadRequest(uri);
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

  Widget _buildCadPendingCard(BuildContext context) {
    return Container(
      key: const Key('cad_pending_card'),
      color: AppColors.surfaceAlt,
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.referenceImage != null && widget.referenceImage!.isNotEmpty)
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10.0),
                child: Image.asset(
                  widget.referenceImage!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => Container(
                    color: AppColors.surfaceCard,
                    child: const Icon(
                      Icons.precision_manufacturing_rounded,
                      size: 36.0,
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                ),
              ),
            ),
          const SizedBox(height: 8.0),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 3.0),
                decoration: BoxDecoration(
                  color: AppColors.accentCategorical5.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6.0),
                  border: Border.all(color: AppColors.accentCategorical5, width: 0.8),
                ),
                child: Text(
                  'CAD MODEL PENDING',
                  key: const Key('cad_pending_badge'),
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.accentCategorical5,
                    fontSize: 9.5,
                  ),
                ),
              ),
              const SizedBox(width: 8.0),
              Expanded(
                child: Text(
                  'Visual Model Pending Upload',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.onSurfaceVariant,
                    fontSize: 10.5,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4.0),
          Text(
            '3D CAD geometry is awaiting administrative upload. Grounded SOPs and technical manuals remain fully searchable.',
            style: AppTypography.bodySm.copyWith(
              color: AppColors.onSurfaceVariant,
              fontSize: 10.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildViewport(BuildContext context) {
    if (widget.isCadPending) {
      return _buildCadPendingCard(context);
    }
    if (_hasError) {
      return Container(
        key: const Key('cad_viewer_error_container'),
        padding: const EdgeInsets.all(16.0),
        alignment: Alignment.center,
        color: AppColors.surfaceMuted,
        child: SingleChildScrollView(
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
        ),
      );
    }

    Widget content;
    if (_controller != null && _isPlatformSupported) {
      content = WebViewWidget(
        key: const Key('cad_webview_widget'),
        controller: _controller!,
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
            CustomPaint(
              size: Size.infinite,
              painter: _SharedGridBackgroundPainter(),
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
                  widget.machineName.toUpperCase(),
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
                        fontSize: 9.5,
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
        if (_isLoading && !widget.isCadPending)
          Positioned.fill(
            child: Container(
              color: AppColors.surface.withValues(alpha: 0.7),
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 28.0,
                      height: 28.0,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    ),
                    SizedBox(height: 10.0),
                    Text(
                      'Loading 3D Assembly...',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildControlsBar(BuildContext context, CadComponentSelectionState selectionState) {
    final currentStep = selectionState.currentStep;
    final totalSteps = selectionState.totalSteps;
    final canGoPrev = currentStep > 1;
    final canGoNext = currentStep < totalSteps;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 6.0),
      decoration: const BoxDecoration(
        color: AppColors.surfaceAlt,
        border: Border(
          top: BorderSide(color: AppColors.border, width: 1.0),
        ),
      ),
      child: Row(
        children: [
          // Previous Stage Button
          IconButton(
            key: const Key('cad_prev_stage_button'),
            icon: const Icon(Icons.arrow_back_ios_rounded, size: 15.0),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32.0, minHeight: 32.0),
            tooltip: 'Previous Exploded Stage',
            color: canGoPrev ? AppColors.primary : AppColors.onSurfaceVariant.withValues(alpha: 0.35),
            onPressed: canGoPrev ? _prevStage : null,
          ),
          const SizedBox(width: 4.0),
          // Stage Counter Badge
          Expanded(
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12.0),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(
                  'STAGE $currentStep OF $totalSteps',
                  key: const Key('cad_stage_indicator'),
                  style: AppTypography.labelMd.copyWith(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: AppColors.onSurface,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 4.0),
          // Next Stage Button
          IconButton(
            key: const Key('cad_next_stage_button'),
            icon: const Icon(Icons.arrow_forward_ios_rounded, size: 15.0),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32.0, minHeight: 32.0),
            tooltip: 'Next Exploded Stage',
            color: canGoNext ? AppColors.primary : AppColors.onSurfaceVariant.withValues(alpha: 0.35),
            onPressed: canGoNext ? _nextStage : null,
          ),
          const SizedBox(width: 6.0),
          // Reset Assembly Button
          IconButton(
            key: const Key('cad_reset_assembly_button'),
            icon: const Icon(Icons.restart_alt_rounded, size: 18.0),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32.0, minHeight: 32.0),
            tooltip: 'Reset to Assembled View',
            color: AppColors.onSurfaceVariant,
            onPressed: _resetAssembly,
          ),
          if (widget.onExpandFullscreen != null && !widget.isFullscreen) ...[
            const SizedBox(width: 4.0),
            IconButton(
              key: const Key('cad_expand_fullscreen_button'),
              icon: const Icon(Icons.fullscreen_rounded, size: 20.0),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32.0, minHeight: 32.0),
              tooltip: 'Expand Fullscreen',
              color: AppColors.primary,
              onPressed: widget.onExpandFullscreen,
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return ValueListenableBuilder<CadComponentSelectionState>(
      valueListenable: _bridgeService.stateNotifier,
      builder: (context, selectionState, _) {
        return Column(
          children: [
            Expanded(child: _buildViewport(context)),
            if (widget.showControls && !widget.isCadPending)
              _buildControlsBar(context, selectionState),
          ],
        );
      },
    );
  }
}

class _SharedGridBackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.05)
      ..strokeWidth = 1.0;

    const spacing = 24.0;
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
