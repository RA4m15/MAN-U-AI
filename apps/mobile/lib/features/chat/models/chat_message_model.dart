import 'citation_model.dart';

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
    };
  }
}
