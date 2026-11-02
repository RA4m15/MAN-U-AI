/// Immutable state model representing active component selection and viewer synchronization.
class CadComponentSelectionState {
  final String machineId;
  final String? selectedPartId;
  final String? selectedPartName;
  final String? parentId;
  final List<String> assemblyPath;
  final Map<String, dynamic> metadata;
  final int currentStep;
  final int totalSteps;
  final bool isViewerReady;
  final bool isLoading;
  final String? errorMessage;

  const CadComponentSelectionState({
    required this.machineId,
    this.selectedPartId,
    this.selectedPartName,
    this.parentId,
    this.assemblyPath = const [],
    this.metadata = const {},
    this.currentStep = 1,
    this.totalSteps = 1,
    this.isViewerReady = false,
    this.isLoading = false,
    this.errorMessage,
  });

  factory CadComponentSelectionState.initial(String machineId, {int initialStep = 1, int totalSteps = 1}) {
    return CadComponentSelectionState(
      machineId: machineId,
      currentStep: initialStep,
      totalSteps: totalSteps,
      isViewerReady: false,
      isLoading: true,
    );
  }

  bool get hasSelection => selectedPartId != null && selectedPartId!.trim().isNotEmpty;

  String get displayName => selectedPartName?.trim().isNotEmpty == true
      ? selectedPartName!
      : (selectedPartId ?? 'Unknown Part');

  String get breadcrumbs => assemblyPath.isNotEmpty
      ? assemblyPath.join(' > ')
      : displayName;

  CadComponentSelectionState copyWith({
    String? machineId,
    String? selectedPartId,
    String? selectedPartName,
    String? parentId,
    List<String>? assemblyPath,
    Map<String, dynamic>? metadata,
    int? currentStep,
    int? totalSteps,
    bool? isViewerReady,
    bool? isLoading,
    String? errorMessage,
    bool clearSelected = false,
  }) {
    return CadComponentSelectionState(
      machineId: machineId ?? this.machineId,
      selectedPartId: clearSelected ? null : (selectedPartId ?? this.selectedPartId),
      selectedPartName: clearSelected ? null : (selectedPartName ?? this.selectedPartName),
      parentId: clearSelected ? null : (parentId ?? this.parentId),
      assemblyPath: clearSelected ? const [] : (assemblyPath ?? this.assemblyPath),
      metadata: clearSelected ? const {} : (metadata ?? this.metadata),
      currentStep: currentStep ?? this.currentStep,
      totalSteps: totalSteps ?? this.totalSteps,
      isViewerReady: isViewerReady ?? this.isViewerReady,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }

  CadComponentSelectionState clearSelection() {
    return copyWith(clearSelected: true);
  }

  Map<String, dynamic> toContextMap() {
    return {
      'machineId': machineId,
      'selectedPartId': selectedPartId,
      'selectedPartName': selectedPartName,
      'parentId': parentId,
      'assemblyPath': assemblyPath,
      'currentStep': currentStep,
      'totalSteps': totalSteps,
      'metadata': metadata,
    };
  }

  Map<String, dynamic> toMachineContext({String? machineName}) {
    return {
      'machineId': machineId,
      if (machineName != null && machineName.isNotEmpty) 'machineName': machineName,
      if (selectedPartId != null && selectedPartId!.isNotEmpty)
        'selectedPartId': selectedPartId,
      if (selectedPartName != null && selectedPartName!.isNotEmpty)
        'selectedPartName': selectedPartName,
      if (parentId != null && parentId!.isNotEmpty)
        'parentAssemblyId': parentId,
      'currentExplosionStep': currentStep,
    };
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is CadComponentSelectionState &&
        other.machineId == machineId &&
        other.selectedPartId == selectedPartId &&
        other.selectedPartName == selectedPartName &&
        other.parentId == parentId &&
        other.currentStep == currentStep &&
        other.totalSteps == totalSteps &&
        other.isViewerReady == isViewerReady &&
        other.isLoading == isLoading &&
        other.errorMessage == errorMessage;
  }

  @override
  int get hashCode => Object.hash(
        machineId,
        selectedPartId,
        selectedPartName,
        parentId,
        currentStep,
        totalSteps,
        isViewerReady,
        isLoading,
        errorMessage,
      );
}

