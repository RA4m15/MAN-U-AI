class ConversationModel {
  final String id;
  final String title;
  final String? equipmentId;
  final String? equipmentName;
  final DateTime? lastMessageAt;
  final DateTime? createdAt;

  const ConversationModel({
    required this.id,
    required this.title,
    this.equipmentId,
    this.equipmentName,
    this.lastMessageAt,
    this.createdAt,
  });

  factory ConversationModel.fromJson(Map<String, dynamic> json) {
    return ConversationModel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'New Consultation',
      equipmentId: json['equipmentId']?.toString(),
      equipmentName: json['equipmentName']?.toString(),
      lastMessageAt: json['lastMessageAt'] is String
          ? DateTime.tryParse(json['lastMessageAt'] as String)
          : null,
      createdAt: json['createdAt'] is String
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      if (equipmentId != null) 'equipmentId': equipmentId,
      if (equipmentName != null) 'equipmentName': equipmentName,
      if (lastMessageAt != null) 'lastMessageAt': lastMessageAt!.toIso8601String(),
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
    };
  }

  ConversationModel copyWith({
    String? id,
    String? title,
    String? equipmentId,
    String? equipmentName,
    DateTime? lastMessageAt,
    DateTime? createdAt,
  }) {
    return ConversationModel(
      id: id ?? this.id,
      title: title ?? this.title,
      equipmentId: equipmentId ?? this.equipmentId,
      equipmentName: equipmentName ?? this.equipmentName,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
