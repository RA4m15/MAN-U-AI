class TaskModel {
  final String id;
  final String title;
  final String description;
  final String priority; // critical, high, medium, low
  final String status; // pending, in_progress, completed, cancelled
  final String? equipmentId;
  final String? equipmentName;
  final String assignedTo;
  final String assignedToName;
  final String shift;
  final String? createdByName;
  final String? completionNotes;
  final DateTime createdAt;
  final DateTime? completedAt;

  const TaskModel({
    required this.id,
    required this.title,
    required this.description,
    required this.priority,
    required this.status,
    this.equipmentId,
    this.equipmentName,
    this.assignedTo = 'all',
    this.assignedToName = 'All Field Engineers',
    this.shift = 'today',
    this.createdByName,
    this.completionNotes,
    required this.createdAt,
    this.completedAt,
  });

  bool get isPending => status == 'pending';
  bool get isInProgress => status == 'in_progress';
  bool get isCompleted => status == 'completed';

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    return TaskModel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      title: json['title'] as String? ?? 'Untitled Task',
      description: json['description'] as String? ?? '',
      priority: json['priority'] as String? ?? 'medium',
      status: json['status'] as String? ?? 'pending',
      equipmentId: json['equipmentId'] as String?,
      equipmentName: json['equipmentName'] as String?,
      assignedTo: json['assignedTo'] as String? ?? 'all',
      assignedToName: json['assignedToName'] as String? ?? 'All Field Engineers',
      shift: json['shift'] as String? ?? 'today',
      createdByName: json['createdByName'] as String?,
      completionNotes: json['completionNotes'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      completedAt: json['completedAt'] != null
          ? DateTime.tryParse(json['completedAt'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'priority': priority,
      'status': status,
      if (equipmentId != null) 'equipmentId': equipmentId,
      if (equipmentName != null) 'equipmentName': equipmentName,
      'assignedTo': assignedTo,
      'assignedToName': assignedToName,
      'shift': shift,
      if (createdByName != null) 'createdByName': createdByName,
      if (completionNotes != null) 'completionNotes': completionNotes,
      'createdAt': createdAt.toIso8601String(),
      if (completedAt != null) 'completedAt': completedAt!.toIso8601String(),
    };
  }

  TaskModel copyWith({
    String? status,
    String? completionNotes,
    DateTime? completedAt,
  }) {
    return TaskModel(
      id: id,
      title: title,
      description: description,
      priority: priority,
      status: status ?? this.status,
      equipmentId: equipmentId,
      equipmentName: equipmentName,
      assignedTo: assignedTo,
      assignedToName: assignedToName,
      shift: shift,
      createdByName: createdByName,
      completionNotes: completionNotes ?? this.completionNotes,
      createdAt: createdAt,
      completedAt: completedAt ?? this.completedAt,
    );
  }
}

