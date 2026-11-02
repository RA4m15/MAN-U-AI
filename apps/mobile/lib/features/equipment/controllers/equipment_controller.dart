import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/storage/local_cache_service.dart';
import '../../auth/controllers/auth_controller.dart';
import '../models/equipment_model.dart';
import '../repositories/equipment_repository.dart';

final equipmentRepositoryProvider = Provider<EquipmentRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final cache = ref.watch(localCacheServiceProvider);
  return EquipmentRepository(dio: dio, cache: cache);
});

final equipmentListProvider =
    FutureProvider.autoDispose<List<EquipmentModel>>((ref) async {
  final repo = ref.watch(equipmentRepositoryProvider);
  return await repo.getEquipment();
});
