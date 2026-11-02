import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/widgets/terminal_components.dart';
import '../controllers/task_controller.dart';
import '../models/task_model.dart';

class TasksScreen extends ConsumerStatefulWidget {
  final void Function(String prompt, String? equipmentId)? onConsultCopilot;

  const TasksScreen({super.key, this.onConsultCopilot});

  @override
  ConsumerState<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends ConsumerState<TasksScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showCompleteDialog(TaskModel task) {
    final notesController = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          top: 20,
          left: 20,
          right: 20,
        ),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          border: Border(
            top: BorderSide(color: AppColors.border, width: 1),
            left: BorderSide(color: AppColors.border, width: 1),
            right: BorderSide(color: AppColors.border, width: 1),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const SectionHeader(
                  title: 'LOG TASK COMPLETION',
                  padding: EdgeInsets.zero,
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.onSurfaceVariant, size: 20),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              task.title,
              style: AppTypography.bodyMd.copyWith(color: AppColors.onSurface),
            ),
            const SizedBox(height: 16),
            Text(
              'ENGINEER COMPLETION NOTES & MEASUREMENTS',
              style: AppTypography.bodyMd.copyWith(
                fontSize: 11,
                color: AppColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: notesController,
              maxLines: 4,
              style: AppTypography.bodyMdRegular.copyWith(color: AppColors.onSurface),
              decoration: InputDecoration(
                hintText: 'Enter replacement part IDs, torque/pressure values, or remarks...',
                hintStyle: AppTypography.bodyMdRegular.copyWith(
                  color: AppColors.onSurfaceVariant.withValues(alpha: 0.6),
                  fontSize: 12,
                ),
                filled: true,
                fillColor: AppColors.surfaceMuted,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.primary),
                ),
              ),
            ),
            const SizedBox(height: 20),
            MachinedPrimaryButton(
              label: 'SUBMIT COMPLETION RECORD',
              icon: Icons.check_circle_outline,
              onPressed: () async {
                final notes = notesController.text.trim();
                Navigator.pop(ctx);
                await ref
                    .read(taskControllerProvider.notifier)
                    .completeTask(task.id, notes: notes.isEmpty ? 'Completed by field engineer.' : notes);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      backgroundColor: AppColors.surfaceAlt,
                      content: Text(
                        'Task marked as completed.',
                        style: AppTypography.bodyMd.copyWith(color: AppColors.success),
                      ),
                    ),
                  );
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPriorityBadge(String priority) {
    Color bg;
    Color fg;
    String label;
    IconData icon;

    switch (priority.toLowerCase()) {
      case 'critical':
        bg = AppColors.error.withValues(alpha: 0.15);
        fg = AppColors.error;
        label = 'CRITICAL';
        icon = Icons.warning_amber_rounded;
        break;
      case 'high':
        bg = AppColors.warning.withValues(alpha: 0.15);
        fg = AppColors.warning;
        label = 'HIGH';
        icon = Icons.priority_high;
        break;
      case 'low':
        bg = AppColors.onSurfaceVariant.withValues(alpha: 0.15);
        fg = AppColors.onSurfaceVariant;
        label = 'LOW';
        icon = Icons.arrow_downward;
        break;
      default:
        bg = AppColors.primary.withValues(alpha: 0.15);
        fg = AppColors.primaryHover;
        label = 'MEDIUM';
        icon = Icons.bolt;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: fg.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: fg),
          const SizedBox(width: 4),
          Text(
            label,
            style: AppTypography.bodyMd.copyWith(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTaskCard(TaskModel task) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: task.isInProgress
              ? AppColors.primary
              : AppColors.border,
          width: task.isInProgress ? 1.5 : 1.0,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top meta bar
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildPriorityBadge(task.priority),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: task.isCompleted
                      ? AppColors.success.withValues(alpha: 0.15)
                      : task.isInProgress
                          ? AppColors.primary.withValues(alpha: 0.15)
                          : AppColors.warning.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  task.isCompleted
                      ? 'COMPLETED'
                      : task.isInProgress
                          ? 'IN PROGRESS'
                          : 'PENDING',
                  style: AppTypography.bodyMd.copyWith(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: task.isCompleted
                        ? AppColors.success
                        : task.isInProgress
                            ? AppColors.primaryHover
                            : AppColors.warning,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Title
          Text(
            task.title,
            style: AppTypography.headlineMd.copyWith(
              fontSize: 15,
              color: AppColors.onSurface,
            ),
          ),
          const SizedBox(height: 6),

          // Description
          Text(
            task.description,
            style: AppTypography.bodyMdRegular.copyWith(
              fontSize: 12,
              color: AppColors.onSurfaceVariant,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 12),

          // Equipment & Shift tags
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              if (task.equipmentName != null && task.equipmentName!.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primarySubtle.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: AppColors.primaryMuted.withValues(alpha: 0.5)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.precision_manufacturing, size: 12, color: AppColors.primaryHover),
                      const SizedBox(width: 4),
                      Text(
                        task.equipmentName!,
                        style: AppTypography.bodyMd.copyWith(
                          fontSize: 11,
                          color: AppColors.primaryHover,
                        ),
                      ),
                    ],
                  ),
                ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.schedule, size: 12, color: AppColors.onSurfaceVariant),
                    const SizedBox(width: 4),
                    Text(
                      '${task.shift} Shift',
                      style: AppTypography.bodyMdRegular.copyWith(
                        fontSize: 11,
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          if (task.completionNotes != null && task.completionNotes!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.success.withValues(alpha: 0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'COMPLETION RECORD',
                    style: AppTypography.bodyMd.copyWith(
                      fontSize: 10,
                      color: AppColors.success,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    task.completionNotes!,
                    style: AppTypography.bodyMdRegular.copyWith(
                      fontSize: 11,
                      color: AppColors.onSurface,
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 14),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 12),

          // Actions
          Row(
            children: [
              // Consult AI Copilot
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primaryHover,
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                  ),
                  icon: const Icon(Icons.smart_toy_outlined, size: 14),
                  label: Text(
                    'ASK COPILOT',
                    style: AppTypography.bodyMd.copyWith(fontSize: 11),
                  ),
                  onPressed: () {
                    final prompt = 'I am working on the floor task: "${task.title}". Instructions: "${task.description}". What SOPs, safety precautions, or troubleshooting steps should I follow?';
                    if (widget.onConsultCopilot != null) {
                      widget.onConsultCopilot!(prompt, task.equipmentId);
                      Navigator.pop(context);
                    } else {
                      Navigator.pop(context, {'prompt': prompt, 'equipmentId': task.equipmentId});
                    }
                  },
                ),
              ),
              const SizedBox(width: 8),

              // Status progression buttons
              if (task.isPending) ...[
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primarySubtle,
                      foregroundColor: AppColors.onPrimary,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                    ),
                    icon: const Icon(Icons.play_arrow, size: 14),
                    label: Text(
                      'START TASK',
                      style: AppTypography.bodyMd.copyWith(fontSize: 11),
                    ),
                    onPressed: () async {
                      await ref
                          .read(taskControllerProvider.notifier)
                          .startTask(task.id);
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            backgroundColor: AppColors.surfaceAlt,
                            content: Text(
                              'Task started.',
                              style: AppTypography.bodyMd.copyWith(color: AppColors.primaryHover),
                            ),
                          ),
                        );
                      }
                    },
                  ),
                ),
              ] else if (task.isInProgress) ...[
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.success.withValues(alpha: 0.2),
                      foregroundColor: AppColors.success,
                      side: const BorderSide(color: AppColors.success),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                    ),
                    icon: const Icon(Icons.check, size: 14),
                    label: Text(
                      'COMPLETE',
                      style: AppTypography.bodyMd.copyWith(fontSize: 11),
                    ),
                    onPressed: () => _showCompleteDialog(task),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tasksAsync = ref.watch(taskControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            Container(
              width: 4,
              height: 16,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              "TODAY'S SHIFT TASKS",
              style: AppTypography.headlineMd.copyWith(fontSize: 15),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.onSurfaceVariant),
            onPressed: () => ref.read(taskControllerProvider.notifier).refresh(),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          indicatorWeight: 2,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.onSurfaceVariant,
          labelStyle: AppTypography.bodyMd.copyWith(fontSize: 12),
          tabs: [
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('ACTIVE TASKS'),
                  const SizedBox(width: 6),
                  tasksAsync.maybeWhen(
                    data: (tasks) {
                      final count = tasks.where((t) => !t.isCompleted).length;
                      return count > 0
                          ? Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '$count',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            )
                          : const SizedBox.shrink();
                    },
                    orElse: () => const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('COMPLETED'),
                  const SizedBox(width: 6),
                  tasksAsync.maybeWhen(
                    data: (tasks) {
                      final count = tasks.where((t) => t.isCompleted).length;
                      return count > 0
                          ? Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceMuted,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '$count',
                                style: const TextStyle(
                                  color: AppColors.onSurfaceVariant,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            )
                          : const SizedBox.shrink();
                    },
                    orElse: () => const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: tasksAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (err, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 36),
              const SizedBox(height: 12),
              Text(
                'Failed to load shift tasks',
                style: AppTypography.bodyMd.copyWith(color: AppColors.onSurface),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => ref.read(taskControllerProvider.notifier).refresh(),
                child: const Text('RETRY'),
              ),
            ],
          ),
        ),
        data: (tasks) {
          final activeTasks = tasks.where((t) => !t.isCompleted).toList();
          final completedTasks = tasks.where((t) => t.isCompleted).toList();

          return TabBarView(
            controller: _tabController,
            children: [
              // Active Tasks Tab
              RefreshIndicator(
                onRefresh: () => ref.read(taskControllerProvider.notifier).refresh(),
                color: AppColors.primary,
                backgroundColor: AppColors.surfaceAlt,
                child: activeTasks.isEmpty
                    ? ListView(
                        children: [
                          const SizedBox(height: 80),
                          Center(
                            child: Column(
                              children: [
                                Icon(
                                  Icons.assignment_turned_in_outlined,
                                  size: 48,
                                  color: AppColors.onSurfaceVariant.withValues(alpha: 0.5),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'NO ACTIVE FLOOR TASKS',
                                  style: AppTypography.headlineMd.copyWith(
                                    fontSize: 14,
                                    color: AppColors.onSurfaceVariant,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'All assigned shift directives have been addressed.',
                                  style: AppTypography.bodyMdRegular.copyWith(
                                    fontSize: 12,
                                    color: AppColors.onSurfaceVariant.withValues(alpha: 0.7),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      )
                    : ListView.builder(
                        itemCount: activeTasks.length,
                        itemBuilder: (ctx, idx) => _buildTaskCard(activeTasks[idx]),
                      ),
              ),

              // Completed Tab
              RefreshIndicator(
                onRefresh: () => ref.read(taskControllerProvider.notifier).refresh(),
                color: AppColors.primary,
                backgroundColor: AppColors.surfaceAlt,
                child: completedTasks.isEmpty
                    ? ListView(
                        children: [
                          const SizedBox(height: 80),
                          Center(
                            child: Column(
                              children: [
                                Icon(
                                  Icons.checklist,
                                  size: 48,
                                  color: AppColors.onSurfaceVariant.withValues(alpha: 0.5),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'NO COMPLETED TASKS TODAY',
                                  style: AppTypography.headlineMd.copyWith(
                                    fontSize: 14,
                                    color: AppColors.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      )
                    : ListView.builder(
                        itemCount: completedTasks.length,
                        itemBuilder: (ctx, idx) => _buildTaskCard(completedTasks[idx]),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

