import 'package:dio/dio.dart';
import '../../../core/storage/local_cache_service.dart';
import '../models/equipment_model.dart';
import '../../offline/models/area_pack_model.dart';

class EquipmentRepository {
  final Dio dio;
  final LocalCacheService? cache;

  EquipmentRepository({
    required this.dio,
    this.cache,
  });

  static const List<EquipmentModel> fallbackEquipment = [
    EquipmentModel(
      id: 'machine_001',
      name: 'Industrial Turbomachinery Assembly',
      type: 'Industrial rotating equipment',
      category: 'Industrial rotating equipment',
      model: 'ITA-9400-HD',
      manufacturer: 'Heavy Industrial Dynamics',
      location: 'Turbine Hall - Bay 4',
      serialNumber: 'TM-9400-882A',
      referenceImage: 'assets/images/machines/machine_turbomachinery.jpg',
      cadModel: CadModelInfo(available: false),
      documentation: [
        'Turbomachinery Assembly & Installation Manual',
        'Vibration Analysis & Rotor Alignment SOP',
      ],
    ),
    EquipmentModel(
      id: 'machine_002',
      name: 'CAT Generator Set',
      type: 'Power generation equipment',
      category: 'Power generation equipment',
      model: 'C32 ACERT',
      manufacturer: 'Caterpillar Inc.',
      location: 'Auxiliary Power Substation B',
      serialNumber: 'CAT-C32-7719B',
      referenceImage: 'assets/images/machines/machine_cat_generator.jpg',
      cadModel: CadModelInfo(available: false),
      documentation: [
        'CAT GenSet Operations & Commissioning Guide',
        'Diesel Engine Routine Maintenance Protocol',
      ],
    ),
    EquipmentModel(
      id: 'machine_003',
      name: 'Industrial Process Equipment Skid',
      type: 'Industrial process equipment',
      category: 'Industrial process equipment',
      model: 'PS-DUAL-STAGE-500',
      manufacturer: 'Process Plant Engineering Ltd.',
      location: 'Chemical Feed Facility - Unit 2',
      serialNumber: 'PS-500-449C',
      referenceImage: 'assets/images/machines/machine_process_skid.jpg',
      cadModel: CadModelInfo(available: false),
      documentation: [
        'Process Skid Piping & Instrumentation SOP',
        'Skid Pressure Relief & Fluid Isolation Procedures',
      ],
    ),
    EquipmentModel(
      id: 'machine_004',
      name: 'CNC Machining Center',
      type: 'Manufacturing equipment',
      category: 'Manufacturing equipment',
      model: 'VMC-5AX-PRO',
      manufacturer: 'Precision Machining Technologies',
      location: 'Precision Machine Shop - Cell 3',
      serialNumber: 'CNC-5AX-1024D',
      referenceImage: 'assets/images/machines/machine_cnc_center.jpg',
      cadModel: CadModelInfo(available: false),
      documentation: [
        'CNC 5-Axis Maintenance & Calibration SOP',
        'Spindle Drive & Tool Changer Alignment Manual',
      ],
    ),
    EquipmentModel(
      id: 'equip-drypix-6000',
      name: 'Fuji DRYPIX Smart (DRYPIX 6000)',
      type: 'Dry Laser Imager',
      category: 'Medical Imaging',
      model: 'DRYPIX Smart (DRYPIX 6000)',
      manufacturer: 'FUJIFILM Corporation',
      location: 'Imaging Suite 2 - Radiology',
      serialNumber: 'FX-6000-897N',
      referenceImage: 'assets/images/drypix_6000.png',
      cadModel: CadModelInfo(available: false),
      documentation: [
        'DRYPIX 6000 Operation & Maintenance Manual',
        'Laser Imager Optical Alignment Procedure',
      ],
    ),
    EquipmentModel(
      id: 'equip-cb-a61',
      name: 'Conveyor Belt A61',
      type: 'Modular Belt Conveyor',
      category: 'Material Handling',
      model: 'A61-SIMREADY-01',
      manufacturer: 'SimReady Systems',
      location: 'Packaging & Sortation Line 1',
      serialNumber: 'SR-CB-A61-2024',
      referenceImage: 'assets/images/conveyor_belt_a61.png',
      cadModel: CadModelInfo(
        available: true,
        format: 'STEP',
        version: '1.0',
        storageReference: '/cad/models/conveyor_a61.step',
      ),
      documentation: [
        'Conveyor Belt A61 Preventive Maintenance SOP',
        'Belt Tensioning & Alignment Guide',
      ],
    ),
    EquipmentModel(
      id: 'equip-p102',
      name: 'Centrifugal Slurry Pump P-102',
      type: 'Centrifugal Slurry Pump',
      category: 'Industrial rotating equipment',
      model: 'Warman AH 4/3',
      manufacturer: 'Flowserve',
      location: 'Line 1 - Slurry Preparation',
      serialNumber: 'FS-2023-9981',
      cadModel: CadModelInfo(
        available: true,
        format: 'STEP',
        version: '1.0',
        storageReference: '/cad/models/slurry_pump_p102.step',
      ),
      documentation: [
        'Centrifugal Slurry Pump Overhaul Guide',
        'Mechanical Seal Replacement Procedure',
      ],
    ),
    EquipmentModel(
      id: 'equip-hp400',
      name: 'Hydraulic Stamping Press HP-400',
      type: 'Hydraulic Press',
      category: 'Manufacturing equipment',
      model: 'Schuler 400-T',
      manufacturer: 'Schuler Pressen',
      location: 'Line 3 - Main Fabrication',
      serialNumber: 'SC-400-091',
    ),
    EquipmentModel(
      id: 'equip-ac300',
      name: 'Rotary Screw Air Compressor AC-300',
      type: 'Air Compressor',
      category: 'Utility Equipment',
      model: 'Atlas Copco GA-90+',
      manufacturer: 'Atlas Copco',
      location: 'Utility Room B',
      serialNumber: 'AC-8812-B',
    ),
  ];

  /// Fetches all registered plant equipment records with local cache support.
  Future<List<EquipmentModel>> getEquipment() async {
    try {
      final response = await dio.get('/equipment');
      final data = response.data;
      if (data is Map<String, dynamic> && data['data'] is List) {
        final list = (data['data'] as List)
            .whereType<Map<String, dynamic>>()
            .map((item) => EquipmentModel.fromJson(item))
            .toList();
        if (list.isNotEmpty) {
          // Ensure all 4 catalog machines are present
          for (final machine in fallbackEquipment.take(4)) {
            if (!list.any((e) => e.id == machine.id)) {
              list.add(machine);
            }
          }
          if (cache != null) {
            await cache!.cacheEquipment(list);
          }
          return list;
        }
      }
      return await _getCachedOrFallback();
    } catch (_) {
      return await _getCachedOrFallback();
    }
  }

  Future<List<EquipmentModel>> _getCachedOrFallback() async {
    if (cache != null) {
      final cached = await cache!.getCachedEquipment();
      if (cached.isNotEmpty) {
        return cached;
      }
    }
    return fallbackEquipment;
  }

  /// Fetches offline documentation area pack for dead-zone plant operation.
  Future<AreaPackModel> getOfflinePack(String equipmentId) async {
    final response = await dio.get('/equipment/$equipmentId/offline-pack');
    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is Map<String, dynamic>) {
      return AreaPackModel.fromJson(data['data'] as Map<String, dynamic>);
    }
    throw Exception('Failed to load offline area pack');
  }
}
