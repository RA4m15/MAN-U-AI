import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/controllers/auth_controller.dart';
import '../models/task_model.dart';
import '../repositories/task_repository.dart';

final taskRepositoryProvider = Provider<TaskRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return TaskRepository(dio: dio);
});

final taskControllerProvider =
    AsyncNotifierProvider<TaskController, List<TaskModel>>(() {
  return TaskController();
});

class TaskController extends AsyncNotifier<List<TaskModel>> {
  @override
  Future<List<TaskModel>> build() async {
    return _fetchTasks();
  }

  Future<List<TaskModel>> _fetchTasks() async {
    final repo = ref.read(taskRepositoryProvider);
    return await repo.getTasks();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchTasks());
  }

  Future<bool> startTask(String taskId) async {
    final repo = ref.read(taskRepositoryProvider);
    final updated = await repo.updateTaskStatus(taskId, 'in_progress');
    if (updated != null) {
      state = state.whenData((tasks) {
        return tasks.map((t) => t.id == taskId ? updated : t).toList();
      });
      return true;
    }
    return false;
  }

  Future<bool> completeTask(String taskId, {String? notes}) async {
    final repo = ref.read(taskRepositoryProvider);
    final updated = await repo.updateTaskStatus(taskId, 'completed', completionNotes: notes);
    if (updated != null) {
      state = state.whenData((tasks) {
        return tasks.map((t) => t.id == taskId ? updated : t).toList();
      });
      return true;
    }
    return false;
  }
}

final activeTasksCountProvider = Provider<int>((ref) {
  final tasksState = ref.watch(taskControllerProvider);
  return tasksState.maybeWhen(
    data: (tasks) => tasks.where((t) => t.isPending || t.isInProgress).length,
    orElse: () => 0,
  );
});

