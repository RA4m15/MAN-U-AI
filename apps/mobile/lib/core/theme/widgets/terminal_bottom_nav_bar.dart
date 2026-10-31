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
}

/// Terminal Cobalt Mobile 5-Slot Bottom Navigation Bar
/// With signature center floating FAB inside a bordered socket.
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
      height: 88.0,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(
          top: BorderSide(color: AppColors.border, width: 1.0),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Tab 1: Chat / Consult
                  _buildTabItem(
                    tab: TerminalTab.chat,
                    icon: Icons.chat_bubble_rounded,
                    label: 'CONSULT',
                  ),
                  // Tab 2: Equipment / Area
                  _buildTabItem(
                    tab: TerminalTab.equipment,
                    icon: Icons.precision_manufacturing_rounded,
                    label: 'EQUIP',
                  ),
                  // Center Gap for FAB (56px)
                  const SizedBox(width: 56.0),
                  // Tab 4: Diagram / Hotspots
                  _buildTabItem(
                    tab: TerminalTab.diagram,
                    icon: Icons.schema_rounded,
                    label: 'DIAGRAM',
                  ),
                  // Tab 5: Shift Tasks
                  _buildTabItem(
                    tab: TerminalTab.tasks,
                    icon: Icons.assignment_outlined,
                    label: 'TASKS',
                    badgeCount: tasksBadgeCount,
                  ),
                ],
              ),
            ),

            // Center Floating FAB lifted 24px above bottom bar in a bordered well
            Positioned(
              top: -24.0,
              child: GestureDetector(
                onTap: onFabPressed,
                child: Container(
                  width: 68.0,
                  height: 68.0,
                  padding: const EdgeInsets.all(6.0),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.border, width: 1.0),
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.15),
                        width: 1.0,
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x660057FF), // rgba(0,87,255,0.4)
                          blurRadius: 15.0,
                          spreadRadius: 1.0,
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.bolt_rounded,
                        color: Colors.white,
                        size: 28.0,
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
    required String label,
    int badgeCount = 0,
  }) {
    final isActive = activeTab == tab;
    final color = isActive ? AppColors.primary : AppColors.onSurfaceVariant;

    return InkWell(
      onTap: () => onTabSelected(tab),
      borderRadius: BorderRadius.circular(8.0),
      child: Container(
        width: 64.0,
        padding: const EdgeInsets.symmetric(vertical: 4.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, size: 22.0, color: color),
                if (badgeCount > 0)
                  Positioned(
                    top: -4,
                    right: -8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
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
            const SizedBox(height: 3.0),
            Text(
              label,
              style: AppTypography.caption.copyWith(
                color: color,
                fontSize: 9.5,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

