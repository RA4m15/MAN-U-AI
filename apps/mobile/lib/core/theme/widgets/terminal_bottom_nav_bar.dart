import 'package:flutter/material.dart';
import '../app_colors.dart';
import '../app_typography.dart';

enum TerminalTab {
  chat,
  equipment,
  fabAction,
  diagram,
  glossary,
  tasks,
  explodedView,
}

/// MAN-U-AI Modern Light Bottom Navigation Bar
/// Clean elevated light bar with floating center Copilot action FAB.
/// Uses responsive Expanded tab layout to prevent overflow on narrow screens.
class TerminalBottomNavBar extends StatelessWidget {
  final TerminalTab activeTab;
  final ValueChanged<TerminalTab> onTabSelected;
  final VoidCallback onFabPressed;
  final int tasksBadgeCount;

  const TerminalBottomNavBar({
    super.key,
    required this.activeTab,
    required this.onTabSelected,
    required this.onFabPressed,
    this.tasksBadgeCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 82.0,
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        border: const Border(
          top: BorderSide(color: AppColors.border, width: 1.0),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 16.0,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10.0),
              child: Row(
                children: [
                  // Tab 1: Chat / Consult
                  Expanded(
                    child: _buildTabItem(
                      tab: TerminalTab.chat,
                      icon: Icons.chat_bubble_outline_rounded,
                      activeIcon: Icons.chat_bubble_rounded,
                      label: 'CONSULT',
                    ),
                  ),
                  // Tab 2: Equipment / Fleet
                  Expanded(
                    child: _buildTabItem(
                      tab: TerminalTab.equipment,
                      icon: Icons.precision_manufacturing_outlined,
                      activeIcon: Icons.precision_manufacturing_rounded,
                      label: 'EQUIP',
                    ),
                  ),
                  // Center Gap for Floating FAB
                  const SizedBox(width: 56.0),
                  // Tab 4: Diagram / Hotspots
                  Expanded(
                    child: _buildTabItem(
                      tab: TerminalTab.diagram,
                      icon: Icons.schema_outlined,
                      activeIcon: Icons.schema_rounded,
                      label: 'DIAGRAM',
                    ),
                  ),
                  // Tab 5: Shift Tasks
                  Expanded(
                    child: _buildTabItem(
                      tab: TerminalTab.tasks,
                      icon: Icons.assignment_outlined,
                      activeIcon: Icons.assignment_rounded,
                      label: 'TASKS',
                      badgeCount: tasksBadgeCount,
                    ),
                  ),
                ],
              ),
            ),

            // Center Floating Copilot Action FAB
            Positioned(
              top: -20.0,
              child: GestureDetector(
                onTap: onFabPressed,
                child: Container(
                  width: 62.0,
                  height: 62.0,
                  padding: const EdgeInsets.all(4.0),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 12.0,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Color(0xFF00BBD4), // Cyan
                          Color(0xFF087EFF), // Electric blue
                        ],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0x66087EFF),
                          blurRadius: 14.0,
                          spreadRadius: 1.0,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.bolt_rounded,
                        color: Colors.white,
                        size: 26.0,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabItem({
    required TerminalTab tab,
    required IconData icon,
    required IconData activeIcon,
    required String label,
    int badgeCount = 0,
  }) {
    final isActive = activeTab == tab;

    return InkWell(
      onTap: () => onTabSelected(tab),
      borderRadius: BorderRadius.circular(16.0),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  isActive ? activeIcon : icon,
                  size: 22.0,
                  color: isActive ? AppColors.onSurface : AppColors.onSurfaceVariant,
                ),
                if (badgeCount > 0)
                  Positioned(
                    top: -4,
                    right: -10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: AppColors.primaryAction,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                      child: Text(
                        '$badgeCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8.5,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4.0),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.caption.copyWith(
                color: isActive ? AppColors.onSurface : AppColors.onSurfaceVariant,
                fontSize: 9.5,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                letterSpacing: 0.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
