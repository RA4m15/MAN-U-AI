import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/connectivity_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/widgets/terminal_components.dart';
import '../../../core/theme/widgets/terminal_bottom_nav_bar.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../auth/models/auth_state.dart';
import '../controllers/chat_controller.dart';
import 'widgets/chat_bubble.dart';
import 'widgets/chat_composer.dart';
import 'widgets/conversation_drawer.dart';
import 'widgets/equipment_picker_modal.dart';
import 'widgets/plant_glossary_modal.dart';
import '../../diagram/views/interactive_diagram_viewer_screen.dart';
// document upload accessed via media screen
import '../../media/views/media_capture_screen.dart';
import '../../media/views/widgets/media_upload_modal.dart';
import '../../tasks/controllers/task_controller.dart';
import '../../tasks/views/tasks_screen.dart';
import '../../diagnostics/views/guided_diagnostics_screen.dart';
import '../../equipment/views/plant_reliability_insight_screen.dart';

/// Terminal Cobalt Mobile Chat Screen
/// Industrial. Instrumented. Operational.
class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _scrollController = ScrollController();
  TerminalTab _activeTab = TerminalTab.chat;

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _showEquipmentPicker(BuildContext context) {
    final currentEq = ref.read(chatControllerProvider).selectedEquipment;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => EquipmentPickerModal(
        selectedEquipment: currentEq,
        onSelected: (eq) {
          ref.read(chatControllerProvider.notifier).setSelectedEquipment(eq);
        },
      ),
    );
  }

  void _openCamera(BuildContext context) {
    final currentEq = ref.read(chatControllerProvider).selectedEquipment;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MediaCaptureScreen(
          initialEquipment: currentEq,
        ),
      ),
    );
  }

  void _showMediaUploadModal(BuildContext context) {
    final currentEq = ref.read(chatControllerProvider).selectedEquipment;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => MediaUploadModal(
        initialEquipment: currentEq,
      ),
    );
  }

  void _showGlossaryModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => PlantGlossaryModal(
        onSelectTerm: (term) {
          ref.read(chatControllerProvider.notifier).sendMessage('Explain SOP for $term');
        },
      ),
    );
  }

  void _showExplodedDiagram(BuildContext context) {
    final selectedEq = ref.read(chatControllerProvider).selectedEquipment;
    final isPump = selectedEq != null &&
        (selectedEq.name.toUpperCase().contains('PUMP') ||
            selectedEq.name.toUpperCase().contains('P-102') ||
            selectedEq.name.toUpperCase().contains('SLURRY'));

    final figureId = isPump ? 'FIG-P102-EXPLODED' : 'FIG-CONVEYOR-BELT-A61';
    final title = isPump
        ? 'P-102 Slurry Pump Exploded Assembly'
        : 'Conveyor Belt A61 Exploded Assembly (SimReady)';

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => InteractiveDiagramViewerScreen(
          figureId: figureId,
          title: title,
          onAskAboutPart: (prompt) {
            ref.read(chatControllerProvider.notifier).sendMessage(prompt);
          },
        ),
      ),
    );
  }

  Future<void> _downloadOfflineAreaPack(String equipmentId, String equipmentName) async {
    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
      SnackBar(
        content: Text('DOWNLOADING AREA PACK FOR $equipmentName...'),
        duration: const Duration(seconds: 2),
        backgroundColor: AppColors.surfaceAlt,
      ),
    );

    final success = await ref
        .read(chatControllerProvider.notifier)
        .downloadAreaPack(equipmentId);

    if (mounted) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            success
                ? 'OFFLINE AREA PACK CACHED // DEAD-ZONE VERIFICATION READY'
                : 'COULD NOT DOWNLOAD AREA PACK',
          ),
          backgroundColor: success ? AppColors.surfaceAlt : AppColors.error,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  void _openTasksScreen(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => TasksScreen(
          onConsultCopilot: (prompt, _) {
            ref.read(chatControllerProvider.notifier).sendMessage(prompt);
          },
        ),
      ),
    );
  }

  void _openGuidedDiagnostics(BuildContext context) {
    final currentEq = ref.read(chatControllerProvider).selectedEquipment;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => GuidedDiagnosticsScreen(
          equipmentName: currentEq?.displayName ?? 'Boiler B-201',
          onCompleteDiagnosis: (prompt) {
            ref.read(chatControllerProvider.notifier).sendMessage(prompt);
          },
        ),
      ),
    );
  }

  void _openPlantInsight(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PlantReliabilityInsightScreen(
          onConsultCopilot: (prompt) {
            ref.read(chatControllerProvider.notifier).sendMessage(prompt);
          },
        ),
      ),
    );
  }

  void _handleTabSelect(TerminalTab tab) {
    setState(() {
      _activeTab = tab;
    });

    switch (tab) {
      case TerminalTab.chat:
        break;
      case TerminalTab.equipment:
        _openPlantInsight(context);
        break;
      case TerminalTab.diagram:
        _showExplodedDiagram(context);
        break;
      case TerminalTab.glossary:
        _showGlossaryModal(context);
        break;
      case TerminalTab.tasks:
        _openTasksScreen(context);
        break;
      case TerminalTab.fabAction:
        _openGuidedDiagnostics(context);
        break;
    }
  }

  void _handleFabAction() {
    _openGuidedDiagnostics(context);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<ChatState>(chatControllerProvider, (prev, next) {
      if (prev?.messages.length != next.messages.length) {
        _scrollToBottom();
      }
    });

    final chatState = ref.watch(chatControllerProvider);
    final networkState = ref.watch(connectivityControllerProvider);
    final activeConv = chatState.activeConversation;
    final selectedEq = chatState.selectedEquipment;
    final currentEquipmentId = activeConv?.equipmentId ?? selectedEq?.id;
    final currentEquipmentName = activeConv?.equipmentName ?? selectedEq?.displayName;

    final authState = ref.watch(authControllerProvider);
    final user = authState is Authenticated ? authState.user : null;

    final titleText = activeConv?.title.isNotEmpty == true
        ? activeConv!.title.toUpperCase()
        : currentEquipmentName != null
            ? '$currentEquipmentName // ACTIVE'
            : 'NEW CONSULTATION';

    return Scaffold(
      backgroundColor: AppColors.surface,
      drawer: const ConversationDrawer(),
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leadingWidth: 38.0,
        leading: Builder(
          builder: (drawerCtx) => IconButton(
            key: const Key('open_drawer_button'),
            icon: const Icon(Icons.menu_rounded, size: 20.0, color: AppColors.onSurface),
            tooltip: 'Consultation History',
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 36.0, minHeight: 36.0),
            visualDensity: VisualDensity.compact,
            onPressed: () => Scaffold.of(drawerCtx).openDrawer(),
          ),
        ),
        titleSpacing: 4.0,
        title: LayoutBuilder(
          builder: (context, constraints) {
            if (constraints.maxWidth < 18.0) {
              return const SizedBox.shrink();
            }
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                StatusDot(
                  color: networkState.isReconnecting
                      ? AppColors.primary
                      : (networkState.isDeadZone || chatState.isOfflineMode)
                          ? AppColors.warning
                          : AppColors.success,
                  size: 8.0,
                ),
                if (constraints.maxWidth > 30.0) ...[
                  const SizedBox(width: 6.0),
                  Expanded(
                    child: Text(
                      titleText,
                      style: AppTypography.headlineMd.copyWith(fontSize: 13.0),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ],
            );
          },
        ),
        actions: [
          // Automatic Dead Zone / Connectivity Telemetry Icon
          IconButton(
            key: const Key('toggle_offline_mode_button'),
            icon: Icon(
              networkState.status == NetworkStatus.reconnecting
                  ? Icons.sync_rounded
                  : networkState.status == NetworkStatus.serverUnreachable
                      ? Icons.cloud_off_rounded
                      : (networkState.isDeadZone || chatState.isOfflineMode)
                          ? Icons.signal_wifi_off_rounded
                          : Icons.wifi_rounded,
              color: networkState.status == NetworkStatus.reconnecting
                  ? AppColors.primary
                  : (networkState.isDeadZone || chatState.isOfflineMode)
                      ? AppColors.warning
                      : AppColors.success,
              size: 19.0,
            ),
            tooltip: networkState.status == NetworkStatus.reconnecting
                ? 'Connection Restored // Synchronizing Data'
                : networkState.status == NetworkStatus.serverUnreachable
                    ? 'Server Unavailable // Local Procedures Only'
                    : (networkState.isDeadZone || chatState.isOfflineMode)
                        ? 'Dead-Zone Mode Active // Tap to Probe Connection'
                        : 'Online // Connected to MAN-U-AI Cloud',
            padding: const EdgeInsets.symmetric(horizontal: 2.0),
            constraints: const BoxConstraints(minWidth: 32.0, minHeight: 36.0),
            visualDensity: VisualDensity.compact,
            onPressed: () {
              if (networkState.isDeadZone) {
                ref.read(connectivityControllerProvider.notifier).checkReachability(manual: true);
              } else {
                ref.read(chatControllerProvider.notifier).toggleOfflineMode();
              }
            },
          ),
          // Plant Glossary
          IconButton(
            key: const Key('open_glossary_button'),
            icon: const Icon(Icons.menu_book_rounded, size: 19.0, color: AppColors.onSurfaceVariant),
            tooltip: 'Plant Glossary & Slang',
            padding: const EdgeInsets.symmetric(horizontal: 2.0),
            constraints: const BoxConstraints(minWidth: 32.0, minHeight: 36.0),
            visualDensity: VisualDensity.compact,
            onPressed: () => _showGlossaryModal(context),
          ),
          // Exploded Diagram
          IconButton(
            key: const Key('open_diagram_button'),
            icon: const Icon(Icons.schema_rounded, size: 19.0, color: AppColors.onSurfaceVariant),
            tooltip: 'Interactive Exploded Diagram',
            padding: const EdgeInsets.symmetric(horizontal: 2.0),
            constraints: const BoxConstraints(minWidth: 32.0, minHeight: 36.0),
            visualDensity: VisualDensity.compact,
            onPressed: () => _showExplodedDiagram(context),
          ),
          // Equipment picker (when no active conversation lock)
          if (activeConv == null) ...[
            IconButton(
              key: const Key('appbar_pick_equipment_button'),
              icon: Icon(
                selectedEq != null
                    ? Icons.precision_manufacturing_rounded
                    : Icons.precision_manufacturing_outlined,
                color: selectedEq != null ? AppColors.primary : AppColors.onSurfaceVariant,
                size: 19.0,
              ),
              tooltip: 'Choose plant equipment',
              padding: const EdgeInsets.symmetric(horizontal: 2.0),
              constraints: const BoxConstraints(minWidth: 32.0, minHeight: 36.0),
              visualDensity: VisualDensity.compact,
              onPressed: () => _showEquipmentPicker(context),
            ),
          ],
          // Dedicated EXPLORE 3D MACHINE entry point in AppBar
          if (selectedEq != null) ...[
            IconButton(
              key: const Key('appbar_explore_3d_button'),
              icon: const Icon(Icons.view_in_ar_rounded, size: 19.0, color: AppColors.primary),
              tooltip: 'EXPLORE 3D MACHINE',
              padding: const EdgeInsets.symmetric(horizontal: 2.0),
              constraints: const BoxConstraints(minWidth: 32.0, minHeight: 36.0),
              visualDensity: VisualDensity.compact,
              onPressed: () {
                ref.read(chatControllerProvider.notifier).openExplodedViewForMachine(selectedEq);
              },
            ),
          ],
          // Shift Tasks with Active Count Badge
          Consumer(
            builder: (ctx, r, _) {
              final activeCount = r.watch(activeTasksCountProvider);
              return Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    key: const Key('appbar_shift_tasks_button'),
                    icon: const Icon(Icons.assignment_outlined, size: 19.0, color: AppColors.onSurfaceVariant),
                    tooltip: "Today's Shift Tasks",
                    padding: const EdgeInsets.symmetric(horizontal: 2.0),
                    constraints: const BoxConstraints(minWidth: 32.0, minHeight: 36.0),
                    visualDensity: VisualDensity.compact,
                    onPressed: () {
                      Navigator.push(
                        ctx,
                        MaterialPageRoute(
                          builder: (_) => TasksScreen(
                            onConsultCopilot: (prompt, equipmentId) {
                              r.read(chatControllerProvider.notifier).sendMessage(prompt);
                            },
                          ),
                        ),
                      );
                    },
                  ),
                  if (activeCount > 0)
                    Positioned(
                      top: 4,
                      right: 2,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.surface, width: 1.5),
                        ),
                        constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                        child: Text(
                          '$activeCount',
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
              );
            },
          ),
          // Start New Consultation
          IconButton(
            key: const Key('appbar_new_consultation_button'),
            icon: const Icon(Icons.add_comment_outlined, size: 19.0, color: AppColors.onSurfaceVariant),
            tooltip: 'New consultation',
            padding: const EdgeInsets.symmetric(horizontal: 2.0),
            constraints: const BoxConstraints(minWidth: 32.0, minHeight: 36.0),
            visualDensity: VisualDensity.compact,
            onPressed: () {
              ref.read(chatControllerProvider.notifier).startNewConsultation();
            },
          ),
          const SizedBox(width: 4.0),
        ],
      ),
      body: Column(
        children: [
          const Divider(color: AppColors.border, height: 1.0),

          // Automatic Dead-Zone / Offline / Reconnecting Telemetry Banner
          if (networkState.status == NetworkStatus.reconnecting) ...[
            Container(
              key: const Key('offline_mode_banner'),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              decoration: const BoxDecoration(
                color: Color(0xFFEFF6FF),
                border: Border(bottom: BorderSide(color: Color(0xFFBFDBFE), width: 1.0)),
              ),
              child: Row(
                children: [
                  const SizedBox(
                    width: 12.0,
                    height: 12.0,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.0,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: 10.0),
                  Expanded(
                    child: Text(
                      'CONNECTION RESTORED // SYNCHRONIZING DATA',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ] else if (networkState.status == NetworkStatus.serverUnreachable) ...[
            Container(
              key: const Key('offline_mode_banner'),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              decoration: const BoxDecoration(
                color: Color(0xFFFFFBEB),
                border: Border(bottom: BorderSide(color: Color(0xFFFDE68A), width: 1.0)),
              ),
              child: Row(
                children: [
                  const StatusDot(color: AppColors.warning, size: 8.0),
                  const SizedBox(width: 8.0),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'SERVER UNAVAILABLE // CACHED DATA ONLY',
                          style: AppTypography.caption.copyWith(
                            color: Color(0xFFB45309),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          'Cloud API unreachable. Operating in local-only cache mode.',
                          style: AppTypography.caption.copyWith(
                            fontSize: 10.0,
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  InkWell(
                    key: const Key('retry_connection_button'),
                    onTap: () {
                      ref.read(connectivityControllerProvider.notifier).checkReachability(manual: true);
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                      child: Text(
                        'RECONNECT',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ] else if (networkState.isDeadZone || chatState.isOfflineMode) ...[
            Container(
              key: const Key('offline_mode_banner'),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              decoration: const BoxDecoration(
                color: Color(0xFFFFFBEB),
                border: Border(bottom: BorderSide(color: Color(0xFFFDE68A), width: 1.0)),
              ),
              child: Row(
                children: [
                  const StatusDot(color: AppColors.warning, size: 8.0),
                  const SizedBox(width: 8.0),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'DEAD-ZONE MODE ACTIVE // LOCAL PROCEDURES ONLY',
                          style: AppTypography.caption.copyWith(
                            color: Color(0xFFB45309),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          'No network connection. Using stored facility data & local AI procedures.',
                          style: AppTypography.caption.copyWith(
                            fontSize: 10.0,
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  InkWell(
                    key: const Key('retry_connection_button'),
                    onTap: () {
                      if (networkState.isDeadZone) {
                        ref.read(connectivityControllerProvider.notifier).checkReachability(manual: true);
                      } else {
                        ref.read(chatControllerProvider.notifier).toggleOfflineMode();
                      }
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                      child: Text(
                        networkState.isDeadZone ? 'RETRY' : 'GO ONLINE',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ] else if (currentEquipmentId != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
              color: AppColors.surfaceAlt,
              child: Row(
                children: [
                  const Icon(Icons.downloading_rounded, size: 14.0, color: AppColors.primary),
                  const SizedBox(width: 8.0),
                  Expanded(
                    child: Text(
                      'CACHE $currentEquipmentName FOR DEAD-ZONES'.toUpperCase(),
                      style: AppTypography.caption,
                    ),
                  ),
                  if (selectedEq != null) ...[
                    InkWell(
                      key: const Key('banner_explore_3d_button'),
                      onTap: () {
                        ref.read(chatControllerProvider.notifier).openExplodedViewForMachine(selectedEq);
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6.0),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.view_in_ar_rounded, size: 12.0, color: AppColors.primary),
                            const SizedBox(width: 4.0),
                            Text(
                              'EXPLORE 3D MACHINE',
                              style: AppTypography.caption.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8.0),
                  ],
                  InkWell(
                    onTap: () => _downloadOfflineAreaPack(
                      currentEquipmentId,
                      currentEquipmentName ?? 'MACHINE',
                    ),
                    child: Text(
                      'DOWNLOAD',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Main Chat Message Area
          Expanded(
            child: chatState.isLoadingHistory
                ? const Center(
                    child: SizedBox(
                      width: 24.0,
                      height: 24.0,
                      child: CircularProgressIndicator(strokeWidth: 2.0),
                    ),
                  )
                : chatState.historyError != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline_rounded,
                                  color: AppColors.error, size: 36.0),
                              const SizedBox(height: 12.0),
                              Text(
                                chatState.historyError!.toUpperCase(),
                                textAlign: TextAlign.center,
                                style: AppTypography.caption.copyWith(color: AppColors.error),
                              ),
                              const SizedBox(height: 16.0),
                              SecondaryButton(
                                label: 'RETRY LOADING',
                                onPressed: () {
                                  if (activeConv != null) {
                                    ref
                                        .read(chatControllerProvider.notifier)
                                        .selectConversation(activeConv);
                                  }
                                },
                              ),
                            ],
                          ),
                        ),
                      )
                    : chatState.messages.isEmpty
                        ? _buildEmptyState(context, user?.name)
                        : ListView.builder(
                            controller: _scrollController,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16.0,
                              vertical: 16.0,
                            ),
                            itemCount: chatState.messages.length,
                            itemBuilder: (context, index) {
                              final msg = chatState.messages[index];
                              return ChatBubble(
                                key: Key('chat_bubble_$index'),
                                message: msg,
                                onSendMessage: (prompt) {
                                  ref.read(chatControllerProvider.notifier).sendMessage(prompt);
                                },
                              );
                            },
                          ),
          ),

          // Generating / Loading Indicator Banner
          if (chatState.isSending) ...[
            Container(
              key: const Key('chat_sending_indicator'),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              color: AppColors.surfaceAlt,
              child: Row(
                children: [
                  const SizedBox(
                    width: 14.0,
                    height: 14.0,
                    child: CircularProgressIndicator(
                      strokeWidth: 1.8,
                      valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                    ),
                  ),
                  const SizedBox(width: 10.0),
                  Text(
                    chatState.isOfflineMode
                        ? 'Searching local cache & ranking passages...'
                        : 'Evaluating technical documents & drafting grounded answer...',
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ),
          ],

          // Sending Error Banner
          if (chatState.sendingError != null) ...[
            Container(
              key: const Key('chat_error_banner'),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 10.0),
              color: AppColors.error.withValues(alpha: 0.12),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 16.0),
                  const SizedBox(width: 8.0),
                  Expanded(
                    child: Text(
                      chatState.sendingError!,
                      style: AppTypography.caption.copyWith(color: AppColors.error),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 16.0, color: AppColors.onSurfaceVariant),
                    onPressed: () {
                      ref.read(chatControllerProvider.notifier).clearSendingError();
                    },
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ),
          ],

          // Multiline Message Composer: Exactly 4 elements
          ChatComposer(
            isSending: chatState.isSending,
            selectedEquipment: selectedEq,
            boundEquipmentName: activeConv?.equipmentName,
            activeComponentContext: chatState.activeComponentContext,
            onClearComponentContext: () {
              ref.read(chatControllerProvider.notifier).clearActiveComponentContext();
            },
            onSend: (message) {
              ref.read(chatControllerProvider.notifier).sendMessage(message);
            },
            onOpenCamera: () => _openCamera(context),
            onUploadMedia: () => _showMediaUploadModal(context),
            onClearEquipment: () {
              ref.read(chatControllerProvider.notifier).setSelectedEquipment(null);
            },
          ),
        ],
      ),
      bottomNavigationBar: TerminalBottomNavBar(
        activeTab: _activeTab,
        onTabSelected: _handleTabSelect,
        onFabPressed: _handleFabAction,
        tasksBadgeCount: ref.watch(activeTasksCountProvider),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, String? userName) {
    final selectedEq = ref.watch(chatControllerProvider).selectedEquipment;

    final filterEquipmentList = [
      'Boiler B-201',
      'Slurry Pump P-102',
      'Conveyor A61',
      'Turbocompressor B01',
      'LOTO Safety',
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 20.0),
      child: Column(
        children: [
          const SizedBox(height: 8.0),

          // Central Glowing AI Orb — Signature centerpiece from reference
          const AiOrbWidget(
            size: 130.0,
            isPulsing: true,
          ),
          const SizedBox(height: 18.0),

          Text(
            'New Consultation',
            style: AppTypography.headlineLg.copyWith(
              fontSize: 22.0,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4.0),
          Text(
            'Industrial Reliability Copilot',
            style: AppTypography.labelUppercase.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8.0),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Text(
              'Ask technical questions grounded in OEM manuals, equipment blueprints, and engineering standards.'
                  .toUpperCase(),
              textAlign: TextAlign.center,
              style: AppTypography.caption.copyWith(
                height: 1.4,
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ),
          const SizedBox(height: 20.0),

          // Equipment Filter Chips (Horizontally scrollable, reference style)
          SizedBox(
            height: 38.0,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: filterEquipmentList.length,
              separatorBuilder: (context, index) => const SizedBox(width: 8.0),
              itemBuilder: (context, idx) {
                final eqName = filterEquipmentList[idx];
                final isSelected = selectedEq?.name.contains(eqName) ?? false;

                return InkWell(
                  borderRadius: BorderRadius.circular(20.0),
                  onTap: () {
                    final notifier = ref.read(chatControllerProvider.notifier);
                    if (isSelected) {
                      notifier.setSelectedEquipment(null);
                    } else {
                      notifier.sendMessage('Status and maintenance procedure for $eqName');
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.primaryAction : AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(20.0),
                      border: Border.all(
                        color: isSelected ? AppColors.primaryAction : AppColors.border,
                        width: 1.0,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: isSelected ? 0.08 : 0.02),
                          blurRadius: 4.0,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        eqName,
                        style: AppTypography.caption.copyWith(
                          color: isSelected ? Colors.white : AppColors.onSurfaceVariant,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          fontSize: 11.5,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 24.0),

          // Section Header with the 4px Primary Bar
          const SectionHeader(
            title: 'GUIDED WORKFLOWS & FLEET TELEMETRY',
            padding: EdgeInsets.only(bottom: 12.0),
          ),

          InstrumentListRow(
            title: 'Guided Diagnostic Assessment',
            subtitle: '5-STEP ROOT CAUSE ISOLATION // FIELD TELEMETRY',
            categoricalColor: AppColors.accentCyan,
            icon: Icons.tune_rounded,
            onTap: () => _openGuidedDiagnostics(context),
          ),
          InstrumentListRow(
            title: 'Plant Reliability & Telemetry Insight',
            subtitle: 'AREA 4 FLEET HEALTH // +8% UPTIME SCOREBOARD',
            categoricalColor: AppColors.primary,
            icon: Icons.analytics_rounded,
            onTap: () => _openPlantInsight(context),
          ),
          const SizedBox(height: 12.0),

          // Section Header with the 4px Primary Bar
          const SectionHeader(
            title: 'SUGGESTED TECHNICAL INQUIRIES',
            padding: EdgeInsets.only(bottom: 12.0),
          ),

          // Suggested Queries as Instrumented Rows with Categorical Identity Dots
          InstrumentListRow(
            title: 'Model SP-400X Slurry Pump mechanical seal torque spec',
            subtitle: 'CENTRIFUGAL SLURRY PUMP // SEC 4.2',
            categoricalColor: AppColors.accentCategorical1,
            onTap: () {
              ref
                  .read(chatControllerProvider.notifier)
                  .sendMessage('Model SP-400X Slurry Pump mechanical seal torque spec');
            },
          ),
          InstrumentListRow(
            title: 'Hydraulic press HP-400 lockout tagout procedure',
            subtitle: 'STANDARD OPERATING PROCEDURE // LOTO SEC 3.1',
            categoricalColor: AppColors.accentCategorical2,
            onTap: () {
              ref
                  .read(chatControllerProvider.notifier)
                  .sendMessage('Hydraulic press HP-400 lockout tagout procedure');
            },
          ),
          InstrumentListRow(
            title: 'Rotary screw compressor fault E-0247 diagnostic',
            subtitle: 'AIR COMPRESSOR GUIDE // FAULT E-0247',
            categoricalColor: AppColors.accentCategorical3,
            onTap: () {
              ref
                  .read(chatControllerProvider.notifier)
                  .sendMessage('Rotary screw compressor fault E-0247 diagnostic');
            },
          ),
        ],
      ),
    );
  }
}
