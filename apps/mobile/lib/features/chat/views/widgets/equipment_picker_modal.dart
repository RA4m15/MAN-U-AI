import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../equipment/controllers/equipment_controller.dart';
import '../../../equipment/models/equipment_model.dart';

class EquipmentPickerModal extends ConsumerWidget {
  final EquipmentModel? selectedEquipment;
  final ValueChanged<EquipmentModel?> onSelected;

  const EquipmentPickerModal({
    super.key,
    required this.selectedEquipment,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final equipmentAsync = ref.watch(equipmentListProvider);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 20.0),
      decoration: const BoxDecoration(
        color: AppColors.surface1,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16.0)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.settings_suggest_rounded,
                  color: AppColors.primary,
                  size: 20.0,
                ),
                const SizedBox(width: 8.0),
                const Text(
                  'Select Plant Equipment Context',
                  style: TextStyle(
                    fontSize: 15.0,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: AppColors.inkSubtle),
                  onPressed: () => Navigator.of(context).pop(),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            const SizedBox(height: 6.0),
            const Text(
              'Ground your troubleshooting session in manufacturer manuals, wiring schematics, and SOPs for a specific asset.',
              style: TextStyle(fontSize: 12.0, color: AppColors.inkSubtle, height: 1.4),
            ),
            const SizedBox(height: 16.0),

            // Option: None / General
            ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 12.0),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8.0),
                side: BorderSide(
                  color: selectedEquipment == null
                      ? AppColors.primary
                      : AppColors.hairline,
                ),
              ),
              tileColor: selectedEquipment == null
                  ? AppColors.primary.withValues(alpha: 0.1)
                  : AppColors.surface2,
              leading: Icon(
                Icons.all_inclusive_rounded,
                color: selectedEquipment == null ? AppColors.primary : AppColors.inkSubtle,
              ),
              title: const Text(
                'General Plant Consultation',
                style: TextStyle(fontSize: 13.0, fontWeight: FontWeight.w600, color: AppColors.ink),
              ),
              subtitle: const Text(
                'Search across all authorized facility documents without filtering',
                style: TextStyle(fontSize: 11.0, color: AppColors.inkSubtle),
              ),
              trailing: selectedEquipment == null
                  ? const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 18.0)
                  : null,
              onTap: () {
                onSelected(null);
                Navigator.of(context).pop();
              },
            ),
            const SizedBox(height: 12.0),

            Flexible(
              child: equipmentAsync.when(
                loading: () => const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24.0),
                    child: CircularProgressIndicator(strokeWidth: 2.0),
                  ),
                ),
                error: (err, stack) => Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Text(
                    'Failed to load equipment list: $err',
                    style: const TextStyle(color: AppColors.danger, fontSize: 12.0),
                  ),
                ),
                data: (equipmentList) {
                  if (equipmentList.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.all(16.0),
                      child: Text(
                        'No registered plant equipment found in database.',
                        style: TextStyle(color: AppColors.inkSubtle, fontSize: 12.0),
                        textAlign: TextAlign.center,
                      ),
                    );
                  }

                  return ListView.separated(
                    shrinkWrap: true,
                    itemCount: equipmentList.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8.0),
                    itemBuilder: (context, index) {
                      final eq = equipmentList[index];
                      final isSelected = selectedEquipment?.id == eq.id;
                      return ListTile(
                        key: Key('equipment_item_${eq.id}'),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 4.0),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8.0),
                          side: BorderSide(
                            color: isSelected ? AppColors.primary : AppColors.hairline,
                          ),
                        ),
                        tileColor: isSelected
                            ? AppColors.primary.withValues(alpha: 0.1)
                            : AppColors.surface2,
                        leading: Container(
                          padding: const EdgeInsets.all(8.0),
                          decoration: BoxDecoration(
                            color: AppColors.surface3,
                            borderRadius: BorderRadius.circular(6.0),
                          ),
                          child: const Icon(
                            Icons.precision_manufacturing_outlined,
                            size: 18.0,
                            color: AppColors.primaryHover,
                          ),
                        ),
                        title: Text(
                          eq.name,
                          style: const TextStyle(
                            fontSize: 13.0,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink,
                          ),
                        ),
                        subtitle: Text(
                          '${eq.type}${eq.model != null ? ' • ${eq.model}' : ''}${eq.location != null ? ' (${eq.location})' : ''}',
                          style: const TextStyle(fontSize: 11.0, color: AppColors.inkSubtle),
                        ),
                        trailing: isSelected
                            ? const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 18.0)
                            : null,
                        onTap: () {
                          onSelected(eq);
                          Navigator.of(context).pop();
                        },
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
