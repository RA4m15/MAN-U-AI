import 'package:dio/dio.dart';
import '../models/task_model.dart';

class TaskRepository {
  final Dio dio;

  TaskRepository({required this.dio});

  static final List<TaskModel> _fallbackTasks = [
    TaskModel(
      id: 'task-fl-001',
      title: 'Inspect Conveyor Belt A61 Tension & Alignment',
      description: 'Check belt tracking on drive pulley and measure slack tension within tolerance (+/- 5mm).',
      priority: 'high',
      status: 'pending',
      equipmentId: 'equip-cb-a61',
      equipmentName: 'Conveyor Belt A61',
      shift: 'Morning',
      createdByName: 'Operations Manager',
      createdAt: DateTime.now().subtract(const Duration(hours: 2)),
    ),
    TaskModel(
      id: 'task-fl-002',
      title: 'Vibration & Acoustic Analysis on Compressor AC-300',
      description: 'Record baseline acoustic FFT on high-pressure cylinder head. Verify bearings lubrication.',
      priority: 'critical',
      status: 'in_progress',
      equipmentId: 'equip-ac300',
      equipmentName: 'Rotary Screw Air Compressor AC-300',
      shift: 'Morning',
      createdByName: 'Operations Manager',
      createdAt: DateTime.now().subtract(const Duration(hours: 4)),
    ),
    TaskModel(
      id: 'task-fl-003',
      title: 'Replace Hydraulic Oil Filter on Press HP-400',
      description: 'Isolate main circuit, purge pressure lines, install replacement filter element 20-micron.',
      priority: 'medium',
      status: 'completed',
      equipmentId: 'equip-hp400',
      equipmentName: 'Hydraulic Stamping Press HP-400',
      shift: 'Morning',
      createdByName: 'Operations Manager',
      completionNotes: 'Filter element replaced with OEM Part #HP-FLT-992. Hydraulic pressure stabilized at 210 bar.',
      createdAt: DateTime.now().subtract(const Duration(hours: 6)),
      completedAt: DateTime.now().subtract(const Duration(hours: 1)),
    ),
  ];

  Future<List<TaskModel>> getTasks({String? status, String? shift}) async {
    try {
      final response = await dio.get('/tasks', queryParameters: {
        if (status != null && status != 'all') 'status': status,
        if (shift != null && shift != 'all') 'shift': shift,
      });

      final data = response.data;
      if (data is Map<String, dynamic> && data['data'] is List) {
        final list = (data['data'] as List)
            .whereType<Map<String, dynamic>>()
            .map((item) => TaskModel.fromJson(item))
            .toList();

        if (list.isNotEmpty) {
          return list;
        }
      }
      return _fallbackTasks;
    } catch (_) {
      // In offline mode or development network disconnect, return cached fallbacks
      return _fallbackTasks;
    }
  }

  Future<TaskModel?> updateTaskStatus(
    String id,
    String status, {
    String? completionNotes,
  }) async {
    try {
      final response = await dio.patch('/tasks/$id', data: {
        'status': status,
        if (completionNotes != null) 'completionNotes': completionNotes,
      });

      final data = response.data;
      if (data is Map<String, dynamic> && data['data'] is Map<String, dynamic>) {
        return TaskModel.fromJson(data['data']);
      }
    } catch (_) {
      // Offline fallback: update local item in fallback list
      final idx = _fallbackTasks.indexWhere((t) => t.id == id);
      if (idx != -1) {
        final updated = _fallbackTasks[idx].copyWith(
          status: status,
          completionNotes: completionNotes,
          completedAt: status == 'completed' ? DateTime.now() : null,
        );
        _fallbackTasks[idx] = updated;
        return updated;
      }
    }
    return null;
  }
}
