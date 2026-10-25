import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../auth/models/auth_state.dart';
import '../controllers/chat_controller.dart';
import 'widgets/chat_bubble.dart';
import 'widgets/chat_composer.dart';
import 'widgets/conversation_drawer.dart';
import 'widgets/equipment_picker_modal.dart';
import '../../documents/views/widgets/document_upload_modal.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _scrollController = ScrollController();

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

  void _showUploadModal(BuildContext context) {
    final currentEq = ref.read(chatControllerProvider).selectedEquipment;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => DocumentUploadModal(
        defaultEquipment: currentEq,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatControllerProvider);
    final activeConv = chatState.activeConversation;
    final selectedEq = chatState.selectedEquipment;
    final authState = ref.watch(authControllerProvider);
    final user = authState is Authenticated ? authState.user : null;

    // Trigger scroll to bottom whenever messages count changes
    ref.listen(
      chatControllerProvider.select((s) => s.messages.length),
      (previous, next) {
        if (next > (previous ?? 0)) {
          _scrollToBottom();
        }
      },
    );

    return Scaffold(
      backgroundColor: AppColors.canvas,
      drawer: const ConversationDrawer(),
      appBar: AppBar(
        backgroundColor: AppColors.canvas,
        elevation: 0,
        titleSpacing: 0,
        leading: Builder(
          builder: (context) => IconButton(
            key: const Key('open_drawer_button'),
            icon: const Icon(Icons.menu_rounded, color: AppColors.ink),
            onPressed: () => Scaffold.of(context).openDrawer(),
            tooltip: 'Consultation history',
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              activeConv != null ? activeConv.title : 'New Consultation',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 1.0),
            Text(
              activeConv?.equipmentName ??
                  selectedEq?.displayName ??
                  'General Facility Knowledge',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11.0,
                color: AppColors.primaryHover,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          if (activeConv == null) ...[
            IconButton(
              key: const Key('appbar_pick_equipment_button'),
              icon: Icon(
                selectedEq != null ? Icons.tune_rounded : Icons.tune_outlined,
                color: selectedEq != null ? AppColors.primary : AppColors.inkSubtle,
                size: 20.0,
              ),
              tooltip: 'Choose plant equipment',
              onPressed: () => _showEquipmentPicker(context),
            ),
          ],
          if (user?.role == 'engineer') ...[
            IconButton(
              key: const Key('appbar_upload_document_button'),
              icon: const Icon(Icons.upload_file_rounded, color: AppColors.inkSubtle, size: 20.0),
              tooltip: 'Ingest technical manual (PDF)',
              onPressed: () => _showUploadModal(context),
            ),
          ],
          IconButton(
            key: const Key('appbar_new_consultation_button'),
            icon: const Icon(Icons.add_comment_outlined, color: AppColors.inkSubtle, size: 20.0),
            tooltip: 'Start new consultation',
            onPressed: () {
              ref.read(chatControllerProvider.notifier).startNewConsultation();
            },
          ),
          const SizedBox(width: 4.0),
        ],
      ),
      body: Column(
        children: [
          const Divider(color: AppColors.hairline, height: 1.0),

          // Main Chat Area
          Expanded(
            child: chatState.isLoadingHistory
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircularProgressIndicator(strokeWidth: 2.2),
                        SizedBox(height: 12.0),
                        Text(
                          'Loading consultation history...',
                          style: TextStyle(color: AppColors.inkSubtle, fontSize: 12.0),
                        ),
                      ],
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
                                  color: AppColors.danger, size: 36.0),
                              const SizedBox(height: 12.0),
                              Text(
                                chatState.historyError!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: AppColors.ink, fontSize: 13.0),
                              ),
                              const SizedBox(height: 16.0),
                              ElevatedButton(
                                onPressed: () {
                                  if (activeConv != null) {
                                    ref
                                        .read(chatControllerProvider.notifier)
                                        .selectConversation(activeConv);
                                  }
                                },
                                child: const Text('Retry Loading History'),
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
                              );
                            },
                          ),
          ),

          // Loading / Generating Indicator Banner
          if (chatState.isSending) ...[
            Container(
              key: const Key('chat_sending_indicator'),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              color: AppColors.surface1,
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
                    'Evaluating technical documents & drafting grounded answer...',
                    style: TextStyle(
                      color: AppColors.inkMuted,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                    ),
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
              color: AppColors.danger.withValues(alpha: 0.12),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 16.0),
                  const SizedBox(width: 8.0),
                  Expanded(
                    child: Text(
                      chatState.sendingError!,
                      style: const TextStyle(
                        color: AppColors.ink,
                        fontSize: 12.0,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 16.0, color: AppColors.inkSubtle),
                    onPressed: () {
                      ref.read(chatControllerProvider.notifier).clearSendingError();
                    },
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ),
          ],

          // Multiline Message Composer
          ChatComposer(
            isSending: chatState.isSending,
            selectedEquipment: selectedEq,
            boundEquipmentName: activeConv?.equipmentName,
            onSend: (message) {
              ref.read(chatControllerProvider.notifier).sendMessage(message);
            },
            onPickEquipment: () => _showEquipmentPicker(context),
            onClearEquipment: () {
              ref.read(chatControllerProvider.notifier).setSelectedEquipment(null);
            },
            onUploadDocument: () => _showUploadModal(context),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, String? userName) {
    const suggestions = [
      'Model SP-400X Slurry Pump mechanical seal torque spec',
      'Hydraulic oil operating pressure troubleshooting SOP',
      'Bearing vibration analysis protocol and limits',
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 24.0),
      child: Column(
        children: [
          const SizedBox(height: 20.0),
          Container(
            width: 48.0,
            height: 48.0,
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(12.0),
              border: Border.all(color: AppColors.hairlineStrong),
            ),
            child: const Icon(
              Icons.precision_manufacturing_rounded,
              color: AppColors.primary,
              size: 26.0,
            ),
          ),
          const SizedBox(height: 14.0),
          Text(
            'Industrial Reliability Copilot',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink,
                ),
          ),
          const SizedBox(height: 6.0),
          Text(
            'Ask technical questions grounded in OEM manuals, equipment blueprints, and engineering standards.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.inkSubtle,
                  height: 1.45,
                ),
          ),
          const SizedBox(height: 28.0),

          // Suggested Queries
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'SUGGESTED TECHNICAL INQUIRIES',
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                color: AppColors.inkSubtle,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(height: 10.0),
          ...suggestions.map(
            (suggestion) => Container(
              margin: const EdgeInsets.only(bottom: 8.0),
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
                  backgroundColor: AppColors.surface1,
                  side: const BorderSide(color: AppColors.hairline),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.0)),
                ),
                onPressed: () {
                  ref.read(chatControllerProvider.notifier).sendMessage(suggestion);
                },
                child: Row(
                  children: [
                    const Icon(Icons.arrow_forward_rounded, size: 14.0, color: AppColors.primaryHover),
                    const SizedBox(width: 8.0),
                    Expanded(
                      child: Text(
                        suggestion,
                        style: const TextStyle(
                          color: AppColors.inkMuted,
                          fontSize: 12.0,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
