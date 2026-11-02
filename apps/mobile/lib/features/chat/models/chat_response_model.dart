import 'citation_model.dart';
import 'exploded_view_model.dart';
import 'safety_preconditions_model.dart';

class ChatResponseModel {
  final String answer;
  final List<CitationModel> citations;
  final String warningLevel;
  final double? confidenceScore;
  final String? provider;
  final SafetyPreconditionsModel? safetyPreconditions;
  final SuggestedTicketModel? suggestedTicket;
  final List<String> expandedTerms;
  final String messageType;
  final ExplodedViewModel? explodedView;
  final Map<String, dynamic>? machineContext;

  const ChatResponseModel({
    required this.answer,
    this.citations = const [],
    this.warningLevel = 'none',
    this.confidenceScore,
    this.provider,
    this.safetyPreconditions,
    this.suggestedTicket,
    this.expandedTerms = const [],
    this.messageType = 'text',
    this.explodedView,
    this.machineContext,
  });

  factory ChatResponseModel.fromJson(Map<String, dynamic> json) {
    List<CitationModel> parsedCitations = [];
    if (json['citations'] is List) {
      parsedCitations = (json['citations'] as List)
          .whereType<Map<String, dynamic>>()
          .map((c) => CitationModel.fromJson(c))
          .toList();
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

    final msgType = json['messageType']?.toString() ??
        (json['explodedView'] != null ? 'exploded_view' : 'text');
    ExplodedViewModel? expView;
    if (json['explodedView'] is Map) {
      expView = ExplodedViewModel.fromJson(
        Map<String, dynamic>.from(json['explodedView'] as Map),
      );
    }

    return ChatResponseModel(
      answer: json['answer']?.toString() ?? '',
      citations: parsedCitations,
      warningLevel: json['warningLevel']?.toString() ?? 'none',
      confidenceScore: (json['confidenceScore'] is num)
          ? (json['confidenceScore'] as num).toDouble()
          : null,
      provider: json['provider'] as String?,
      safetyPreconditions: safety,
      suggestedTicket: ticket,
      expandedTerms: terms,
      messageType: msgType,
      explodedView: expView,
      machineContext: json['machineContext'] is Map
          ? Map<String, dynamic>.from(json['machineContext'] as Map)
          : null,
    );
  }
}
