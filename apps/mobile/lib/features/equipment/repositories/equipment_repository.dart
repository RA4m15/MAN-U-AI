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
      id: 'equip-drypix-6000',
      name: 'Fuji DRYPIX Smart (DRYPIX 6000)',
      type: 'Dry Laser Imager',
      model: 'DRYPIX Smart (DRYPIX 6000)',
      manufacturer: 'FUJIFILM Corporation',
      location: 'Imaging Suite 2 - Radiology',
      serialNumber: 'FX-6000-897N',
    ),
    EquipmentModel(
      id: 'equip-cb-a61',
      name: 'Conveyor Belt A61',
      type: 'Modular Belt Conveyor',
      model: 'A61-SIMREADY-01',
      manufacturer: 'SimReady Systems',
      location: 'Packaging & Sortation Line 1',
      serialNumber: 'SR-CB-A61-2024',
    ),
    EquipmentModel(
      id: 'equip-p102',
      name: 'Centrifugal Slurry Pump P-102',
      type: 'Centrifugal Slurry Pump',
      model: 'Warman AH 4/3',
      manufacturer: 'Flowserve',
      location: 'Line 1 - Slurry Preparation',
      serialNumber: 'FS-2023-9981',
    ),
    EquipmentModel(
      id: 'equip-hp400',
      name: 'Hydraulic Stamping Press HP-400',
      type: 'Hydraulic Press',
      model: 'Schuler 400-T',
      manufacturer: 'Schuler Pressen',
      location: 'Line 3 - Main Fabrication',
      serialNumber: 'SC-400-091',
    ),
    EquipmentModel(
      id: 'equip-ac300',
      name: 'Rotary Screw Air Compressor AC-300',
      type: 'Air Compressor',
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
          // Ensure DRYPIX Smart and Conveyor Belt A61 are present
          if (!list.any((e) => e.id == 'equip-drypix-6000')) {
            list.insert(0, fallbackEquipment[0]);
          }
          if (!list.any((e) => e.id == 'equip-cb-a61')) {
            list.insert(1, fallbackEquipment[1]);
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
