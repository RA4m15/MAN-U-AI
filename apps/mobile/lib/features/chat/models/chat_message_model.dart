import 'exploded_view_model.dart';
import 'citation_model.dart';
import 'safety_preconditions_model.dart';

class ChatMessageModel {
  final String? id;
  final String? conversationId;
  final String role;
  final String content;
  final List<CitationModel> citations;
  final DateTime? createdAt;
  final String? warningLevel;
  final double? confidenceScore;
  final String? provider;
  final SafetyPreconditionsModel? safetyPreconditions;
  final SuggestedTicketModel? suggestedTicket;
  final List<String> expandedTerms;
  final bool isOfflineFallback;
  final String messageType;
  final ExplodedViewModel? explodedView;
  final Map<String, dynamic>? machineContext;

  const ChatMessageModel({
    this.id,
    this.conversationId,
    required this.role,
    required this.content,
    this.citations = const [],
    this.createdAt,
    this.warningLevel,
    this.confidenceScore,
    this.provider,
    this.safetyPreconditions,
    this.suggestedTicket,
    this.expandedTerms = const [],
    this.isOfflineFallback = false,
    this.messageType = 'text',
    this.explodedView,
    this.machineContext,
  });

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';
  bool get isExplodedView => messageType == 'exploded_view' || explodedView != null;

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) {
    List<CitationModel> parsedCitations = [];
    if (json['citations'] is List) {
      for (final item in json['citations'] as List) {
        if (item is Map) {
          parsedCitations.add(
            CitationModel.fromJson(Map<String, dynamic>.from(item)),
          );
        }
      }
    }

    DateTime? parsedDate;
    if (json['createdAt'] is String) {
      parsedDate = DateTime.tryParse(json['createdAt'] as String);
    }

    SafetyPreconditionsModel? safety;
    if (json['safetyPreconditions'] is Map) {
      safety = SafetyPreconditionsModel.fromJson(
        Map<String, dynamic>.from(json['safetyPreconditions'] as Map),
      );
    }

    SuggestedTicketModel? ticket;
    if (json['suggestedTicket'] is Map) {
      ticket = SuggestedTicketModel.fromJson(
        Map<String, dynamic>.from(json['suggestedTicket'] as Map),
      );
    }

    List<String> terms = [];
    if (json['expandedTerms'] is List) {
      terms = (json['expandedTerms'] as List).map((e) => e.toString()).toList();
    }

    final msgType = json['messageType']?.toString() ?? json['type']?.toString() ?? 'text';
    ExplodedViewModel? expView;
    if (json['explodedView'] is Map) {
      expView = ExplodedViewModel.fromJson(
        Map<String, dynamic>.from(json['explodedView'] as Map),
      );
    } else if (msgType == 'exploded_view' && json.containsKey('modelUrl')) {
      expView = ExplodedViewModel.fromJson(json);
    }

    return ChatMessageModel(
      id: json['id']?.toString() ?? json['_id']?.toString(),
      conversationId: json['conversationId']?.toString(),
      role: json['role'] as String? ?? 'assistant',
      content: json['content'] as String? ?? '',
      citations: parsedCitations,
      createdAt: parsedDate,
      warningLevel: json['warningLevel'] as String?,
      confidenceScore: (json['confidenceScore'] is num)
          ? (json['confidenceScore'] as num).toDouble()
          : null,
      provider: json['provider'] as String?,
      safetyPreconditions: safety,
      suggestedTicket: ticket,
      expandedTerms: terms,
      isOfflineFallback: json['isOfflineFallback'] == true,
      messageType: msgType,
      explodedView: expView,
      machineContext: json['machineContext'] is Map ? Map<String, dynamic>.from(json['machineContext'] as Map) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      if (conversationId != null) 'conversationId': conversationId,
      'role': role,
      'content': content,
      'citations': citations.map((c) => c.toJson()).toList(),
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
      if (warningLevel != null) 'warningLevel': warningLevel,
      if (confidenceScore != null) 'confidenceScore': confidenceScore,
      if (provider != null) 'provider': provider,
      if (safetyPreconditions != null) 'safetyPreconditions': safetyPreconditions!.toJson(),
      if (suggestedTicket != null) 'suggestedTicket': suggestedTicket!.toJson(),
      'expandedTerms': expandedTerms,
      'isOfflineFallback': isOfflineFallback,
      'messageType': messageType,
      if (explodedView != null) 'explodedView': explodedView!.toJson(),
      if (machineContext != null) 'machineContext': machineContext,
    };
  }
}
