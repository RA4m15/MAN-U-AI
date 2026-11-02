import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/widgets/terminal_components.dart';
import '../../chat/controllers/chat_controller.dart';
import '../controllers/equipment_controller.dart';
import '../models/equipment_model.dart';

/// Machine Catalog Screen for MAN-U-AI.
/// Displays industrial plant machines with reference images,
/// CAD availability status, and one-tap integration with Copilot chat.
class MachineCatalogScreen extends ConsumerStatefulWidget {
  const MachineCatalogScreen({super.key});

  @override
  ConsumerState<MachineCatalogScreen> createState() => _MachineCatalogScreenState();
}

class _MachineCatalogScreenState extends ConsumerState<MachineCatalogScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedCategory = 'All';

  static const List<String> _categories = [
    'All',
    'Industrial rotating equipment',
    'Power generation equipment',
    'Industrial process equipment',
    'Manufacturing equipment',
    'Material Handling',
    'Medical Imaging',
  ];

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.trim().toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<EquipmentModel> _filterEquipment(List<EquipmentModel> list) {
    return list.where((item) {
      final matchesSearch = _searchQuery.isEmpty ||
          item.name.toLowerCase().contains(_searchQuery) ||
          item.type.toLowerCase().contains(_searchQuery) ||
          (item.model?.toLowerCase().contains(_searchQuery) ?? false) ||
          (item.category?.toLowerCase().contains(_searchQuery) ?? false);

      final matchesCategory = _selectedCategory == 'All' ||
          (item.category?.toLowerCase() == _selectedCategory.toLowerCase()) ||
          (item.type.toLowerCase() == _selectedCategory.toLowerCase());

      return matchesSearch && matchesCategory;
    }).toList();
  }

  void _onOpenMachineChat(EquipmentModel machine) {
    ref.read(chatControllerProvider.notifier).setSelectedEquipment(machine);
    ref.read(chatControllerProvider.notifier).startNewConsultation();
    context.go('/home');
  }

  void _onExploreExplodedView(EquipmentModel machine) {
    if (machine.hasCadModel) {
      ref.read(chatControllerProvider.notifier).openExplodedViewForMachine(machine);
      context.go('/home');
    } else {
      // Machine CAD is pending - show honest informational modal
      _showCadPendingSheet(machine);
    }
  }

  void _showCadPendingSheet(EquipmentModel machine) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20.0, 16.0, 20.0, 28.0),
        decoration: const BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24.0)),
          border: Border(top: BorderSide(color: AppColors.border, width: 1.0)),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
            Center(
              child: Container(
                width: 40.0,
                height: 4.0,
                margin: const EdgeInsets.only(bottom: 16.0),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2.0),
                ),
              ),
            ),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                  decoration: BoxDecoration(
                    color: AppColors.accentCategorical5.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6.0),
                    border: Border.all(color: AppColors.accentCategorical5, width: 0.8),
                  ),
                  child: Text(
                    'CAD MODEL PENDING',
                    key: const Key('modal_cad_pending_badge'),
                    style: AppTypography.caption.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.accentCategorical5,
                      fontSize: 10.5,
                    ),
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 20.0),
                  onPressed: () => Navigator.of(ctx).pop(),
                ),
              ],
            ),
            const SizedBox(height: 12.0),
            Text(
              machine.name,
              style: AppTypography.headlineMd.copyWith(fontSize: 17.0, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4.0),
            Text(
              '${machine.category ?? machine.type} • ${machine.manufacturer ?? "Standard Plant Equipment"}',
              style: AppTypography.caption.copyWith(color: AppColors.onSurfaceVariant),
            ),
            const SizedBox(height: 16.0),
            if (machine.referenceImage != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(14.0),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Image.asset(
                    machine.referenceImage!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(
                      color: AppColors.surfaceAlt,
                      child: const Icon(Icons.precision_manufacturing_rounded, size: 48.0, color: AppColors.onSurfaceVariant),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 16.0),
            Container(
              padding: const EdgeInsets.all(14.0),
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(14.0),
                border: Border.all(color: AppColors.border, width: 1.0),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 16.0, color: AppColors.primary),
                      const SizedBox(width: 8.0),
                      Text(
                        '3D CAD STATUS NOTICE',
                        style: AppTypography.caption.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6.0),
                  Text(
                    'An authoritative 3D CAD model (.step / .iges / .brep) has not yet been uploaded for this machine by plant engineering administrators. Fabrication of simulated 3D geometry is disabled to maintain industrial reliability.',
                    style: AppTypography.bodySm.copyWith(
                      color: AppColors.onSurfaceVariant,
                      fontSize: 12.0,
                    ),
                  ),
                ],
              ),
            ),
            if (machine.documentation.isNotEmpty) ...[
              const SizedBox(height: 16.0),
              Text(
                'AVAILABLE DOCUMENTATION & SOPS',
                style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8.0),
              ...machine.documentation.map(
                (doc) => Padding(
                  padding: const EdgeInsets.only(bottom: 6.0),
                  child: Row(
                    children: [
                      const Icon(Icons.description_outlined, size: 14.0, color: AppColors.primary),
                      const SizedBox(width: 8.0),
                      Expanded(
                        child: Text(
                          doc,
                          style: AppTypography.bodySm.copyWith(fontSize: 12.0),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 20.0),
            MachinedPrimaryButton(
              key: const Key('modal_open_chat_button'),
              label: 'ASK COPILOT ABOUT THIS MACHINE',
              icon: Icons.chat_bubble_outline_rounded,
              onPressed: () {
                Navigator.of(ctx).pop();
                ref.read(chatControllerProvider.notifier).openExplodedViewForMachine(machine);
                context.go('/home');
              },
            ),
          ],
        ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final equipmentAsync = ref.watch(equipmentListProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: Center(
          child: ButtonIconTile(
            key: const Key('catalog_back_button'),
            icon: Icons.arrow_back_ios_new_rounded,
            size: 38.0,
            onPressed: () {
              if (Navigator.of(context).canPop()) {
                Navigator.of(context).pop();
              } else {
                context.go('/home');
              }
            },
          ),
        ),
        title: Column(
          children: [
            Text(
              'Machine Catalog',
              style: AppTypography.headlineMd.copyWith(
                fontSize: 16.5,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              '3D Assemblies & Plant Equipment',
              style: AppTypography.caption.copyWith(
                color: AppColors.primary,
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // 1. Search Bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16.0, 8.0, 16.0, 8.0),
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(16.0),
                  border: Border.all(color: AppColors.border, width: 1.0),
                ),
                child: TextField(
                  key: const Key('machine_search_input'),
                  controller: _searchController,
                  style: AppTypography.bodyMd.copyWith(fontSize: 13.5),
                  decoration: InputDecoration(
                    hintText: 'Search machines, categories, models...',
                    hintStyle: AppTypography.bodySm.copyWith(color: AppColors.onSurfaceVariant),
                    prefixIcon: const Icon(Icons.search_rounded, color: AppColors.onSurfaceVariant, size: 20.0),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 18.0),
                            onPressed: () => _searchController.clear(),
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
                  ),
                ),
              ),
            ),

            // 2. Category Filter Chips (Horizontal Scroll)
            SizedBox(
              height: 38.0,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                itemCount: _categories.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8.0),
                itemBuilder: (context, index) {
                  final cat = _categories[index];
                  final isSelected = _selectedCategory == cat;
                  return ChoiceChip(
                    key: Key('category_chip_$index'),
                    label: Text(
                      cat,
                      style: AppTypography.caption.copyWith(
                        color: isSelected ? Colors.white : AppColors.onSurface,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        fontSize: 11.0,
                      ),
                    ),
                    selected: isSelected,
                    selectedColor: AppColors.primary,
                    backgroundColor: AppColors.surfaceAlt,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20.0),
                      side: BorderSide(
                        color: isSelected ? AppColors.primary : AppColors.border,
                        width: 1.0,
                      ),
                    ),
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _selectedCategory = cat);
                      }
                    },
                  );
                },
              ),
            ),

            const SizedBox(height: 10.0),

            // 3. Machine Grid/List
            Expanded(
              child: equipmentAsync.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
                error: (err, _) => Center(
                  child: Text(
                    'Failed to load equipment catalog: $err',
                    style: AppTypography.bodySm.copyWith(color: AppColors.error),
                  ),
                ),
                data: (allMachines) {
                  final machines = _filterEquipment(allMachines);

                  if (machines.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.precision_manufacturing_outlined, size: 48.0, color: AppColors.onSurfaceVariant),
                          const SizedBox(height: 12.0),
                          Text(
                            'No machines found matching "$_searchQuery"',
                            style: AppTypography.bodyMd.copyWith(color: AppColors.onSurfaceVariant),
                          ),
                        ],
                      ),
                    );
                  }

                  return ListView.builder(
                    key: const Key('machine_catalog_list'),
                    padding: const EdgeInsets.fromLTRB(16.0, 4.0, 16.0, 24.0),
                    itemCount: machines.length,
                    itemBuilder: (context, index) {
                      final machine = machines[index];
                      return _buildMachineCard(context, machine);
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

  Widget _buildMachineCard(BuildContext context, EquipmentModel machine) {
    final hasCad = machine.hasCadModel;

    return Container(
      key: Key('machine_card_${machine.id}'),
      margin: const EdgeInsets.only(bottom: 16.0),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(20.0),
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8.0,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Visual Reference Image or Graphic Placeholder
          if (machine.referenceImage != null)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.asset(
                machine.referenceImage!,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  color: AppColors.surfaceCard,
                  child: const Center(
                    child: Icon(Icons.precision_manufacturing_rounded, size: 40.0, color: AppColors.onSurfaceVariant),
                  ),
                ),
              ),
            )
          else
            Container(
              height: 100.0,
              color: AppColors.surfaceCard,
              child: Center(
                child: Icon(
                  Icons.precision_manufacturing_rounded,
                  size: 44.0,
                  color: AppColors.primary.withValues(alpha: 0.7),
                ),
              ),
            ),

          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Category & CAD Status Badges Wrap
                Wrap(
                  spacing: 8.0,
                  runSpacing: 6.0,
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    // Category Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 3.0),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6.0),
                      ),
                      child: Text(
                        (machine.category ?? machine.type).toUpperCase(),
                        style: AppTypography.caption.copyWith(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    // CAD Status Badge
                    Container(
                      key: Key(hasCad ? 'cad_badge_available_${machine.id}' : 'cad_badge_pending_${machine.id}'),
                      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 3.0),
                      decoration: BoxDecoration(
                        color: hasCad
                            ? AppColors.primary.withValues(alpha: 0.15)
                            : AppColors.accentCategorical5.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6.0),
                        border: Border.all(
                          color: hasCad ? AppColors.primary : AppColors.accentCategorical5,
                          width: 0.8,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            hasCad ? Icons.view_in_ar_rounded : Icons.pending_outlined,
                            size: 11.0,
                            color: hasCad ? AppColors.primary : AppColors.accentCategorical5,
                          ),
                          const SizedBox(width: 4.0),
                          Text(
                            hasCad ? 'CAD 3D AVAILABLE' : 'CAD MODEL PENDING',
                            style: AppTypography.caption.copyWith(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w700,
                              color: hasCad ? AppColors.primary : AppColors.accentCategorical5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 10.0),

                // Machine Name
                Text(
                  machine.name,
                  key: Key('machine_name_${machine.id}'),
                  style: AppTypography.headlineMd.copyWith(
                    fontSize: 16.0,
                    fontWeight: FontWeight.w700,
                  ),
                ),

                const SizedBox(height: 4.0),

                // Location & Model Subtitle
                Text(
                  '${machine.model ?? machine.type} • ${machine.location ?? "Plant Area"}',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.onSurfaceVariant,
                    fontSize: 11.5,
                  ),
                ),

                if (machine.documentation.isNotEmpty) ...[
                  const SizedBox(height: 8.0),
                  Row(
                    children: [
                      const Icon(Icons.menu_book_rounded, size: 13.0, color: AppColors.onSurfaceVariant),
                      const SizedBox(width: 6.0),
                      Expanded(
                        child: Text(
                          '${machine.documentation.length} OEM Manuals & Standard Operating Procedures',
                          style: AppTypography.caption.copyWith(
                            fontSize: 10.5,
                            color: AppColors.onSurfaceVariant,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 16.0),

                // Actions: Explore 3D Machine (Primary) & Open Chat (Secondary)
                Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: Container(
                        key: Key('explore_exploded_view_${machine.id}'),
                        child: MachinedPrimaryButton(
                          key: Key('explore_3d_machine_${machine.id}'),
                          label: 'EXPLORE 3D MACHINE',
                          icon: Icons.view_in_ar_rounded,
                          height: 40.0,
                          onPressed: () => _onExploreExplodedView(machine),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8.0),
                    Expanded(
                      flex: 2,
                      child: SecondaryButton(
                        key: Key('open_machine_chat_${machine.id}'),
                        label: 'CHAT',
                        icon: Icons.chat_bubble_outline_rounded,
                        height: 40.0,
                        onPressed: () => _onOpenMachineChat(machine),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
