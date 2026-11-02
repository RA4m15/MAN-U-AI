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
  final Map<String, dynamic>? workerAnswer;

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
    this.workerAnswer,
  });

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';

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
      workerAnswer: json['workerAnswer'] is Map ? Map<String, dynamic>.from(json['workerAnswer'] as Map) : null,
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
      if (workerAnswer != null) 'workerAnswer': workerAnswer,
    };
  }
}
