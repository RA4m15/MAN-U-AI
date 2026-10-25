import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/controllers/auth_controller.dart';
import '../../../auth/models/auth_state.dart';
import '../../controllers/chat_controller.dart';
import '../../controllers/conversation_controller.dart';

class ConversationDrawer extends ConsumerWidget {
  const ConversationDrawer({super.key});

  String _formatTimestamp(DateTime? dt) {
    if (dt == null) return '';
    final now = DateTime.now();
    final difference = now.difference(dt);

    if (difference.inMinutes < 60) {
      final mins = difference.inMinutes;
      return mins <= 1 ? 'Just now' : '$mins mins ago';
    }
    if (difference.inHours < 24) {
      final hours = difference.inHours;
      return '$hours hr${hours > 1 ? 's' : ''} ago';
    }
    if (difference.inDays < 7) {
      final days = difference.inDays;
      return '$days day${days > 1 ? 's' : ''} ago';
    }
    return '${dt.month}/${dt.day}/${dt.year}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversationsAsync = ref.watch(conversationListProvider);
    final activeConvId = ref.watch(chatControllerProvider).activeConversation?.id;
    final authState = ref.watch(authControllerProvider);
    final currentUser = authState is Authenticated ? authState.user : null;

    return Drawer(
      backgroundColor: AppColors.surface1,
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
                        width: 32.0,
                        height: 32.0,
                        decoration: BoxDecoration(
                          color: AppColors.surface2,
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(color: AppColors.hairlineStrong),
                        ),
                        child: const Icon(
                          Icons.precision_manufacturing_rounded,
                          color: AppColors.primary,
                          size: 18.0,
                        ),
                      ),
                      const SizedBox(width: 10.0),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'MAN-U-AI',
                            style: TextStyle(
                              fontSize: 16.0,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink,
                              letterSpacing: -0.3,
                            ),
                          ),
                          Text(
                            'Consultation History',
                            style: TextStyle(
                              fontSize: 11.0,
                              color: AppColors.primaryHover,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 16.0),

                  // New Consultation Button
                  ElevatedButton.icon(
                    key: const Key('drawer_new_consultation_button'),
                    onPressed: () {
                      ref.read(chatControllerProvider.notifier).startNewConsultation();
                      Navigator.of(context).pop();
                    },
                    icon: const Icon(Icons.add_rounded, size: 18.0),
                    label: const Text('New Consultation'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 10.0),
                      textStyle: const TextStyle(fontSize: 13.0, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(color: AppColors.hairline, height: 1.0),

            // Conversation History List
            Expanded(
              child: conversationsAsync.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(strokeWidth: 2.0),
                ),
                error: (err, stack) => Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 28.0),
                      const SizedBox(height: 8.0),
                      Text(
                        'Failed to load history: $err',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.0),
                      ),
                      const SizedBox(height: 12.0),
                      OutlinedButton(
                        key: const Key('drawer_retry_history_button'),
                        onPressed: () => ref.read(conversationListProvider.notifier).refresh(),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
                data: (conversations) {
                  if (conversations.isEmpty) {
                    return const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.chat_bubble_outline_rounded,
                                color: AppColors.inkSubtle, size: 32.0),
                            SizedBox(height: 10.0),
                            Text(
                              'No past consultations',
                              style: TextStyle(
                                color: AppColors.ink,
                                fontSize: 13.0,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            SizedBox(height: 4.0),
                            Text(
                              'Start your first plant troubleshooting consultation above.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: AppColors.inkSubtle,
                                fontSize: 11.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 8.0),
                    itemCount: conversations.length,
                    itemBuilder: (context, index) {
                      final conv = conversations[index];
                      final isSelected = conv.id == activeConvId;

                      return Container(
                        key: Key('conversation_item_${conv.id}'),
                        margin: const EdgeInsets.only(bottom: 4.0),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppColors.surface3
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(
                            color: isSelected
                                ? AppColors.hairlineStrong
                                : Colors.transparent,
                          ),
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 2.0),
                          dense: true,
                          title: Text(
                            conv.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                              color: isSelected ? AppColors.ink : AppColors.inkMuted,
                            ),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (conv.equipmentName != null) ...[
                                const SizedBox(height: 2.0),
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.precision_manufacturing_rounded,
                                      size: 11.0,
                                      color: AppColors.primaryHover,
                                    ),
                                    const SizedBox(width: 4.0),
                                    Expanded(
                                      child: Text(
                                        conv.equipmentName!,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 10.5,
                                          color: AppColors.primaryHover,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                              const SizedBox(height: 2.0),
                              Text(
                                _formatTimestamp(conv.lastMessageAt ?? conv.createdAt),
                                style: const TextStyle(
                                  fontSize: 10.0,
                                  color: AppColors.inkSubtle,
                                ),
                              ),
                            ],
                          ),
                          onTap: () {
                            ref.read(chatControllerProvider.notifier).selectConversation(conv);
                            Navigator.of(context).pop();
                          },
                        ),
                      );
                    },
                  );
                },
              ),
            ),

            const Divider(color: AppColors.hairline, height: 1.0),

            // User Profile & Sign Out Footer
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 16.0,
                    backgroundColor: AppColors.surface3,
                    child: Text(
                      currentUser?.name.isNotEmpty == true
                          ? currentUser!.name[0].toUpperCase()
                          : 'U',
                      style: const TextStyle(
                        fontSize: 12.0,
                        fontWeight: FontWeight.bold,
                        color: AppColors.ink,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10.0),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          currentUser?.name ?? 'Facility Technician',
                          style: const TextStyle(
                            fontSize: 12.0,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          currentUser?.role == 'engineer' ? 'ENGINEER' : 'OPERATOR',
                          style: const TextStyle(
                            fontSize: 10.0,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primaryHover,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    key: const Key('drawer_logout_button'),
                    icon: const Icon(
                      Icons.logout_rounded,
                      size: 18.0,
                      color: AppColors.inkSubtle,
                    ),
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
