import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/widgets/terminal_components.dart';
import '../../../auth/controllers/auth_controller.dart';
import '../../../auth/models/auth_state.dart';
import '../../controllers/chat_controller.dart';
import '../../controllers/conversation_controller.dart';
import '../../../tasks/controllers/task_controller.dart';
import '../../../tasks/views/tasks_screen.dart';

/// Terminal Cobalt Mobile Conversation Drawer
/// Operational telemetry panel for navigating past diagnostic logs.
class ConversationDrawer extends ConsumerWidget {
  const ConversationDrawer({super.key});

  String _formatTimestamp(DateTime? dt) {
    if (dt == null) return '';
    final now = DateTime.now();
    final difference = now.difference(dt);

    if (difference.inMinutes < 60) {
      final mins = difference.inMinutes;
      return mins <= 1 ? 'JUST NOW' : '$mins MINS AGO';
    }
    if (difference.inHours < 24) {
      final hours = difference.inHours;
      return '$hours HR${hours > 1 ? 'S' : ''} AGO';
    }
    if (difference.inDays < 7) {
      final days = difference.inDays;
      return '$days DAY${days > 1 ? 'S' : ''} AGO';
    }
    return '${dt.month}/${dt.day}/${dt.year}';
  }

  Color _getCategoricalColor(int index) {
    const palette = [
      AppColors.accentCategorical1,
      AppColors.accentCategorical2,
      AppColors.accentCategorical3,
      AppColors.accentCategorical4,
      AppColors.accentCategorical5,
      AppColors.accentCategorical6,
    ];
    return palette[index % palette.length];
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversationsAsync = ref.watch(conversationListProvider);
    final activeConvId = ref.watch(chatControllerProvider).activeConversation?.id;
    final authState = ref.watch(authControllerProvider);
    final currentUser = authState is Authenticated ? authState.user : null;

    return Drawer(
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.zero,
        side: BorderSide(color: AppColors.border, width: 1.0),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drawer Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 36.0,
                        height: 36.0,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(color: AppColors.primary, width: 2.0),
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.bolt_rounded,
                            color: AppColors.primary,
                            size: 20.0,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10.0),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'MAN-U-AI',
                            style: AppTypography.headlineMd.copyWith(fontSize: 16.0),
                          ),
                          Text(
                            'TELEMETRY LOGS',
                            style: AppTypography.caption.copyWith(color: AppColors.primary),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 16.0),

                  // Start New Consultation Button
                  MachinedPrimaryButton(
                    buttonKey: const Key('drawer_new_consultation_button'),
                    label: 'NEW CONSULTATION',
                    height: 44.0,
                    icon: Icons.add_rounded,
                    onPressed: () {
                      ref.read(chatControllerProvider.notifier).startNewConsultation();
                      Navigator.of(context).pop();
                    },
                  ),
                  const SizedBox(height: 10.0),
                  // Today's Shift Tasks Card
                  InkWell(
                    key: const Key('drawer_shift_tasks_button'),
                    onTap: () {
                      Navigator.of(context).pop();
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => TasksScreen(
                            onConsultCopilot: (prompt, _) {
                              ref.read(chatControllerProvider.notifier).sendMessage(prompt);
                            },
                          ),
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(8.0),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(8.0),
                        border: Border.all(color: AppColors.primary, width: 1.2),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6.0),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6.0),
                            ),
                            child: const Icon(Icons.assignment_outlined, color: AppColors.primaryHover, size: 18.0),
                          ),
                          const SizedBox(width: 10.0),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "TODAY'S SHIFT TASKS",
                                  style: AppTypography.bodyMd.copyWith(
                                    fontSize: 12.0,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.onSurface,
                                  ),
                                ),
                                Text(
                                  'Floor maintenance & checklist',
                                  style: AppTypography.caption.copyWith(
                                    fontSize: 10.0,
                                    color: AppColors.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Consumer(
                            builder: (ctx, r, _) {
                              final count = r.watch(activeTasksCountProvider);
                              if (count <= 0) return const Icon(Icons.chevron_right, size: 18, color: AppColors.onSurfaceVariant);
                              return Container(
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
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.0),
              child: SectionHeader(
                title: 'CONSULTATION SESSIONS',
                padding: EdgeInsets.symmetric(vertical: 8.0),
              ),
            ),

            // Conversation List
            Expanded(
              child: conversationsAsync.when(
                loading: () => const Center(
                  child: SizedBox(
                    width: 20.0,
                    height: 20.0,
                    child: CircularProgressIndicator(strokeWidth: 2.0),
                  ),
                ),
                error: (err, _) => Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline_rounded,
                          color: AppColors.error, size: 28.0),
                      const SizedBox(height: 8.0),
                      Text(
                        'COULD NOT LOAD SESSIONS',
                        style: AppTypography.caption.copyWith(color: AppColors.error),
                      ),
                      const SizedBox(height: 10.0),
                      SecondaryButton(
                        label: 'RETRY',
                        height: 36.0,
                        onPressed: () => ref.refresh(conversationListProvider),
                      ),
                    ],
                  ),
                ),
                data: (conversations) {
                  if (conversations.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.chat_bubble_outline_rounded,
                              size: 28.0, color: AppColors.onSurfaceVariant),
                          const SizedBox(height: 8.0),
                          Text(
                            'NO PRIOR SESSIONS LOGGED',
                            style: AppTypography.caption,
                          ),
                        ],
                      ),
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
                    itemCount: conversations.length,
                    itemBuilder: (context, index) {
                      final conv = conversations[index];
                      final isSelected = conv.id == activeConvId;
                      final catColor = _getCategoricalColor(index);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8.0),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.surfaceMuted : AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(
                            color: isSelected ? AppColors.primary : AppColors.border,
                            width: 1.0,
                          ),
                        ),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(8.0),
                            onTap: () {
                              ref.read(chatControllerProvider.notifier).selectConversation(conv);
                              Navigator.of(context).pop();
                            },
                            child: Padding(
                              padding: const EdgeInsets.all(12.0),
                              child: Row(
                                children: [
                                  // Categorical Identity Dot inside 32px tile
                                  Container(
                                    width: 32.0,
                                    height: 32.0,
                                    decoration: BoxDecoration(
                                      color: AppColors.surface,
                                      borderRadius: BorderRadius.circular(6.0),
                                      border: Border.all(color: AppColors.border, width: 1.0),
                                    ),
                                    child: Center(
                                      child: Container(
                                        width: 8.0,
                                        height: 8.0,
                                        decoration: BoxDecoration(
                                          color: catColor,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10.0),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          conv.title.isNotEmpty ? conv.title : 'UNTITLED SESSION',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: AppTypography.bodyMd.copyWith(
                                            fontSize: 12.5,
                                            color: isSelected ? Colors.white : AppColors.onSurface,
                                          ),
                                        ),
                                        const SizedBox(height: 2.0),
                                        Text(
                                          '${conv.equipmentName ?? "GENERAL"} // ${_formatTimestamp(conv.lastMessageAt ?? conv.createdAt)}',
                                          style: AppTypography.caption,
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (isSelected)
                                    const StatusDot(color: AppColors.primary, size: 8.0),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),

            const Divider(color: AppColors.border, height: 1.0),

            // User Profile & Sign Out Footer
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  SquareAvatar(
                    size: 40.0,
                    initial: currentUser?.name,
                  ),
                  const SizedBox(width: 10.0),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          currentUser?.name ?? 'OPERATOR',
                          style: AppTypography.bodyMd.copyWith(fontSize: 12.5),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          (currentUser?.role ?? 'VIEWER').toUpperCase(),
                          style: AppTypography.caption.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  ButtonIconTile(
                    key: const Key('drawer_logout_button'),
                    icon: Icons.logout_rounded,
                    size: 36.0,
                    iconColor: AppColors.error,
                    tooltip: 'Sign out',
                    onPressed: () {
                      ref.read(authControllerProvider.notifier).logout();
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
