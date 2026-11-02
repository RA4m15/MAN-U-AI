import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/widgets/terminal_components.dart';
import '../../../auth/controllers/auth_controller.dart';
import '../../../auth/models/auth_state.dart';
import '../../controllers/chat_controller.dart';
import '../../controllers/conversation_controller.dart';
import '../../../tasks/controllers/task_controller.dart';
import '../../../tasks/views/tasks_screen.dart';

/// MAN-U-AI Modern Light Conversation Drawer
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
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(right: Radius.circular(24.0)),
        side: BorderSide(color: AppColors.border, width: 1.0),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drawer Header
            Padding(
              padding: const EdgeInsets.fromLTRB(18.0, 16.0, 18.0, 12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40.0,
                        height: 40.0,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(12.0),
                          border: Border.all(color: AppColors.border, width: 1.0),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 6.0,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Center(
                          child: Icon(
                            Icons.precision_manufacturing_rounded,
                            color: AppColors.primary,
                            size: 22.0,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12.0),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'MAN-U-AI',
                            style: AppTypography.headlineMd.copyWith(
                              fontSize: 16.0,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            'COPILOT SESSIONS',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                            ),
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
                    height: 46.0,
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
                    borderRadius: BorderRadius.circular(16.0),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(16.0),
                        border: Border.all(color: AppColors.border, width: 1.0),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.03),
                            blurRadius: 6.0,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(7.0),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceMuted,
                              borderRadius: BorderRadius.circular(10.0),
                            ),
                            child: const Icon(
                              Icons.assignment_outlined,
                              color: AppColors.primary,
                              size: 18.0,
                            ),
                          ),
                          const SizedBox(width: 12.0),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "TODAY'S SHIFT TASKS",
                                  style: AppTypography.bodyMd.copyWith(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
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
                              if (count <= 0) {
                                return const Icon(
                                  Icons.chevron_right_rounded,
                                  size: 18,
                                  color: AppColors.textMuted,
                                );
                              }
                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primaryAction,
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
              padding: EdgeInsets.symmetric(horizontal: 18.0),
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
                              size: 28.0, color: AppColors.textMuted),
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
                    padding: const EdgeInsets.symmetric(horizontal: 18.0, vertical: 4.0),
                    itemCount: conversations.length,
                    itemBuilder: (context, index) {
                      final conv = conversations[index];
                      final isSelected = conv.id == activeConvId;
                      final catColor = _getCategoricalColor(index);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8.0),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.surfaceAlt : AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(14.0),
                          border: Border.all(
                            color: isSelected ? AppColors.primary : AppColors.border,
                            width: isSelected ? 1.8 : 1.0,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.02),
                              blurRadius: 4.0,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(14.0),
                            onTap: () {
                              ref.read(chatControllerProvider.notifier).selectConversation(conv);
                              Navigator.of(context).pop();
                            },
                            child: Padding(
                              padding: const EdgeInsets.all(12.0),
                              child: Row(
                                children: [
                                  // Categorical Identity Dot inside tile
                                  Container(
                                    width: 34.0,
                                    height: 34.0,
                                    decoration: BoxDecoration(
                                      color: AppColors.surfaceMuted,
                                      borderRadius: BorderRadius.circular(10.0),
                                    ),
                                    child: Center(
                                      child: Container(
                                        width: 9.0,
                                        height: 9.0,
                                        decoration: BoxDecoration(
                                          color: catColor,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12.0),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          conv.title.isNotEmpty ? conv.title : 'UNTITLED SESSION',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: AppTypography.bodyMd.copyWith(
                                            fontSize: 13.0,
                                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                            color: AppColors.onSurface,
                                          ),
                                        ),
                                        const SizedBox(height: 2.0),
                                        Text(
                                          '${conv.equipmentName ?? "GENERAL"} // ${_formatTimestamp(conv.lastMessageAt ?? conv.createdAt)}',
                                          style: AppTypography.caption.copyWith(
                                            fontSize: 10.0,
                                            color: AppColors.onSurfaceVariant,
                                          ),
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
                    size: 42.0,
                    initial: currentUser?.name,
                  ),
                  const SizedBox(width: 12.0),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          currentUser?.name ?? 'OPERATOR',
                          style: AppTypography.bodyMd.copyWith(
                            fontSize: 13.0,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          (currentUser?.role ?? 'OPERATOR').toUpperCase(),
                          style: AppTypography.caption.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  ButtonIconTile(
                    key: const Key('drawer_settings_button'),
                    icon: Icons.settings_outlined,
                    size: 38.0,
                    iconColor: AppColors.onSurfaceVariant,
                    tooltip: 'Settings',
                    onPressed: () {
                      Navigator.of(context).pop();
                      context.push('/settings');
                    },
                  ),
                  const SizedBox(width: 8.0),
                  ButtonIconTile(
                    key: const Key('drawer_logout_button'),
                    icon: Icons.logout_rounded,
                    size: 38.0,
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
