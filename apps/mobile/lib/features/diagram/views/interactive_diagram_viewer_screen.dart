import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/diagram_annotation_model.dart';
import '../repositories/diagram_repository.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/widgets/terminal_components.dart';

/// Terminal Cobalt Mobile Interactive Diagram & 3D Simulation Workbench
/// Multimodal SimReady physics simulation, multi-diagram horizontal scroll, and exploded assembly viewer.
class InteractiveDiagramViewerScreen extends ConsumerStatefulWidget {
  final String figureId;
  final String? title;
  final void Function(String prompt)? onAskAboutPart;

  const InteractiveDiagramViewerScreen({
    super.key,
    required this.figureId,
    this.title,
    this.onAskAboutPart,
  });

  @override
  ConsumerState<InteractiveDiagramViewerScreen> createState() =>
      _InteractiveDiagramViewerScreenState();
}

class _InteractiveDiagramViewerScreenState
    extends ConsumerState<InteractiveDiagramViewerScreen>
    with SingleTickerProviderStateMixin {
  late String _activeFigureId;
  late String _activeTitle;
  DiagramAnnotationModel? _annotation;
  bool _isLoading = true;
  DiagramHotspotModel? _selectedHotspot;

  // Simulation State
  late AnimationController _simController;
  bool _isSimRunning = true;
  double _simSpeed = 1.0;
  bool _isEStopTriggered = false;
  double _explodedSeparation = 0.0;
  double _rotationAngle = 0.0;

  static const List<Map<String, dynamic>> _diagramsCatalog = [
    {
      'id': 'FIG-DRYPIX-6000',
      'title': 'Fuji DRYPIX Smart',
      'subtitle': 'Laser Imager & Thermal Development Unit',
      'badge': '3D SCHEMATIC',
      'pins': '8 HOTSPOTS',
      'icon': Icons.print_rounded,
      'image': 'assets/images/drypix_6000.png',
      'staticUrl': 'http://localhost:4000/static/diagrams/drypix_6000.png',
      'apiUrl': 'http://localhost:4000/api/v1/diagrams/FIG-DRYPIX-6000/image',
    },
    {
      'id': 'FIG-CONVEYOR-BELT-A61',
      'title': 'Conveyor Belt A61',
      'subtitle': 'Bulk Material Transport & Optical Inspection',
      'badge': '3D SIMREADY',
      'pins': '7 PINS',
      'icon': Icons.precision_manufacturing_rounded,
      'image': 'assets/images/conveyor_belt_a61.png',
      'staticUrl': 'http://localhost:4000/static/diagrams/conveyor_belt_a61.png',
      'apiUrl': 'http://localhost:4000/api/v1/diagrams/FIG-CONVEYOR-BELT-A61/image',
    },
    {
      'id': 'FIG-TURBOCOMPRESSOR-B01',
      'title': 'Turbocompressor B01',
      'subtitle': 'Titanium Impeller & Gas Turbine Rotor',
      'badge': '3D SIMREADY',
      'pins': '6 PINS',
      'icon': Icons.cyclone_rounded,
      'image': 'assets/images/turbocompressor_b01.png',
      'staticUrl': 'http://localhost:4000/static/diagrams/turbocompressor_b01.png',
      'apiUrl': 'http://localhost:4000/api/v1/diagrams/FIG-TURBOCOMPRESSOR-B01/image',
    },
    {
      'id': 'FIG-P102-EXPLODED',
      'title': 'Slurry Pump P-102',
      'subtitle': 'Centrifugal Power & Wet End Assembly',
      'badge': 'CAD SCHEMATIC',
      'pins': '6 PINS',
      'icon': Icons.settings_input_composite_rounded,
      'image': null,
      'staticUrl': null,
      'apiUrl': null,
    },
  ];

  @override
  void initState() {
    super.initState();
    _activeFigureId = widget.figureId;
    _activeTitle = widget.title ?? _resolveDefaultTitle(widget.figureId);

    _simController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    );

    final isAnimated = _activeFigureId.toUpperCase().contains('CONVEYOR') ||
        _activeFigureId.toUpperCase().contains('A61') ||
        _activeFigureId.toUpperCase().contains('TURBO') ||
        _activeFigureId.toUpperCase().contains('DRYPIX') ||
        _activeFigureId.toUpperCase().contains('6000') ||
        _activeFigureId.toUpperCase().contains('COMPRESSOR');

    if (isAnimated) {
      _simController.repeat();
    } else {
      _isSimRunning = false;
    }

    _loadAnnotationsFor(_activeFigureId);
  }

  String _resolveDefaultTitle(String fid) {
    if (fid.toUpperCase().contains('DRYPIX') || fid.toUpperCase().contains('6000')) {
      return 'Fuji DRYPIX Smart (DRYPIX 6000) Component Schematic';
    }
    if (fid.toUpperCase().contains('TURBO') || fid.toUpperCase().contains('COMPRESSOR')) {
      return 'Turbocompressor B01 Exploded Assembly';
    }
    if (fid.toUpperCase().contains('CONVEYOR') || fid.toUpperCase().contains('A61')) {
      return 'Conveyor Belt A61 Exploded Assembly';
    }
    return 'Slurry Pump P-102 Exploded Assembly';
  }

  @override
  void dispose() {
    _simController.dispose();
    super.dispose();
  }

  Future<void> _loadAnnotationsFor(String figureId) async {
    final repo = ref.read(diagramRepositoryProvider);
    final data = await repo.getAnnotations(figureId);
    if (mounted) {
      setState(() {
        _annotation = data;
        _isLoading = false;
      });
    }
  }

  void _switchDiagram(Map<String, dynamic> item) {
    final newId = item['id'] as String;
    if (_activeFigureId == newId) return;

    setState(() {
      _activeFigureId = newId;
      _activeTitle = '${item['title']} Exploded Assembly';
      _isLoading = true;
      _selectedHotspot = null;
      _rotationAngle = 0.0;
      _explodedSeparation = 0.0;
      _isEStopTriggered = false;

      final isAnimated = newId.toUpperCase().contains('CONVEYOR') ||
          newId.toUpperCase().contains('A61') ||
          newId.toUpperCase().contains('TURBO') ||
          newId.toUpperCase().contains('DRYPIX') ||
          newId.toUpperCase().contains('6000') ||
          newId.toUpperCase().contains('COMPRESSOR');

      if (isAnimated) {
        _isSimRunning = true;
        _simController.repeat();
      } else {
        _isSimRunning = false;
        _simController.stop();
      }
    });

    _loadAnnotationsFor(newId);
  }

  void _toggleSimulation() {
    if (_isEStopTriggered) return;
    setState(() {
      _isSimRunning = !_isSimRunning;
      if (_isSimRunning) {
        _simController.repeat();
      } else {
        _simController.stop();
      }
    });
  }

  void _triggerEStop() {
    setState(() {
      _isEStopTriggered = true;
      _isSimRunning = false;
      _simController.stop();
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 20.0),
            const SizedBox(width: 8.0),
            Expanded(
              child: Text(
                'E-STOP ENGAGED // KINETIC ENERGY ZEROED // LOTO REQUIRED',
                style: AppTypography.caption.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: AppColors.error,
        duration: const Duration(seconds: 4),
        action: SnackBarAction(
          label: 'RESET',
          textColor: Colors.white,
          onPressed: () {
            setState(() {
              _isEStopTriggered = false;
              _isSimRunning = true;
              _simController.repeat();
            });
          },
        ),
      ),
    );
  }

  void _showPartDetailsSheet(DiagramHotspotModel spot) {
    setState(() => _selectedHotspot = spot);

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceAlt,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(8.0)),
        side: BorderSide(color: AppColors.border, width: 1.0),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  BadgePill(
                    label: 'PART // ${spot.partNumber}',
                    color: AppColors.primary,
                  ),
                  const Spacer(),
                  if (spot.manualPage != null)
                    Text(
                      'MANUAL PAGE ${spot.manualPage}',
                      style: AppTypography.caption,
                    ),
                ],
              ),
              const SizedBox(height: 14.0),
              SectionHeader(
                title: spot.partName,
                padding: EdgeInsets.zero,
              ),
              if (spot.description != null && spot.description!.isNotEmpty) ...[
                const SizedBox(height: 10.0),
                Text(
                  spot.description!.toUpperCase(),
                  style: AppTypography.bodySm.copyWith(
                    color: AppColors.onSurface,
                    height: 1.4,
                  ),
                ),
              ],
              const SizedBox(height: 16.0),
              // Live part telemetry when simulation is active
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(4.0),
                  border: Border.all(color: AppColors.border, width: 1.0),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildTelemetryItem(
                      label: 'STATUS',
                      value: _isEStopTriggered ? 'LOCKED' : (_isSimRunning ? 'NOMINAL' : 'PAUSED'),
                      color: _isEStopTriggered ? AppColors.error : AppColors.success,
                    ),
                    _buildTelemetryItem(
                      label: 'TEMPERATURE',
                      value: _isSimRunning ? '42.8°C' : '24.1°C',
                      color: AppColors.onSurface,
                    ),
                    _buildTelemetryItem(
                      label: 'HEALTH',
                      value: '99.4%',
                      color: AppColors.primary,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18.0),
              MachinedPrimaryButton(
                label: 'ASK COPILOT ABOUT THIS PART',
                icon: Icons.psychology_rounded,
                onPressed: () {
                  Navigator.pop(ctx);
                  final prompt =
                      'What are the removal procedure, inspection checks, and torque ratings for Part ${spot.partNumber} (${spot.partName})?';
                  if (widget.onAskAboutPart != null) {
                    widget.onAskAboutPart!(prompt);
                    Navigator.pop(context);
                  }
                },
              ),
              const SizedBox(height: 10.0),
            ],
          ),
        );
      },
    );
  }

  Widget _buildTelemetryItem({
    required String label,
    required String value,
    required Color color,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTypography.caption.copyWith(
            fontSize: 9.0,
            color: AppColors.onSurfaceVariant,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 2.0),
        Text(
          value,
          style: AppTypography.caption.copyWith(
            fontSize: 11.0,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isConveyor = _activeFigureId.toUpperCase().contains('CONVEYOR') ||
        _activeFigureId.toUpperCase().contains('A61');

    final isTurbocompressor = _activeFigureId.toUpperCase().contains('TURBO') ||
        _activeFigureId.toUpperCase().contains('COMPRESSOR') ||
        _activeFigureId.toUpperCase().contains('B01');

    final isDrypix = _activeFigureId.toUpperCase().contains('DRYPIX') ||
        _activeFigureId.toUpperCase().contains('6000');

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: Center(
          child: ButtonIconTile(
            icon: Icons.arrow_back_ios_new_rounded,
            size: 36.0,
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        title: Row(
          children: [
            StatusDot(
              color: _isEStopTriggered
                  ? AppColors.error
                  : (_isSimRunning ? AppColors.success : AppColors.warning),
              size: 8.0,
            ),
            const SizedBox(width: 8.0),
            Expanded(
              child: Text(
                _activeTitle,
                style: AppTypography.headlineMd.copyWith(fontSize: 13.5),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          ButtonIconTile(
            icon: Icons.auto_awesome,
            tooltip: 'Run AI Vision Part Detection',
            iconColor: AppColors.primary,
            size: 36.0,
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              setState(() => _isLoading = true);
              final repo = ref.read(diagramRepositoryProvider);
              final refreshed = await repo.annotateWithVision(_activeFigureId);
              if (mounted) {
                setState(() {
                  _annotation = refreshed;
                  _isLoading = false;
                });
                messenger.showSnackBar(
                  SnackBar(
                    content: Text(
                      'EXPLODED VIEW VERIFIED VIA MULTIMODAL VISION'.toUpperCase(),
                      style: AppTypography.caption.copyWith(color: AppColors.success),
                    ),
                    backgroundColor: AppColors.surfaceAlt,
                  ),
                );
              }
            },
          ),
          const SizedBox(width: 12.0),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: SizedBox(
                width: 24.0,
                height: 24.0,
                child: CircularProgressIndicator(strokeWidth: 2.0),
              ),
            )
          : Column(
              children: [
                const Divider(color: AppColors.border, height: 1.0),

                // Horizontal Scroll Section for Multiple Diagrams
                Container(
                  height: 52.0,
                  color: AppColors.surfaceMuted,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                    scrollDirection: Axis.horizontal,
                    itemCount: _diagramsCatalog.length,
                    separatorBuilder: (context, index) => const SizedBox(width: 8.0),
                    itemBuilder: (context, idx) {
                      final item = _diagramsCatalog[idx];
                      final isSelected = item['id'] == _activeFigureId;

                      return InkWell(
                        key: Key('diagram_chip_${item['id']}'),
                        onTap: () => _switchDiagram(item),
                        borderRadius: BorderRadius.circular(6.0),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
                          decoration: BoxDecoration(
                            color: isSelected ? AppColors.surfaceAlt : AppColors.surface,
                            borderRadius: BorderRadius.circular(6.0),
                            border: Border.all(
                              color: isSelected ? AppColors.primary : AppColors.border,
                              width: isSelected ? 1.5 : 1.0,
                            ),
                            boxShadow: isSelected
                                ? const [
                                    BoxShadow(
                                      color: Color(0x330057FF),
                                      blurRadius: 8.0,
                                      spreadRadius: 1.0,
                                    ),
                                  ]
                                : null,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                item['icon'] as IconData,
                                size: 14.0,
                                color: isSelected ? AppColors.primary : AppColors.onSurfaceVariant,
                              ),
                              const SizedBox(width: 6.0),
                              Text(
                                item['title'] as String,
                                style: AppTypography.caption.copyWith(
                                  color: isSelected ? Colors.white : AppColors.onSurface,
                                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                  fontSize: 11.0,
                                ),
                              ),
                              const SizedBox(width: 6.0),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 4.0, vertical: 1.0),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? AppColors.primary.withValues(alpha: 0.20)
                                      : AppColors.surfaceMuted,
                                  borderRadius: BorderRadius.circular(3.0),
                                ),
                                child: Text(
                                  item['pins'] as String,
                                  style: AppTypography.caption.copyWith(
                                    fontSize: 8.5,
                                    fontWeight: FontWeight.w700,
                                    color: isSelected ? AppColors.primary : AppColors.onSurfaceVariant,
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

                // Top Instruction Bar
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
                  color: AppColors.surfaceAlt,
                  child: Row(
                    children: [
                      const Icon(Icons.touch_app_rounded, size: 13.0, color: AppColors.primary),
                      const SizedBox(width: 8.0),
                      Expanded(
                        child: Text(
                          'Tap any numbered part callout for OEM specifications',
                          style: AppTypography.caption.copyWith(fontSize: 10.5),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                        decoration: BoxDecoration(
                          color: _isEStopTriggered
                              ? AppColors.error.withValues(alpha: 0.15)
                              : (_isSimRunning
                                  ? AppColors.success.withValues(alpha: 0.15)
                                  : AppColors.warning.withValues(alpha: 0.15)),
                          borderRadius: BorderRadius.circular(4.0),
                          border: Border.all(
                            color: _isEStopTriggered
                                ? AppColors.error
                                : (_isSimRunning ? AppColors.success : AppColors.warning),
                            width: 1.0,
                          ),
                        ),
                        child: Text(
                          _isEStopTriggered
                              ? 'E-STOPPED'
                              : (_isSimRunning ? 'SIM RUNNING' : 'SIM PAUSED'),
                          style: AppTypography.caption.copyWith(
                            fontSize: 9.0,
                            fontWeight: FontWeight.w700,
                            color: _isEStopTriggered
                                ? AppColors.error
                                : (_isSimRunning ? AppColors.success : AppColors.warning),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Live Sensor & Physics Telemetry Strip
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    border: Border(
                      bottom: BorderSide(color: AppColors.border, width: 1.0),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: isTurbocompressor
                        ? [
                            _buildTelemetryItem(
                              label: 'ROTOR SPEED',
                              value: _isSimRunning
                                  ? '${(42500 * _simSpeed).toInt()} RPM'
                                  : '0 RPM',
                              color: _isSimRunning ? AppColors.primary : AppColors.onSurfaceVariant,
                            ),
                            _buildTelemetryItem(
                              label: 'PRESSURE RATIO',
                              value: _isSimRunning ? '${(3.8 * _simSpeed).toStringAsFixed(1)}:1' : '1.0:1',
                              color: AppColors.accentCategorical5,
                            ),
                            _buildTelemetryItem(
                              label: 'DISCHARGE TEMP',
                              value: _isSimRunning ? '184.2°C' : '22.4°C',
                              color: AppColors.warning,
                            ),
                            _buildTelemetryItem(
                              label: 'VIBRATION',
                              value: _isSimRunning ? '0.8 mm/s' : '0.0 mm/s',
                              color: _isSimRunning ? AppColors.success : AppColors.onSurfaceVariant,
                            ),
                          ]
                        : (isConveyor
                            ? [
                                _buildTelemetryItem(
                                  label: 'BELT SPEED',
                                  value: _isSimRunning ? '${(1.25 * _simSpeed).toStringAsFixed(2)} m/s' : '0.00 m/s',
                                  color: _isSimRunning ? AppColors.primary : AppColors.onSurfaceVariant,
                                ),
                                _buildTelemetryItem(
                                  label: 'DRIVE MOTOR',
                                  value: _isSimRunning ? '1,750 RPM' : '0 RPM',
                                  color: AppColors.onSurface,
                                ),
                                _buildTelemetryItem(
                                  label: 'TENSION FORCE',
                                  value: '16.5 kN/m',
                                  color: AppColors.accentCategorical5,
                                ),
                                _buildTelemetryItem(
                                  label: 'SCANNER',
                                  value: _isSimRunning ? '340 PPM' : 'STANDBY',
                                  color: _isSimRunning ? AppColors.success : AppColors.onSurfaceVariant,
                                ),
                              ]
                            : isDrypix
                                ? [
                                    _buildTelemetryItem(
                                      label: 'LASER OPTICS',
                                      value: '130 mW (659nm)',
                                      color: AppColors.primary,
                                    ),
                                    _buildTelemetryItem(
                                      label: 'THERMAL DRUM',
                                      value: '42.5 °C',
                                      color: AppColors.onSurface,
                                    ),
                                    _buildTelemetryItem(
                                      label: 'FILM TRAY 1',
                                      value: 'DI-HL 14x17"',
                                      color: AppColors.accentCategorical5,
                                    ),
                                    _buildTelemetryItem(
                                      label: 'STATUS',
                                      value: _isEStopTriggered
                                          ? 'ERR 221 JAM'
                                          : (_isSimRunning ? 'PRO (PRINT)' : 'STANDBY'),
                                      color: _isEStopTriggered
                                          ? AppColors.error
                                          : (_isSimRunning ? AppColors.success : AppColors.onSurfaceVariant),
                                    ),
                                  ]
                            : [
                                _buildTelemetryItem(
                                  label: 'FLOW RATE',
                                  value: _isSimRunning ? '420 m³/h' : '0 m³/h',
                                  color: AppColors.primary,
                                ),
                                _buildTelemetryItem(
                                  label: 'HEAD PRESSURE',
                                  value: '45.0 m',
                                  color: AppColors.onSurface,
                                ),
                                _buildTelemetryItem(
                                  label: 'PUMP SHAFT',
                                  value: _isSimRunning ? '1,180 RPM' : '0 RPM',
                                  color: AppColors.accentCategorical5,
                                ),
                                _buildTelemetryItem(
                                  label: 'SEAL FLUSH',
                                  value: '4.2 Bar',
                                  color: AppColors.success,
                                ),
                              ]),
                  ),
                ),

                // Interactive 3D Simulation Canvas
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(8.0),
                        border: Border.all(color: AppColors.border, width: 1.0),
                      ),
                      child: GestureDetector(
                        onHorizontalDragUpdate: (details) {
                          setState(() {
                            _rotationAngle += details.primaryDelta! * 0.008;
                          });
                        },
                        child: InteractiveViewer(
                          maxScale: 4.0,
                          minScale: 0.8,
                          child: LayoutBuilder(
                            builder: (context, constraints) {
                              final canvasWidth = constraints.maxWidth;
                              final canvasHeight = constraints.maxHeight;

                              return Stack(
                                children: [
                                  // 3D Perspective Grid
                                  Positioned.fill(
                                    child: CustomPaint(
                                      painter: _SimulationGridPainter(),
                                    ),
                                  ),

                                  // 3D Model Render / Schematic with perspective rotation
                                  Center(
                                    child: Transform(
                                      alignment: Alignment.center,
                                      transform: Matrix4.identity()
                                        ..setEntry(3, 2, 0.001)
                                        ..rotateY(_rotationAngle * 0.4),
                                      child: isDrypix
                                          ? Stack(
                                              alignment: Alignment.center,
                                              children: [
                                                Image.asset(
                                                  'assets/images/drypix_6000.png',
                                                  width: canvasWidth * 0.95,
                                                  height: canvasHeight * 0.85,
                                                  fit: BoxFit.contain,
                                                  errorBuilder: (context, error, stackTrace) => Image.network(
                                                    'http://localhost:4000/static/diagrams/drypix_6000.png',
                                                    width: canvasWidth * 0.95,
                                                    height: canvasHeight * 0.85,
                                                    fit: BoxFit.contain,
                                                    errorBuilder: (context, error2, stackTrace2) => Image.network(
                                                      'http://localhost:4000/api/v1/diagrams/FIG-DRYPIX-6000/image',
                                                      width: canvasWidth * 0.95,
                                                      height: canvasHeight * 0.85,
                                                      fit: BoxFit.contain,
                                                      errorBuilder: (context, error3, stackTrace3) => const Icon(
                                                        Icons.print_rounded,
                                                        color: AppColors.primary,
                                                        size: 64.0,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                                // Live simulation overlay for DRYPIX Smart
                                                if (_isSimRunning && !_isEStopTriggered)
                                                  AnimatedBuilder(
                                                    animation: _simController,
                                                    builder: (context, child) {
                                                      return CustomPaint(
                                                        size: Size(canvasWidth * 0.9, canvasHeight * 0.8),
                                                        painter: _DrypixSmartSimulationPainter(
                                                          progress: _simController.value,
                                                          speedMultiplier: _simSpeed,
                                                          explodedSeparation: _explodedSeparation,
                                                        ),
                                                      );
                                                    },
                                                  ),
                                              ],
                                            )
                                          : isTurbocompressor
                                          ? Stack(
                                              alignment: Alignment.center,
                                              children: [
                                                Image.asset(
                                                  'assets/images/turbocompressor_b01.png',
                                                  width: canvasWidth * 0.95,
                                                  height: canvasHeight * 0.85,
                                                  fit: BoxFit.contain,
                                                  errorBuilder: (context, error, stackTrace) => Image.network(
                                                    'http://localhost:4000/static/diagrams/turbocompressor_b01.png',
                                                    width: canvasWidth * 0.95,
                                                    height: canvasHeight * 0.85,
                                                    fit: BoxFit.contain,
                                                    errorBuilder: (context, error2, stackTrace2) => Image.network(
                                                      'http://localhost:4000/api/v1/diagrams/FIG-TURBOCOMPRESSOR-B01/image',
                                                      width: canvasWidth * 0.95,
                                                      height: canvasHeight * 0.85,
                                                      fit: BoxFit.contain,
                                                      errorBuilder: (context, error3, stackTrace3) => const Icon(
                                                        Icons.cyclone_rounded,
                                                        color: AppColors.primary,
                                                        size: 64.0,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                                // Live simulation overlay for Turbocompressor B01
                                                if (_isSimRunning && !_isEStopTriggered)
                                                  AnimatedBuilder(
                                                    animation: _simController,
                                                    builder: (context, child) {
                                                      return CustomPaint(
                                                        size: Size(canvasWidth * 0.9, canvasHeight * 0.8),
                                                        painter: _TurbocompressorSimulationPainter(
                                                          progress: _simController.value,
                                                          speedMultiplier: _simSpeed,
                                                        ),
                                                      );
                                                    },
                                                  ),
                                              ],
                                            )
                                          : (isConveyor
                                              ? Stack(
                                                  alignment: Alignment.center,
                                                  children: [
                                                    Image.asset(
                                                      'assets/images/conveyor_belt_a61.png',
                                                      width: canvasWidth * 0.95,
                                                      height: canvasHeight * 0.85,
                                                      fit: BoxFit.contain,
                                                      errorBuilder: (context, error, stackTrace) => Image.network(
                                                        'http://localhost:4000/static/diagrams/conveyor_belt_a61.png',
                                                        width: canvasWidth * 0.95,
                                                        height: canvasHeight * 0.85,
                                                        fit: BoxFit.contain,
                                                        errorBuilder: (context, error2, stackTrace2) => Image.network(
                                                          'http://localhost:4000/api/v1/diagrams/FIG-CONVEYOR-BELT-A61/image',
                                                          width: canvasWidth * 0.95,
                                                          height: canvasHeight * 0.85,
                                                          fit: BoxFit.contain,
                                                          errorBuilder: (context, error3, stackTrace3) => CustomPaint(
                                                            size: Size(canvasWidth * 0.9, canvasHeight * 0.8),
                                                            painter: _PumpSchematicPainter(),
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                    if (_isSimRunning && !_isEStopTriggered)
                                                      AnimatedBuilder(
                                                        animation: _simController,
                                                        builder: (context, child) {
                                                          return CustomPaint(
                                                            size: Size(canvasWidth * 0.9, canvasHeight * 0.8),
                                                            painter: _ConveyorSimulationPainter(
                                                              progress: _simController.value,
                                                              speedMultiplier: _simSpeed,
                                                            ),
                                                          );
                                                        },
                                                      ),
                                                  ],
                                                )
                                              : CustomPaint(
                                                  size: Size(canvasWidth * 0.9, canvasHeight * 0.8),
                                                  painter: _PumpSchematicPainter(),
                                                )),
                                    ),
                                  ),

                                  // E-Stop Warning Banner
                                  if (_isEStopTriggered)
                                    Positioned(
                                      top: 16.0,
                                      left: 16.0,
                                      right: 16.0,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                                        decoration: BoxDecoration(
                                          color: AppColors.error.withValues(alpha: 0.90),
                                          borderRadius: BorderRadius.circular(4.0),
                                          border: Border.all(color: Colors.white, width: 1.5),
                                        ),
                                        child: Row(
                                          children: [
                                            const Icon(Icons.dangerous_rounded, color: Colors.white, size: 20.0),
                                            const SizedBox(width: 8.0),
                                            Expanded(
                                              child: Text(
                                                'EMERGENCY STOP ACTIVATED // 0 JOULES KINETIC ENERGY',
                                                style: AppTypography.caption.copyWith(
                                                  color: Colors.white,
                                                  fontWeight: FontWeight.w700,
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),

                                  // Hotspot Component Pins
                                  if (_annotation != null)
                                    ..._annotation!.hotspots.map((spot) {
                                      final isSelected = _selectedHotspot?.id == spot.id;
                                      final rawX = spot.boundingBox.length >= 4
                                          ? (spot.boundingBox[1] + spot.boundingBox[3]) / 2000.0
                                          : 0.5;
                                      final rawY = spot.boundingBox.length >= 4
                                          ? (spot.boundingBox[0] + spot.boundingBox[2]) / 2000.0
                                          : 0.5;

                                      final explodeDx = (rawX - 0.5) * _explodedSeparation * 60.0;
                                      final explodeDy = (rawY - 0.5) * _explodedSeparation * 60.0;

                                      final left = (rawX * canvasWidth) - 18.0 + explodeDx;
                                      final top = (rawY * canvasHeight) - 18.0 + explodeDy;
                                      final pinLabel = spot.partNumber.contains('-')
                                          ? spot.partNumber.split('-').last
                                          : spot.partNumber;

                                      return Positioned(
                                        left: left.clamp(0.0, canvasWidth - 36.0),
                                        top: top.clamp(0.0, canvasHeight - 36.0),
                                        child: GestureDetector(
                                          onTap: () => _showPartDetailsSheet(spot),
                                          child: AnimatedContainer(
                                            duration: const Duration(milliseconds: 200),
                                            width: 36.0,
                                            height: 36.0,
                                            decoration: BoxDecoration(
                                              color: isSelected
                                                  ? AppColors.primary
                                                  : AppColors.surface,
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: isSelected
                                                    ? Colors.white
                                                    : AppColors.primary,
                                                width: 2.0,
                                              ),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: isSelected
                                                      ? const Color(0x990057FF)
                                                      : const Color(0x660057FF),
                                                  blurRadius: isSelected ? 20.0 : 12.0,
                                                  spreadRadius: 1.0,
                                                ),
                                              ],
                                            ),
                                            child: Center(
                                              child: Text(
                                                pinLabel,
                                                style: AppTypography.caption.copyWith(
                                                  color: Colors.white,
                                                  fontWeight: FontWeight.w700,
                                                  fontSize: 11.5,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      );
                                    }),

                                  // Drag-to-rotate guide overlay
                                  Positioned(
                                    bottom: 8.0,
                                    left: 8.0,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                                      decoration: BoxDecoration(
                                        color: AppColors.surface.withValues(alpha: 0.85),
                                        borderRadius: BorderRadius.circular(4.0),
                                        border: Border.all(color: AppColors.border, width: 1.0),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.sync_rounded, size: 12.0, color: AppColors.primary),
                                          const SizedBox(width: 4.0),
                                          Text(
                                            'DRAG TO ROTATE 3D PERSPECTIVE',
                                            style: AppTypography.caption.copyWith(
                                              fontSize: 9.0,
                                              color: AppColors.onSurfaceVariant,
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                // Simulation Controls Bar
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 10.0),
                  color: AppColors.surfaceAlt,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Exploded Separation Slider
                      Row(
                        children: [
                          Text(
                            'EXPLODE VIEW',
                            style: AppTypography.caption.copyWith(
                              fontSize: 10.0,
                              letterSpacing: 0.6,
                              fontWeight: FontWeight.w700,
                              color: AppColors.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(width: 8.0),
                          Expanded(
                            child: SliderTheme(
                              data: SliderTheme.of(context).copyWith(
                                activeTrackColor: AppColors.primary,
                                inactiveTrackColor: AppColors.surface,
                                thumbColor: AppColors.primary,
                                trackHeight: 3.0,
                                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6.0),
                              ),
                              child: Slider(
                                value: _explodedSeparation,
                                min: 0.0,
                                max: 1.0,
                                onChanged: (val) {
                                  setState(() => _explodedSeparation = val);
                                },
                              ),
                            ),
                          ),
                          Text(
                            '${(_explodedSeparation * 100).toInt()}%',
                            style: AppTypography.caption.copyWith(
                              fontSize: 10.0,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6.0),

                      // Action Buttons: Run/Pause, Speed Switcher, E-Stop
                      Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: SecondaryButton(
                              label: _isSimRunning ? 'PAUSE SIM' : 'RESUME SIM',
                              icon: _isSimRunning ? Icons.pause_rounded : Icons.play_arrow_rounded,
                              onPressed: _toggleSimulation,
                            ),
                          ),
                          const SizedBox(width: 8.0),
                          InkWell(
                            onTap: () {
                              setState(() {
                                if (_simSpeed == 1.0) {
                                  _simSpeed = 2.0;
                                } else if (_simSpeed == 2.0) {
                                  _simSpeed = 0.5;
                                } else {
                                  _simSpeed = 1.0;
                                }
                              });
                            },
                            borderRadius: BorderRadius.circular(4.0),
                            child: Container(
                              height: 36.0,
                              padding: const EdgeInsets.symmetric(horizontal: 10.0),
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(4.0),
                                border: Border.all(color: AppColors.border, width: 1.0),
                              ),
                              child: Center(
                                child: Text(
                                  '${_simSpeed}X',
                                  style: AppTypography.caption.copyWith(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8.0),
                          Expanded(
                            flex: 3,
                            child: ElevatedButton.icon(
                              onPressed: _triggerEStop,
                              icon: const Icon(Icons.dangerous_rounded, size: 16.0, color: Colors.white),
                              label: Text(
                                'E-STOP',
                                style: AppTypography.caption.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.8,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.error,
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(4.0),
                                ),
                              ),
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

/// Dynamic Turbocompressor Simulation Painter simulating high-speed centrifugal rotor spin and thermal gradient
class _TurbocompressorSimulationPainter extends CustomPainter {
  final double progress;
  final double speedMultiplier;

  _TurbocompressorSimulationPainter({
    required this.progress,
    required this.speedMultiplier,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width * 0.5, size.height * 0.48);
    final rotorRadius = size.width * 0.16;

    // 1. High-Speed Rotating Aerodynamic Vector Arcs
    final arcPaint = Paint()
      ..color = const Color(0x660057FF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;

    final angleOffset = progress * 2 * math.pi * speedMultiplier * 2;
    for (int i = 0; i < 8; i++) {
      final a = angleOffset + (i * math.pi / 4);
      final r = Rect.fromCircle(center: center, radius: rotorRadius * (0.5 + (i % 2) * 0.3));
      canvas.drawArc(r, a, math.pi / 6, false, arcPaint);
    }

    // 2. High-Pressure Discharge Vector Pulse
    final waveRadius = (progress * 50.0 * speedMultiplier) % 45.0 + 15.0;
    final wavePaint = Paint()
      ..color = Color.lerp(const Color(0x8800F5FF), const Color(0x0000F5FF), waveRadius / 60.0)!
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    canvas.drawCircle(center, rotorRadius + waveRadius, wavePaint);

    // 3. Turbine Housing Thermal Glow
    final glowPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0x44FF6D00),
          const Color(0x00FF6D00),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: rotorRadius * 1.6));

    canvas.drawCircle(center, rotorRadius * 1.6, glowPaint);
  }

  @override
  bool shouldRepaint(covariant _TurbocompressorSimulationPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}

/// Dynamic Conveyor Motion Painter simulating belt rotation, chevron movement, and scanner sweep
class _ConveyorSimulationPainter extends CustomPainter {
  final double progress;
  final double speedMultiplier;

  _ConveyorSimulationPainter({
    required this.progress,
    required this.speedMultiplier,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final beltPaint = Paint()
      ..color = const Color(0x330057FF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    final centerY = size.height * 0.48;
    final startX = size.width * 0.22;
    final endX = size.width * 0.78;
    final beltWidth = endX - startX;

    const numChevrons = 6;
    for (int i = 0; i < numChevrons; i++) {
      final chevronOffset = ((i / numChevrons) + (progress * speedMultiplier)) % 1.0;
      final x = startX + (chevronOffset * beltWidth);

      final path = Path()
        ..moveTo(x - 8.0, centerY - 14.0)
        ..lineTo(x + 4.0, centerY)
        ..lineTo(x - 8.0, centerY + 14.0);

      canvas.drawPath(path, beltPaint);
    }

    final scannerX = size.width * 0.52;
    final sweepProgress = math.sin(progress * 2 * math.pi);
    final sweepOffset = sweepProgress * 18.0;

    final laserPaint = Paint()
      ..shader = const LinearGradient(
        colors: [
          Color(0x0000F5FF),
          Color(0xCC00F5FF),
          Color(0x0000F5FF),
        ],
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
      ).createShader(Rect.fromLTWH(scannerX + sweepOffset - 2.0, centerY - 25.0, 4.0, 50.0))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;

    canvas.drawLine(
      Offset(scannerX + sweepOffset, centerY - 25.0),
      Offset(scannerX + sweepOffset, centerY + 25.0),
      laserPaint,
    );

    final motorCenter = Offset(size.width * 0.20, centerY);
    final pulseRadius = 14.0 + (math.sin(progress * 4 * math.pi).abs() * 6.0);
    final motorHaloPaint = Paint()
      ..color = const Color(0x2200E676)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    canvas.drawCircle(motorCenter, pulseRadius, motorHaloPaint);
  }

  @override
  bool shouldRepaint(covariant _ConveyorSimulationPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}

/// Perspective Grid Painter for Industrial CAD Viewport
class _SimulationGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = AppColors.border.withValues(alpha: 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.5;

    const step = 28.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Custom painter for exploded pump schematic wireframe.
class _PumpSchematicPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.border
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final dashPaint = Paint()
      ..color = AppColors.onSurfaceVariant.withValues(alpha: 0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    final center = Offset(size.width * 0.5, size.height * 0.5);
    canvas.drawCircle(center, size.width * 0.35, paint);
    canvas.drawCircle(center, size.width * 0.22, paint);

    canvas.drawLine(
      Offset(size.width * 0.1, size.height * 0.5),
      Offset(size.width * 0.9, size.height * 0.5),
      dashPaint,
    );

    for (int i = 0; i < 4; i++) {
      final rect = Rect.fromCenter(
        center: center,
        width: size.width * 0.5,
        height: size.height * 0.5,
      );
      canvas.drawArc(rect, i * math.pi / 2, math.pi / 4, false, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}


/// Multi-layer custom painter rendering the dynamic simulation overlay for Fuji DRYPIX Smart (DRYPIX 6000)
class _DrypixSmartSimulationPainter extends CustomPainter {
  final double progress;
  final double speedMultiplier;
  final double explodedSeparation;

  _DrypixSmartSimulationPainter({
    required this.progress,
    required this.speedMultiplier,
    required this.explodedSeparation,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;

    // 1. Exploded view vector callout guidelines when explodedSeparation > 0
    if (explodedSeparation > 0.05) {
      final guidePaint = Paint()
        ..color = AppColors.primary.withValues(alpha: 0.35 * explodedSeparation)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2;

      // Top output tray exploded lift
      final topOffset = -45.0 * explodedSeparation;
      canvas.drawLine(
        Offset(cx - 80, cy - 90),
        Offset(cx - 80, cy - 90 + topOffset),
        guidePaint,
      );
      canvas.drawLine(
        Offset(cx + 80, cy - 90),
        Offset(cx + 80, cy - 90 + topOffset),
        guidePaint,
      );

      // Film trays exploded pull forward
      final drawerOffset = 40.0 * explodedSeparation;
      canvas.drawLine(
        Offset(cx - 70, cy + 90),
        Offset(cx - 70 - drawerOffset * 0.4, cy + 90 + drawerOffset * 0.7),
        guidePaint,
      );
    }

    // 2. Class 3B 659nm Laser Exposure Scanning Beam
    // The laser optical unit scans horizontally across the middle exposure chamber
    final laserY = cy - 20 + math.sin(progress * math.pi * 4 * speedMultiplier) * 15;
    final laserScanX = cx - 70 + ((progress * speedMultiplier * 3) % 1.0) * 140;

    final laserLinePaint = Paint()
      ..color = const Color(0xFFFF1744).withValues(alpha: 0.85)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    canvas.drawLine(
      Offset(cx - 75, laserY),
      Offset(cx + 75, laserY),
      laserLinePaint,
    );

    // Laser focal spot glow
    final laserGlowPaint = Paint()
      ..color = const Color(0xFFFF5252).withValues(alpha: 0.9)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5.0);
    canvas.drawCircle(Offset(laserScanX, laserY), 4.5, laserGlowPaint);

    // 3. Thermal Development Heat Drum Glow
    final drumCenter = Offset(cx + 10, cy + 25);
    final heatPulse = 0.5 + 0.5 * math.sin(progress * math.pi * 2 * speedMultiplier);
    final drumGlowPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFFFF9100).withValues(alpha: 0.45 * heatPulse),
          const Color(0xFFFF6D00).withValues(alpha: 0.15 * heatPulse),
          Colors.transparent,
        ],
        stops: const [0.0, 0.6, 1.0],
      ).createShader(Rect.fromCircle(center: drumCenter, radius: 48.0));
    canvas.drawCircle(drumCenter, 48.0, drumGlowPaint);

    // 4. Moving Diagnostic Film Sheet Flow
    // Sheet feeds from Film Tray 1 (cy + 100) -> Laser Scanning (cy - 20) -> Thermal Drum (cy + 25) -> Output Tray (cy - 110)
    final feedCycle = (progress * speedMultiplier) % 1.0;
    double filmY;
    double filmX;
    double filmWidth = 60.0;
    double filmHeight = 45.0;

    if (feedCycle < 0.4) {
      // Ascending from Tray 1 to laser
      final t = feedCycle / 0.4;
      filmX = cx - 30;
      filmY = (cy + 90) - t * 100;
    } else if (feedCycle < 0.75) {
      // Wrapping around thermal drum
      final t = (feedCycle - 0.4) / 0.35;
      final angle = math.pi * t;
      filmX = drumCenter.dx + math.cos(angle) * 20;
      filmY = drumCenter.dy - math.sin(angle) * 35;
    } else {
      // Ejecting to top output tray
      final t = (feedCycle - 0.75) / 0.25;
      filmX = cx - 20;
      filmY = (cy - 10) - t * 95;
    }

    final filmPaint = Paint()
      ..color = const Color(0x6600E5FF)
      ..style = PaintingStyle.fill;
    final filmBorder = Paint()
      ..color = const Color(0xFF00E5FF).withValues(alpha: 0.8)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    final filmRect = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset(filmX, filmY), width: filmWidth, height: filmHeight),
      const Radius.circular(3.0),
    );
    canvas.drawRRect(filmRect, filmPaint);
    canvas.drawRRect(filmRect, filmBorder);

    // 5. Operation Panel 7-Segment LED Simulation Bezel
    final panelRect = Rect.fromLTWH(cx + 42, cy - 100, 36, 16);
    canvas.drawRect(
      panelRect,
      Paint()..color = const Color(0xFF11161B),
    );
    canvas.drawRect(
      panelRect,
      Paint()
        ..color = const Color(0xFF263238)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.0,
    );

    // Draw active 3-digit status
    final textPainter = TextPainter(
      text: TextSpan(
        text: feedCycle > 0.85 ? '149' : 'Pro',
        style: const TextStyle(
          color: Color(0xFF00E676),
          fontSize: 9.0,
          fontWeight: FontWeight.bold,
          fontFamily: 'monospace',
          letterSpacing: 1.0,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(canvas, Offset(panelRect.left + 5, panelRect.top + 2));
  }

  @override
  bool shouldRepaint(covariant _DrypixSmartSimulationPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.speedMultiplier != speedMultiplier ||
        oldDelegate.explodedSeparation != explodedSeparation;
  }
}
