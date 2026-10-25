import 'package:dio/dio.dart';
import '../models/equipment_model.dart';

class EquipmentRepository {
  final Dio dio;

  EquipmentRepository({required this.dio});

  /// Fetches all registered plant equipment records.
  Future<List<EquipmentModel>> getEquipment() async {
    final response = await dio.get('/equipment');
    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is List) {
      return (data['data'] as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => EquipmentModel.fromJson(item))
          .toList();
    }
    return [];
  }
}
