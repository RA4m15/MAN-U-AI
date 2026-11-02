import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/widgets/terminal_components.dart';
import '../../../equipment/controllers/equipment_controller.dart';
import '../../../equipment/models/equipment_model.dart';

/// MAN-U-AI Modern Light Equipment Picker Modal
class EquipmentPickerModal extends ConsumerWidget {
  final EquipmentModel? selectedEquipment;
  final ValueChanged<EquipmentModel?> onSelected;

  const EquipmentPickerModal({
    super.key,
    required this.selectedEquipment,
    required this.onSelected,
  });

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
    final equipmentAsync = ref.watch(equipmentListProvider);

    return Container(
      padding: const EdgeInsets.fromLTRB(20.0, 20.0, 20.0, 24.0),
      decoration: const BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24.0)),
        border: Border(
          top: BorderSide(color: AppColors.border, width: 1.0),
          left: BorderSide(color: AppColors.border, width: 1.0),
          right: BorderSide(color: AppColors.border, width: 1.0),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const SectionHeader(
                  title: 'SELECT EQUIPMENT CONTEXT',
                  padding: EdgeInsets.zero,
                ),
                ButtonIconTile(
                  icon: Icons.close_rounded,
                  size: 36.0,
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 8.0),
            Text(
              'GROUND COPILOT IN OEM MANUALS, SCHEMATICS, AND SOPS FOR A SPECIFIC PLANT MACHINE.'
                  .toUpperCase(),
              style: AppTypography.caption,
            ),
            const SizedBox(height: 16.0),

            // Option: General Facility (No Equipment Filter)
            Container(
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(16.0),
                border: Border.all(
                  color: selectedEquipment == null ? AppColors.primary : AppColors.border,
                  width: selectedEquipment == null ? 1.8 : 1.0,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
                    blurRadius: 6.0,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(16.0),
                  onTap: () {
                    onSelected(null);
                    Navigator.of(context).pop();
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(14.0),
                    child: Row(
                      children: [
                        Container(
                          width: 40.0,
                          height: 40.0,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceMuted,
                            borderRadius: BorderRadius.circular(10.0),
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.all_inclusive_rounded,
                              size: 20.0,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12.0),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'GENERAL PLANT CONSULTATION',
                                style: AppTypography.bodyMd.copyWith(
                                  fontSize: 13.0,
                                  fontWeight: selectedEquipment == null ? FontWeight.w700 : FontWeight.w500,
                                  color: AppColors.onSurface,
                                ),
                              ),
                              const SizedBox(height: 2.0),
                              Text(
                                'SEARCH ALL AUTHORIZED FACILITY DOCUMENTS WITHOUT FILTERING',
                                style: AppTypography.caption,
                              ),
                            ],
                          ),
                        ),
                        if (selectedEquipment == null)
                          const StatusDot(color: AppColors.primary, size: 8.0),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12.0),

            Flexible(
              child: equipmentAsync.when(
                loading: () => const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24.0),
                    child: SizedBox(
                      width: 20.0,
                      height: 20.0,
                      child: CircularProgressIndicator(strokeWidth: 2.0),
                    ),
                  ),
                ),
                error: (err, _) => Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Text(
                    'COULD NOT LOAD EQUIPMENT ROSTER',
                    style: AppTypography.caption.copyWith(color: AppColors.error),
                  ),
                ),
                data: (equipmentList) {
                  return ListView.builder(
                    shrinkWrap: true,
                    itemCount: equipmentList.length,
                    itemBuilder: (context, index) {
                      final eq = equipmentList[index];
                      final isSelected = selectedEquipment?.id == eq.id;
                      final dotColor = _getCategoricalColor(index);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8.0),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(16.0),
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
                            borderRadius: BorderRadius.circular(16.0),
                            onTap: () {
                              onSelected(eq);
                              Navigator.of(context).pop();
                            },
                            child: Padding(
                              padding: const EdgeInsets.all(14.0),
                              child: Row(
                                children: [
                                  // Categorical Identity Dot inside tile
                                  Container(
                                    width: 40.0,
                                    height: 40.0,
                                    decoration: BoxDecoration(
                                      color: AppColors.surfaceMuted,
                                      borderRadius: BorderRadius.circular(10.0),
                                    ),
                                    child: Center(
                                      child: Container(
                                        width: 10.0,
                                        height: 10.0,
                                        decoration: BoxDecoration(
                                          color: dotColor,
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
                                          eq.displayName.toUpperCase(),
                                          style: AppTypography.bodyMd.copyWith(
                                            fontSize: 13.0,
                                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                            color: AppColors.onSurface,
                                          ),
                                        ),
                                        const SizedBox(height: 2.0),
                                        Text(
                                          '${eq.type.toUpperCase()} // ${eq.location?.toUpperCase() ?? "GENERAL PLANT AREA"}',
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
            const SizedBox(height: 14.0),
            SecondaryButton(
              key: const Key('picker_browse_catalog_button'),
              label: 'BROWSE FULL MACHINE CATALOG',
              icon: Icons.view_in_ar_rounded,
              height: 42.0,
              onPressed: () {
                Navigator.of(context).pop();
                context.push('/catalog');
              },
            ),
          ],
        ),
      ),
    );
  }
}
