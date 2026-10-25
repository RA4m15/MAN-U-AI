import 'citation_model.dart';

class ChatResponseModel {
  final String answer;
  final List<CitationModel> citations;
  final String warningLevel;
  final double? confidenceScore;
  final String? provider;

  const ChatResponseModel({
    required this.answer,
    this.citations = const [],
    this.warningLevel = 'none',
    this.confidenceScore,
    this.provider,
  });

  factory ChatResponseModel.fromJson(Map<String, dynamic> json) {
    List<CitationModel> parsedCitations = [];
    if (json['citations'] is List) {
      parsedCitations = (json['citations'] as List)
          .whereType<Map<String, dynamic>>()
          .map((c) => CitationModel.fromJson(c))
          .toList();
    }

    return ChatResponseModel(
      answer: json['answer']?.toString() ?? '',
      citations: parsedCitations,
      warningLevel: json['warningLevel']?.toString() ?? 'none',
      confidenceScore: (json['confidenceScore'] is num)
          ? (json['confidenceScore'] as num).toDouble()
          : null,
      provider: json['provider'] as String?,
    );
  }
}
