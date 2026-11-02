/// Model for structured exploded-view CAD visualization chat messages.
class ExplodedViewModel {
  final String machineId;
  final String machineName;
  final String modelUrl;
  final String title;
  final String description;
  final String? conversationId;
  final int? initialStep;
  final int? totalSteps;
  final Map<String, dynamic>? sequenceConfig;
  final String? viewerInstanceId;
  final bool isCadPending;
  final String? referenceImage;
  final List<String> documentation;

  const ExplodedViewModel({
    required this.machineId,
    required this.machineName,
    required this.modelUrl,
    required this.title,
    required this.description,
    this.conversationId,
    this.initialStep,
    this.totalSteps,
    this.sequenceConfig,
    this.viewerInstanceId,
    this.isCadPending = false,
    this.referenceImage,
    this.documentation = const [],
  });

  factory ExplodedViewModel.fromJson(Map<String, dynamic> json) {
    List<String> docs = [];
    if (json['documentation'] is List) {
      docs = (json['documentation'] as List).map((e) => e.toString()).toList();
    }

    final rawModelUrl = json['modelUrl']?.toString() ?? '';
    final pendingFlag = json['isCadPending'] == true ||
        (json['cadModel'] is Map && json['cadModel']['available'] == false) ||
        rawModelUrl.isEmpty;

    return ExplodedViewModel(
      machineId: json['machineId']?.toString() ?? 'machine_001',
      machineName: json['machineName']?.toString() ?? 'Industrial Equipment',
      modelUrl: rawModelUrl,
      title: json['title']?.toString() ?? 'Machine Structure Explanation',
      description: json['description']?.toString() ?? 'Explore the exploded machine assembly.',
      conversationId: json['conversationId']?.toString(),
      initialStep: (json['initialStep'] is num) ? (json['initialStep'] as num).toInt() : null,
      totalSteps: (json['totalSteps'] is num) ? (json['totalSteps'] as num).toInt() : null,
      sequenceConfig: json['sequenceConfig'] is Map ? Map<String, dynamic>.from(json['sequenceConfig'] as Map) : null,
      viewerInstanceId: json['viewerInstanceId']?.toString(),
      isCadPending: pendingFlag,
      referenceImage: json['referenceImage']?.toString(),
      documentation: docs,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'machineId': machineId,
      'machineName': machineName,
      'modelUrl': modelUrl,
      'title': title,
      'description': description,
      if (conversationId != null) 'conversationId': conversationId,
      if (initialStep != null) 'initialStep': initialStep,
      if (totalSteps != null) 'totalSteps': totalSteps,
      if (sequenceConfig != null) 'sequenceConfig': sequenceConfig,
      if (viewerInstanceId != null) 'viewerInstanceId': viewerInstanceId,
      'isCadPending': isCadPending,
      if (referenceImage != null) 'referenceImage': referenceImage,
      if (documentation.isNotEmpty) 'documentation': documentation,
    };
  }

  ExplodedViewModel copyWith({
    String? machineId,
    String? machineName,
    String? modelUrl,
    String? title,
    String? description,
    String? conversationId,
    int? initialStep,
    int? totalSteps,
    Map<String, dynamic>? sequenceConfig,
    String? viewerInstanceId,
    bool? isCadPending,
    String? referenceImage,
    List<String>? documentation,
  }) {
    return ExplodedViewModel(
      machineId: machineId ?? this.machineId,
      machineName: machineName ?? this.machineName,
      modelUrl: modelUrl ?? this.modelUrl,
      title: title ?? this.title,
      description: description ?? this.description,
      conversationId: conversationId ?? this.conversationId,
      initialStep: initialStep ?? this.initialStep,
      totalSteps: totalSteps ?? this.totalSteps,
      sequenceConfig: sequenceConfig ?? this.sequenceConfig,
      viewerInstanceId: viewerInstanceId ?? this.viewerInstanceId,
      isCadPending: isCadPending ?? this.isCadPending,
      referenceImage: referenceImage ?? this.referenceImage,
      documentation: documentation ?? this.documentation,
    );
  }
}
