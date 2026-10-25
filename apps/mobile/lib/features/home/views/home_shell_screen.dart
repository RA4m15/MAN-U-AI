import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../auth/models/auth_state.dart';

class HomeShellScreen extends ConsumerWidget {
  const HomeShellScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final user = authState is Authenticated ? authState.user : null;

    final roleColor = switch (user?.role) {
      'admin' => AppColors.primary,
      'engineer' => AppColors.success,
      _ => AppColors.inkSubtle,
    };

    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6.0),
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(6.0),
                border: Border.all(color: AppColors.hairline),
              ),
              child: const Icon(
                Icons.precision_manufacturing_rounded,
                color: AppColors.primary,
                size: 18.0,
              ),
            ),
            const SizedBox(width: 10.0),
            const Text('MAN-U-AI Copilot'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.inkSubtle),
            tooltip: 'Sign out',
            onPressed: () {
              ref.read(authControllerProvider.notifier).logout();
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // User Identity Card
              Container(
                padding: const EdgeInsets.all(18.0),
                decoration: BoxDecoration(
                  color: AppColors.surface1,
                  borderRadius: BorderRadius.circular(10.0),
                  border: Border.all(color: AppColors.hairline),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 24.0,
                      backgroundColor: AppColors.surface3,
                      child: Text(
                        (user?.name.isNotEmpty ?? false) ? user!.name[0].toUpperCase() : 'U',
                        style: const TextStyle(
                          color: AppColors.ink,
                          fontWeight: FontWeight.w700,
                          fontSize: 18.0,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14.0),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user?.name ?? 'Personnel User',
                            style: const TextStyle(
                              color: AppColors.ink,
                              fontWeight: FontWeight.w600,
                              fontSize: 16.0,
                            ),
                          ),
                          const SizedBox(height: 3.0),
                          Text(
                            user?.email ?? '',
                            style: const TextStyle(
                              color: AppColors.inkSubtle,
                              fontSize: 13.0,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
                      decoration: BoxDecoration(
                        color: roleColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20.0),
                        border: Border.all(color: roleColor.withValues(alpha: 0.4)),
                      ),
                      child: Text(
                        (user?.role ?? 'viewer').toUpperCase(),
                        style: TextStyle(
                          color: roleColor,
                          fontSize: 11.0,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24.0),

              // Milestone 19.2 Readiness Card
              Container(
                padding: const EdgeInsets.all(18.0),
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(10.0),
                  border: Border.all(color: AppColors.hairlineStrong),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: const [
                        Icon(
                          Icons.check_circle_outline_rounded,
                          color: AppColors.success,
                          size: 20.0,
                        ),
                        SizedBox(width: 8.0),
                        Text(
                          'Mobile Foundation & Session Active',
                          style: TextStyle(
                            color: AppColors.ink,
                            fontWeight: FontWeight.w600,
                            fontSize: 14.0,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10.0),
                    const Text(
                      'Authentication token successfully verified against backend /auth/me. '
                      'Credentials securely stored in encrypted platform storage. Ready for '
                      'conversation history and AI chat implementation in Task 19.3.',
                      style: TextStyle(
                        color: AppColors.inkMuted,
                        fontSize: 13.0,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),

              // Sign Out Button
              OutlinedButton.icon(
                onPressed: () {
                  ref.read(authControllerProvider.notifier).logout();
                },
                icon: const Icon(Icons.logout_rounded, size: 18.0, color: AppColors.danger),
                label: const Text(
                  'Sign out of session',
                  style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: AppColors.danger.withValues(alpha: 0.4)),
                  padding: const EdgeInsets.symmetric(vertical: 14.0),
                ),
              ),
              const SizedBox(height: 12.0),
            ],
          ),
        ),
      ),
    );
  }
}
