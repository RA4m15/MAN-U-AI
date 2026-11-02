import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/controllers/auth_controller.dart';
import '../models/diagram_annotation_model.dart';

import '../../../core/storage/local_cache_service.dart';

final diagramRepositoryProvider = Provider<DiagramRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final cache = ref.watch(localCacheServiceProvider);
  return DiagramRepository(dio, cache: cache);
});

class DiagramRepository {
  final Dio _dio;
  final LocalCacheService? _cache;

  DiagramRepository(this._dio, {LocalCacheService? cache}) : _cache = cache;

  /// Default high-fidelity exploded pump fixture for offline & immediate demonstration
  static final DiagramAnnotationModel demoExplodedPumpDiagram = DiagramAnnotationModel(
    id: 'demo-pump-exploded',
    figureId: 'FIG-P102-EXPLODED',
    documentId: 'doc-sp102',
    documentTitle: 'Slurry Pump P-102 Maintenance & Rebuild Manual',
    page: 16,
    title: 'Slurry Pump P-102 Exploded Power End & Wet End Assembly',
    hotspots: const [
      DiagramHotspotModel(
        id: 'part-1',
        partNumber: 'SP-102-01',
        partName: 'Bearing Cartridge & Labyrinth Seals',
        boundingBox: [180, 120, 320, 290],
        manualPage: 14,
        description: 'Cast iron bearing housing with purge grease fittings and dual labyrinth seals.',
      ),
      DiagramHotspotModel(
        id: 'part-2',
        partNumber: 'SP-102-02',
        partName: 'Drive Shaft & Keyway Assembly',
        boundingBox: [220, 280, 340, 500],
        manualPage: 16,
        description: 'High-tensile forged steel shaft with precision ground bearing journals.',
      ),
      DiagramHotspotModel(
        id: 'part-3',
        partNumber: 'SP-102-03',
        partName: 'Mechanical Seal Cartridge (Primary Barrier)',
        boundingBox: [310, 480, 460, 620],
        manualPage: 22,
        description: 'Silicon carbide vs tungsten carbide cartridge seal assembly with viton O-rings.',
      ),
      DiagramHotspotModel(
        id: 'part-4',
        partNumber: 'SP-102-04',
        partName: 'Impeller Closed 4-Vane High Chrome',
        boundingBox: [420, 580, 620, 780],
        manualPage: 28,
        description: '28% high-chrome alloy abrasive slurry impeller with pump-out back vanes.',
      ),
      DiagramHotspotModel(
        id: 'part-5',
        partNumber: 'SP-102-05',
        partName: 'Throatbush & Suction Liner Assembly',
        boundingBox: [460, 720, 680, 880],
        manualPage: 31,
        description: 'Replaceable wear liner with tapered axial clearance adjustment screws.',
      ),
      DiagramHotspotModel(
        id: 'part-6',
        partNumber: 'SP-102-06',
        partName: 'Pump Casing Volute Half (Front / Suction)',
        boundingBox: [580, 520, 840, 890],
        manualPage: 34,
        description: 'Ductile iron split outer casing with 250 PSI rated flanged suction nozzle.',
      ),
    ],
  );

  /// Fuji DRYPIX Smart (DRYPIX 6000) component diagram fixture
  static final DiagramAnnotationModel drypixSmartDiagram = DiagramAnnotationModel(
    id: 'demo-drypix-6000',
    figureId: 'FIG-DRYPIX-6000',
    documentId: 'doc-drypix-6000',
    documentTitle: 'Fuji Medical Dry Laser Imager DRYPIX Smart Reference Guide',
    page: 30,
    title: 'Fuji DRYPIX Smart (DRYPIX 6000) Component Schematic & Functional Units',
    hotspots: const [
      DiagramHotspotModel(
        id: 'part-dp-1',
        partNumber: 'DP-6000-01',
        partName: 'Operation Panel & 3-Digit LED Display',
        boundingBox: [180, 520, 280, 780],
        manualPage: 32,
        description: 'Multi-function operator console with 3-digit LED indicator (888, Pro, oPn, PUL, U-0~U-7, 201-249 error codes), Enter button, Utility button, and Stand-by switch (Section 2.3.2).',
      ),
      DiagramHotspotModel(
        id: 'part-dp-2',
        partNumber: 'DP-6000-02',
        partName: 'Class 3B Semiconductor Laser Exposure Unit (659nm)',
        boundingBox: [260, 220, 420, 540],
        manualPage: 13,
        description: '659nm 130mW CW semiconductor laser recording optical unit scanning latent diagnostic images onto Fuji Medical Dry Laser Film DI-HL / DI-ML (Section 1.2 & 5.5.3).',
      ),
      DiagramHotspotModel(
        id: 'part-dp-3',
        partNumber: 'DP-6000-03',
        partName: 'Thermal Development Unit & Heated Processing Drum',
        boundingBox: [340, 200, 520, 620],
        manualPage: 66,
        description: 'Dry thermal processing section heating exposed film to develop high-contrast medical density without chemical wet baths. Caution: High Temperature Unit (Section 5.5.4).',
      ),
      DiagramHotspotModel(
        id: 'part-dp-4',
        partNumber: 'DP-6000-04',
        partName: 'Film Tray 1 (Upper Slot 1) & Light-Tight Shutter',
        boundingBox: [540, 240, 680, 720],
        manualPage: 35,
        description: 'Interlocked upper film cassette accommodating 14x17", 14x14", 10x14", 10x12", or 8x10" film packs. Requires shutter insertion to unlock for daylight exchange (Section 3.2).',
      ),
      DiagramHotspotModel(
        id: 'part-dp-5',
        partNumber: 'DP-6000-05',
        partName: 'Film Tray 2 (Lower Slot 2) & Cassette Lock',
        boundingBox: [680, 240, 820, 720],
        manualPage: 38,
        description: 'Secondary film cassette slot for dual-size continuous printing. Independently monitored by tray interlock sensors and remaining film counter 0-150 sheets (Section 3.3).',
      ),
      DiagramHotspotModel(
        id: 'part-dp-6',
        partNumber: 'DP-6000-06',
        partName: 'Sheet-Feeder Suction Cups & Conveyance Rollers',
        boundingBox: [440, 180, 600, 500],
        manualPage: 60,
        description: 'Precision sheet-feeder picking up individual dry film sheets using suction cups and feeding through sub-scanning rollers. Jam access through right-side conveyance cover (Section 5.5.1).',
      ),
      DiagramHotspotModel(
        id: 'part-dp-7',
        partNumber: 'DP-6000-07',
        partName: 'Top Output Film Stacking Tray',
        boundingBox: [80, 220, 200, 640],
        manualPage: 30,
        description: 'Curved top ejection receiver stacking up to 50 finished diagnostic dry laser films. Features auto-stop ejection sensor and discharge roller mechanism (Section 2.3.1 & 5.5.5).',
      ),
      DiagramHotspotModel(
        id: 'part-dp-8',
        partNumber: 'DP-6000-08',
        partName: 'Washable Conveyance Cleaning Roller & Air Filter',
        boundingBox: [420, 620, 580, 840],
        manualPage: 72,
        description: 'Removable silicone cleaning roller washed weekly with tap water and ethanol gauze to eliminate lint and prevent white blurred streaks on prints. 3-month washable air filter (Section 6.1.3).',
      ),
    ],
  );

  /// SimReady Conveyor Belt A61 component diagram fixture
  static final DiagramAnnotationModel conveyorBeltDiagram = DiagramAnnotationModel(
    id: 'demo-conveyor-belt-a61',
    figureId: 'FIG-CONVEYOR-BELT-A61',
    documentId: 'doc-cb-a61',
    documentTitle: 'SimReady Conveyor Belt A61 Operation & Maintenance Manual',
    page: 6,
    title: 'Conveyor Belt A61 Exploded Assembly & Component Diagram',
    hotspots: const [
      DiagramHotspotModel(
        id: 'part-cb-1',
        partNumber: 'CB-A61-01',
        partName: 'Conveyor Drive Motor & Gearbox Assembly',
        boundingBox: [260, 100, 440, 280],
        manualPage: 8,
        description: '480V 3-phase high-torque gearmotor drive unit with enclosed planetary reduction gearbox and direct drive sprocket.',
      ),
      DiagramHotspotModel(
        id: 'part-cb-2',
        partNumber: 'CB-A61-02',
        partName: 'Precision Machined Idler Roller Array (x36)',
        boundingBox: [340, 260, 500, 680],
        manualPage: 12,
        description: 'Array of 36 precision brushed aluminium idler rollers with double-sealed ABEC-5 bearings and low-friction center shafts.',
      ),
      DiagramHotspotModel(
        id: 'part-cb-3',
        partNumber: 'CB-A61-03',
        partName: 'High-Traction Vulcanized Conveyor Belt',
        boundingBox: [290, 220, 470, 780],
        manualPage: 15,
        description: 'Multi-ply polyester-nylon reinforced vulcanized synthetic rubber belt with chevron traction profile and vulcanized endless splice.',
      ),
      DiagramHotspotModel(
        id: 'part-cb-4',
        partNumber: 'CB-A61-04',
        partName: 'Optical Inspection Scanner & Vision Module',
        boundingBox: [140, 440, 310, 640],
        manualPage: 22,
        description: 'Integrated optical inspection scanning module with scratch-resistant acrylic protective shield, high-speed line scan sensors, and LED illumination.',
      ),
      DiagramHotspotModel(
        id: 'part-cb-5',
        partNumber: 'CB-A61-05',
        partName: 'Emergency Stop & Operator Pushbutton Console',
        boundingBox: [220, 720, 360, 880],
        manualPage: 5,
        description: 'Dual-channel safety rated latching mushroom E-Stop button with illuminated Jog/Start/Stop control switches in IP67 sealed enclosure.',
      ),
      DiagramHotspotModel(
        id: 'part-cb-6',
        partNumber: 'CB-A61-06',
        partName: 'Extruded Aluminum Load-Bearing Frame Rails',
        boundingBox: [460, 140, 680, 860],
        manualPage: 7,
        description: 'Anodized 80/20 extruded aluminum structural side rails with integrated T-slot mounting tracks, cross-braces, and vibration-damping leveling feet.',
      ),
      DiagramHotspotModel(
        id: 'part-cb-7',
        partNumber: 'CB-A61-07',
        partName: 'Pneumatic Automatic Belt Tensioner & Tracking Guide',
        boundingBox: [480, 740, 640, 920],
        manualPage: 19,
        description: 'Dual-cylinder pneumatic tensioning mechanism maintaining continuous 16.5 kN/m belt preload with auto-centering tracking rollers.',
      ),
    ],
  );

  /// SimReady Turbocompressor B01 component diagram fixture
  static final DiagramAnnotationModel turbocompressorDiagram = DiagramAnnotationModel(
    id: 'demo-turbocompressor-b01',
    figureId: 'FIG-TURBOCOMPRESSOR-B01',
    documentId: 'doc-tc-b01',
    documentTitle: 'SimReady Turbocompressor B01 Operation & Maintenance Manual',
    page: 12,
    title: 'Turbocompressor B01 Exploded Assembly & Component Diagram',
    hotspots: const [
      DiagramHotspotModel(
        id: 'part-tc-1',
        partNumber: 'TC-B01-01',
        partName: 'Cast Titanium Compressor Impeller Wheel',
        boundingBox: [280, 180, 460, 360],
        manualPage: 14,
        description: 'Precision CNC milled 5-axis aerospace titanium compressor impeller with backward-curved splitter blades rated to 65,000 RPM.',
      ),
      DiagramHotspotModel(
        id: 'part-tc-2',
        partNumber: 'TC-B01-02',
        partName: 'Involute Compressor Volute Casing & Diffuser',
        boundingBox: [200, 320, 520, 640],
        manualPage: 18,
        description: 'Ductile cast alloy scroll housing with vaned diffuser ring optimizing static pressure recovery up to 4.2:1 pressure ratio.',
      ),
      DiagramHotspotModel(
        id: 'part-tc-3',
        partNumber: 'TC-B01-03',
        partName: 'High-Speed Ceramic Journal & Thrust Bearings',
        boundingBox: [340, 420, 480, 560],
        manualPage: 24,
        description: 'Dual angular contact silicon nitride ceramic ball bearing cartridge with floating ring damper and pressurized oil lubrication.',
      ),
      DiagramHotspotModel(
        id: 'part-tc-4',
        partNumber: 'TC-B01-04',
        partName: 'Pneumatic Bypass Blow-Off Valve Actuator',
        boundingBox: [120, 520, 280, 720],
        manualPage: 9,
        description: 'High-response anti-surge recirculation bypass valve preventing aerodynamic blade stall during sudden throttle deceleration.',
      ),
      DiagramHotspotModel(
        id: 'part-tc-5',
        partNumber: 'TC-B01-05',
        partName: 'Center Housing & Oil Scavenge Passages',
        boundingBox: [360, 480, 540, 700],
        manualPage: 29,
        description: 'Water-cooled center bearing housing with integrated oil feed gallery and gravity drain scavenge port.',
      ),
      DiagramHotspotModel(
        id: 'part-tc-6',
        partNumber: 'TC-B01-06',
        partName: 'Radial Inflow Gas Turbine Wheel & Heat Shield',
        boundingBox: [300, 680, 500, 880],
        manualPage: 32,
        description: 'Inconel 713C high-temperature nickel superalloy radial turbine rotor designed for 950°C continuous exhaust inlet gas temperatures.',
      ),
    ],
  );

  /// Fetches diagram part annotations from API or falls back to demo fixture
  Future<DiagramAnnotationModel> getAnnotations(String figureId) async {
    try {
      final response = await _dio.get('/diagrams/$figureId');
      final data = response.data['data'] as Map<String, dynamic>;
      final model = DiagramAnnotationModel.fromJson(data);
      if (_cache != null) {
        await _cache.cacheDiagramAnnotation(figureId, model);
      }
      return model;
    } catch (_) {
      if (_cache != null) {
        final cached = await _cache.getCachedDiagramAnnotation(figureId);
        if (cached != null) return cached;
      }
      if (figureId.toUpperCase().contains('DRYPIX') || figureId.toUpperCase().contains('6000')) {
        return drypixSmartDiagram;
      }
      if (figureId.toUpperCase().contains('CONVEYOR') || figureId.toUpperCase().contains('A61')) {
        return conveyorBeltDiagram;
      }
      if (figureId.toUpperCase().contains('TURBO') ||
          figureId.toUpperCase().contains('COMPRESSOR') ||
          figureId.toUpperCase().contains('B01')) {
        return turbocompressorDiagram;
      }
      return demoExplodedPumpDiagram;
    }
  }

  /// Triggers Gemini Vision annotation on the diagram
  Future<DiagramAnnotationModel> annotateWithVision(String figureId) async {
    try {
      final response = await _dio.post('/diagrams/$figureId/annotate');
      final data = response.data['data'] as Map<String, dynamic>;
      return DiagramAnnotationModel.fromJson(data);
    } catch (_) {
      if (figureId.toUpperCase().contains('DRYPIX') || figureId.toUpperCase().contains('6000')) {
        return drypixSmartDiagram;
      }
      if (figureId.toUpperCase().contains('CONVEYOR') || figureId.toUpperCase().contains('A61')) {
        return conveyorBeltDiagram;
      }
      if (figureId.toUpperCase().contains('TURBO') ||
          figureId.toUpperCase().contains('COMPRESSOR') ||
          figureId.toUpperCase().contains('B01')) {
        return turbocompressorDiagram;
      }
      return demoExplodedPumpDiagram;
    }
  }
}

