import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../chat/models/cad_component_selection_state.dart';
import '../../../equipment/models/equipment_model.dart';

/// Interactive Component Exploration Panel for the dedicated Exploded View Screen.
///
/// Displays:
/// - Assembly tree & hierarchical component list.
/// - Active component details (ID, name, parent assembly, specifications).
/// - Fast selection triggers that update both the 3D viewer bridge and AI context.
class ComponentTreePanel extends StatelessWidget {
  final EquipmentModel machine;
  final CadComponentSelectionState selectionState;
  final ValueChanged<String>? onSelectComponent;
  final VoidCallback? onClearSelection;
  final ValueChanged<String>? onAskAiAboutComponent;

  const ComponentTreePanel({
    super.key,
    required this.machine,
    required this.selectionState,
    this.onSelectComponent,
    this.onClearSelection,
    this.onAskAiAboutComponent,
  });

  List<Map<String, dynamic>> _resolveComponents() {
    // 1. If machine already has structured components, use them
    if (machine.components.isNotEmpty) {
      return machine.components;
    }

    // 2. Verified fallback components for standard equipment
    final mId = machine.id.toLowerCase();
    if (mId.contains('p102') || mId.contains('slurry') || mId == 'machine_001') {
      return const [
        {
          'partId': 'bearing_assembly_01',
          'name': 'Bearing Assembly',
          'description': 'Heavy-duty spherical roller bearing supporting rotor shaft.',
          'parentAssemblyId': 'rotor_assembly',
          'specifications': 'Type: Spherical Roller 22216 • Max Temp: 85°C • ISO VG 220',
        },
        {
          'partId': 'mechanical_seal_02',
          'name': 'Mechanical Seal Cartridge',
          'description': 'Dual cartridge mechanical seal preventing slurry leakage across housing.',
          'parentAssemblyId': 'casing_assembly',
          'specifications': 'SiC vs Tungsten Carbide • Flush Pressure: 4.5 bar • Torque: 45 N·m',
        },
        {
          'partId': 'impeller_01',
          'name': 'Slurry Impeller',
          'description': 'Closed multi-vane high-chrome abrasive slurry impeller.',
          'parentAssemblyId': 'rotor_assembly',
          'specifications': 'High-chrome alloy • 4-vane closed flow • Max RPM: 1,480',
        },
        {
          'partId': 'suction_casing_01',
          'name': 'Suction Casing Liner',
          'description': 'Cast high-chrome alloy wear liner protecting outer casing from abrasion.',
          'parentAssemblyId': 'casing_assembly',
          'specifications': 'High-chrome A05 • Gland clearance: 0.12 mm',
        },
      ];
    } else if (mId.contains('cb-a61') || mId.contains('conveyor')) {
      return const [
        {
          'partId': 'CB-A61-01',
          'name': 'Drive Motor Assembly',
          'description': '480V 3-phase high-torque drive motor powering conveyor head pulley.',
          'parentAssemblyId': 'drive_station',
          'specifications': '480V 3-Phase • Power: 15 kW • Belt Speed: 1.5 m/s',
        },
        {
          'partId': 'CB-A61-02',
          'name': 'Idler Roller Precision Bearing',
          'description': 'Brushed aluminum precision idler roller with ABEC-5 double sealed bearings.',
          'parentAssemblyId': 'roller_bed',
          'specifications': 'ABEC-5 Double Sealed • Axle Torque: 32 N·m',
        },
        {
          'partId': 'CB-A61-04',
          'name': 'Optical Inspection Scanning Sensor Module',
          'description': 'High-speed line scanner inspecting item positioning on belt.',
          'parentAssemblyId': 'scanner_gantry',
          'specifications': 'Scanning Rate: 200 Hz • IP67 Industrial Housing',
        },
      ];
    }

    return const [];
  }

  @override
  Widget build(BuildContext context) {
    final components = _resolveComponents();
    final selectedPartId = selectionState.selectedPartId;
    final selectedPartName = selectionState.selectedPartName;

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surfaceAlt,
        border: Border(
          top: BorderSide(color: AppColors.border, width: 1.0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header / Active Selection Banner
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
            child: Row(
              children: [
                Icon(
                  Icons.account_tree_outlined,
                  size: 16.0,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 8.0),
                Expanded(
                  child: Text(
                    'ASSEMBLY COMPONENT HIERARCHY',
                    style: AppTypography.labelMd.copyWith(
                      fontSize: 11.0,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (selectionState.hasSelection) ...[
                  const SizedBox(width: 8.0),
                  InkWell(
                    key: const Key('clear_component_selection_button'),
                    onTap: onClearSelection,
                    child: Text(
                      'Clear Selection',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                        fontSize: 10.5,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Active Component Card (when a component is picked)
          if (selectionState.hasSelection)
            Container(
              key: const Key('active_component_detail_card'),
              margin: const EdgeInsets.fromLTRB(12.0, 0, 12.0, 8.0),
              padding: const EdgeInsets.all(12.0),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12.0),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(4.0),
                        ),
                        child: Text(
                          selectedPartId ?? 'PART',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8.0),
                      Expanded(
                        child: Text(
                          selectedPartName ?? 'Selected Component',
                          key: const Key('active_component_name_text'),
                          style: AppTypography.labelMd.copyWith(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  if (selectionState.parentId != null && selectionState.parentId!.isNotEmpty) ...[
                    const SizedBox(height: 4.0),
                    Text(
                      'Parent Assembly: ${selectionState.parentId}',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.onSurfaceVariant,
                        fontSize: 10.5,
                      ),
                    ),
                  ],
                  if (selectionState.assemblyPath.isNotEmpty) ...[
                    const SizedBox(height: 2.0),
                    Text(
                      'Hierarchy: ${selectionState.assemblyPath.join(" → ")}',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.onSurfaceVariant,
                        fontSize: 10.0,
                      ),
                    ),
                  ],
                ],
              ),
            ),

          // Component List Chips / Items
          if (components.isNotEmpty)
            SizedBox(
              height: 42.0,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 12.0),
                scrollDirection: Axis.horizontal,
                itemCount: components.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8.0),
                itemBuilder: (context, index) {
                  final item = components[index];
                  final partId = item['partId']?.toString() ?? 'part_$index';
                  final name = item['name']?.toString() ?? partId;
                  final isSelected = selectedPartId == partId;

                  return ActionChip(
                    key: Key('component_chip_$partId'),
                    avatar: Icon(
                      isSelected ? Icons.check_circle_rounded : Icons.hub_outlined,
                      size: 14.0,
                      color: isSelected ? Colors.white : AppColors.primary,
                    ),
                    label: Text(name),
                    labelStyle: TextStyle(
                      fontSize: 11.0,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected ? Colors.white : AppColors.onSurface,
                    ),
                    backgroundColor: isSelected ? AppColors.primary : AppColors.surface,
                    side: BorderSide(
                      color: isSelected ? AppColors.primary : AppColors.border,
                      width: 1.0,
                    ),
                    onPressed: () => onSelectComponent?.call(partId),
                  );
                },
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 8.0),
              child: Text(
                'Tap individual 3D faces or meshes in viewport to inspect component hierarchy.',
                style: AppTypography.caption.copyWith(
                  color: AppColors.onSurfaceVariant,
                  fontSize: 10.5,
                ),
              ),
            ),
          const SizedBox(height: 8.0),
        ],
      ),
    );
  }
}
