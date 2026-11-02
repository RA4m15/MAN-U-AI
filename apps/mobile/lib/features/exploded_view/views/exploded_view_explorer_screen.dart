import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../equipment/controllers/equipment_controller.dart';
import '../../equipment/models/equipment_model.dart';
import '../../equipment/repositories/equipment_repository.dart';
import 'exploded_view_screen.dart';

enum CadAvailabilityFilter {
  all,
  available,
  pending,
}

/// Dedicated Exploded View Explorer Screen for MAN-U-AI.
///
/// Serves as the primary hub for exploring machine structures in 3D.
/// Provides rich search, CAD availability filters, machine technical cards,
/// and direct launch into the dedicated ExplodedViewScreen without requiring AI chat.
class ExplodedViewExplorerScreen extends ConsumerStatefulWidget {
  const ExplodedViewExplorerScreen({super.key});

  @override
  ConsumerState<ExplodedViewExplorerScreen> createState() => _ExplodedViewExplorerScreenState();
}

class _ExplodedViewExplorerScreenState extends ConsumerState<ExplodedViewExplorerScreen> {
  final TextEditingController _searchController = TextEditingController();
  CadAvailabilityFilter _selectedFilter = CadAvailabilityFilter.all;
  String _searchQuery = '';

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

  List<EquipmentModel> _filterEquipment(List<EquipmentModel> allMachines) {
    return allMachines.where((m) {
      // 1. Availability filter
      if (_selectedFilter == CadAvailabilityFilter.available && !m.hasCadModel) {
        return false;
      }
      if (_selectedFilter == CadAvailabilityFilter.pending && m.hasCadModel) {
        return false;
      }

      // 2. Text query search
      if (_searchQuery.isEmpty) return true;

      final nameMatch = m.name.toLowerCase().contains(_searchQuery);
      final idMatch = m.id.toLowerCase().contains(_searchQuery);
      final modelMatch = m.model?.toLowerCase().contains(_searchQuery) ?? false;
      final categoryMatch = (m.category ?? m.type).toLowerCase().contains(_searchQuery);
      final mfgMatch = m.manufacturer?.toLowerCase().contains(_searchQuery) ?? false;

      return nameMatch || idMatch || modelMatch || categoryMatch || mfgMatch;
    }).toList();
  }

  void _open3dViewer(EquipmentModel machine) {
    if (!machine.hasCadModel) {
      _showPendingModal(machine);
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ExplodedViewScreen(machine: machine),
      ),
    );
  }

  void _showPendingModal(EquipmentModel machine) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24.0),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24.0)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40.0,
                  height: 4.0,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2.0),
                  ),
                ),
              ),
              const SizedBox(height: 18.0),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10.0),
                    decoration: BoxDecoration(
                      color: AppColors.accentCategorical5.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12.0),
                    ),
                    child: const Icon(
                      Icons.warning_amber_rounded,
                      color: AppColors.accentCategorical5,
                      size: 24.0,
                    ),
                  ),
                  const SizedBox(width: 14.0),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'CAD MODEL PENDING',
                          key: const Key('pending_modal_title'),
                          style: AppTypography.headlineMd.copyWith(
                            fontSize: 14.0,
                            color: AppColors.accentCategorical5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          machine.displayName,
                          style: AppTypography.labelMd.copyWith(fontSize: 12.0),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16.0),
              if (machine.referenceImage != null && machine.referenceImage!.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(12.0),
                  child: Image.asset(
                    machine.referenceImage!,
                    height: 140.0,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
              const SizedBox(height: 16.0),
              Text(
                'An authoritative 3D CAD assembly (.STEP / .STP / .IGES) has not yet been uploaded for this equipment. In accordance with plant safety standards, 3D geometry is never artificially fabricated from photographic reference.',
                style: AppTypography.bodySm.copyWith(
                  color: AppColors.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 12.0),
              Text(
                'Upload permissions: Plant Admin or Maintenance Manager via Web Console.',
                style: AppTypography.caption.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 20.0),
              ElevatedButton(
                key: const Key('pending_modal_close_button'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12.0),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.0)),
                ),
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('ACKNOWLEDGE'),
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
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          key: const Key('explorer_back_button'),
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.onSurface),
          tooltip: 'Back',
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/home');
            }
          },
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Exploded View Explorer',
              key: const Key('explorer_header_title'),
              style: AppTypography.headlineMd.copyWith(
                fontSize: 16.0,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              'Explore machine assemblies, inspect internal components and understand their structure.',
              key: const Key('explorer_header_subtitle'),
              style: AppTypography.caption.copyWith(
                fontSize: 10.0,
                color: AppColors.onSurfaceVariant,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Search Input Field
            Padding(
              padding: const EdgeInsets.fromLTRB(16.0, 8.0, 16.0, 8.0),
              child: TextField(
                key: const Key('exploded_view_search_field'),
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search by machine name, category or model ID...',
                  hintStyle: AppTypography.caption.copyWith(
                    color: AppColors.onSurfaceVariant,
                    fontSize: 12.0,
                  ),
                  prefixIcon: const Icon(Icons.search_rounded, size: 20.0, color: AppColors.primary),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded, size: 18.0),
                          onPressed: () {
                            _searchController.clear();
                          },
                        )
                      : null,
                  filled: true,
                  fillColor: AppColors.surfaceAlt,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12.0),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12.0),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12.0),
                    borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                ),
              ),
            ),

            // Availability Filter Chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
              child: Row(
                children: [
                  ChoiceChip(
                    key: const Key('filter_chip_all'),
                    label: const Text('All Machines'),
                    selected: _selectedFilter == CadAvailabilityFilter.all,
                    onSelected: (val) {
                      if (val) setState(() => _selectedFilter = CadAvailabilityFilter.all);
                    },
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: _selectedFilter == CadAvailabilityFilter.all ? Colors.white : AppColors.onSurface,
                      fontSize: 11.0,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 8.0),
                  ChoiceChip(
                    key: const Key('filter_chip_available'),
                    label: const Text('CAD Available'),
                    selected: _selectedFilter == CadAvailabilityFilter.available,
                    onSelected: (val) {
                      if (val) setState(() => _selectedFilter = CadAvailabilityFilter.available);
                    },
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: _selectedFilter == CadAvailabilityFilter.available ? Colors.white : AppColors.onSurface,
                      fontSize: 11.0,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 8.0),
                  ChoiceChip(
                    key: const Key('filter_chip_pending'),
                    label: const Text('CAD Pending'),
                    selected: _selectedFilter == CadAvailabilityFilter.pending,
                    onSelected: (val) {
                      if (val) setState(() => _selectedFilter = CadAvailabilityFilter.pending);
                    },
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: _selectedFilter == CadAvailabilityFilter.pending ? Colors.white : AppColors.onSurface,
                      fontSize: 11.0,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 6.0),

            // Machine Grid / List
            Expanded(
              child: equipmentAsync.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                ),
                error: (err, _) => _buildListWithFallback(EquipmentRepository.fallbackEquipment),
                data: (machines) => _buildListWithFallback(machines.isNotEmpty ? machines : EquipmentRepository.fallbackEquipment),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildListWithFallback(List<EquipmentModel> machines) {
    final filtered = _filterEquipment(machines);

    if (filtered.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.search_off_rounded, size: 40.0, color: AppColors.onSurfaceVariant),
              const SizedBox(height: 10.0),
              Text(
                'NO MATCHING MACHINES FOUND',
                style: AppTypography.labelMd.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 6.0),
              Text(
                'Try searching with a different keyword or resetting your filter criteria.',
                textAlign: TextAlign.center,
                style: AppTypography.caption.copyWith(color: AppColors.onSurfaceVariant),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16.0, 4.0, 16.0, 20.0),
      itemCount: filtered.length,
      itemBuilder: (context, index) {
        final machine = filtered[index];
        return _buildMachineCard(context, machine);
      },
    );
  }

  Widget _buildMachineCard(BuildContext context, EquipmentModel machine) {
    final isAvailable = machine.hasCadModel;
    final docsCount = machine.documentation.length;

    return Container(
      key: Key('exploded_machine_card_${machine.id}'),
      margin: const EdgeInsets.only(bottom: 14.0),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(16.0),
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8.0,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Machine Reference Image
          if (machine.referenceImage != null && machine.referenceImage!.isNotEmpty)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(15.0)),
              child: Stack(
                children: [
                  Image.asset(
                    machine.referenceImage!,
                    height: 150.0,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(
                      height: 100.0,
                      color: AppColors.surfaceCard,
                      child: const Center(
                        child: Icon(
                          Icons.precision_manufacturing_rounded,
                          size: 36.0,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 10.0,
                    right: 10.0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                      decoration: BoxDecoration(
                        color: (isAvailable ? AppColors.success : AppColors.accentCategorical5),
                        borderRadius: BorderRadius.circular(8.0),
                      ),
                      child: Text(
                        isAvailable ? 'CAD AVAILABLE' : 'CAD MODEL PENDING',
                        key: Key(isAvailable ? 'cad_available_badge_${machine.id}' : 'cad_pending_badge_${machine.id}'),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9.0,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

          Padding(
            padding: const EdgeInsets.all(14.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        machine.name,
                        style: AppTypography.headlineMd.copyWith(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      'ID: ${machine.id}',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                        fontSize: 10.0,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4.0),
                Text(
                  '${machine.category ?? machine.type} • ${machine.model ?? "Standard Model"}',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.onSurfaceVariant,
                    fontSize: 11.0,
                  ),
                ),
                if (machine.manufacturer != null && machine.manufacturer!.isNotEmpty) ...[
                  const SizedBox(height: 2.0),
                  Text(
                    'Manufacturer: ${machine.manufacturer}',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.onSurfaceVariant,
                      fontSize: 10.5,
                    ),
                  ),
                ],
                const SizedBox(height: 10.0),
                Row(
                  children: [
                    Icon(
                      Icons.description_outlined,
                      size: 14.0,
                      color: docsCount > 0 ? AppColors.primary : AppColors.onSurfaceVariant,
                    ),
                    const SizedBox(width: 4.0),
                    Expanded(
                      child: Text(
                        docsCount > 0 ? '$docsCount Technical Manuals / SOPs Available' : 'Documentation Ingestion Pending',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.caption.copyWith(
                          fontSize: 10.5,
                          color: docsCount > 0 ? AppColors.onSurface : AppColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14.0),
                // Open 3D View Action Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    key: Key('open_3d_view_button_${machine.id}'),
                    icon: Icon(
                      isAvailable ? Icons.view_in_ar_rounded : Icons.info_outline_rounded,
                      size: 18.0,
                    ),
                    label: Text(
                      isAvailable ? 'OPEN 3D VIEW' : 'CAD MODEL PENDING — VIEW DETAILS',
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isAvailable ? AppColors.primary : AppColors.surfaceMuted,
                      foregroundColor: isAvailable ? Colors.white : AppColors.onSurfaceVariant,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 12.0),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10.0),
                        side: BorderSide(
                          color: isAvailable ? AppColors.primary : AppColors.border,
                        ),
                      ),
                    ),
                    onPressed: () => _open3dViewer(machine),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
