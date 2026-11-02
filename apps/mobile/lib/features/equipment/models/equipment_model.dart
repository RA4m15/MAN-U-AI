class CadModelInfo {
  final bool available;
  final String? format;
  final String? storageReference;
  final String? version;
  final int? fileSizeBytes;
  final DateTime? uploadedAt;

  const CadModelInfo({
    this.available = false,
    this.format,
    this.storageReference,
    this.version,
    this.fileSizeBytes,
    this.uploadedAt,
  });

  factory CadModelInfo.fromJson(Map<String, dynamic> json) {
    return CadModelInfo(
      available: json['available'] == true,
      format: json['format']?.toString(),
      storageReference: json['storageReference']?.toString(),
      version: json['version']?.toString(),
      fileSizeBytes: json['fileSizeBytes'] is num ? (json['fileSizeBytes'] as num).toInt() : null,
      uploadedAt: json['uploadedAt'] != null ? DateTime.tryParse(json['uploadedAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'available': available,
    if (format != null) 'format': format,
    if (storageReference != null) 'storageReference': storageReference,
    if (version != null) 'version': version,
    if (fileSizeBytes != null) 'fileSizeBytes': fileSizeBytes,
    if (uploadedAt != null) 'uploadedAt': uploadedAt?.toIso8601String(),
  };
}

class EquipmentModel {
  final String id;
  final String name;
  final String type;
  final String? model;
  final String? manufacturer;
  final String? location;
  final String? serialNumber;
  final String? category;
  final String? referenceImage;
  final CadModelInfo? cadModel;
  final List<String> documentation;
  final List<Map<String, dynamic>> components;
  final Map<String, dynamic>? explosionConfiguration;

  const EquipmentModel({
    required this.id,
    required this.name,
    required this.type,
    this.model,
    this.manufacturer,
    this.location,
    this.serialNumber,
    this.category,
    this.referenceImage,
    this.cadModel,
    this.documentation = const [],
    this.components = const [],
    this.explosionConfiguration,
  });

  bool get hasCadModel => cadModel?.available == true;
  String get effectiveCategory => category ?? type;

  String get displayName {
    if (model != null && model!.isNotEmpty) {
      return '$name ($model)';
    }
    return name;
  }

  factory EquipmentModel.fromJson(Map<String, dynamic> json) {
    List<String> docList = [];
    if (json['documentation'] is List) {
      docList = (json['documentation'] as List)
          .map((e) => e is Map ? (e['title'] ?? e['name'] ?? e.toString()).toString() : e.toString())
          .toList();
    }

    List<Map<String, dynamic>> compList = [];
    if (json['components'] is List) {
      compList = (json['components'] as List)
          .whereType<Map<String, dynamic>>()
          .toList();
    }

    CadModelInfo? cad;
    if (json['cadModel'] is Map<String, dynamic>) {
      cad = CadModelInfo.fromJson(json['cadModel'] as Map<String, dynamic>);
    }

    return EquipmentModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Equipment',
      type: json['type']?.toString() ?? 'General',
      model: json['model']?.toString(),
      manufacturer: json['manufacturer']?.toString(),
      location: json['location']?.toString(),
      serialNumber: json['serialNumber']?.toString(),
      category: json['category']?.toString(),
      referenceImage: json['referenceImage']?.toString(),
      cadModel: cad,
      documentation: docList,
      components: compList,
      explosionConfiguration: json['explosionConfiguration'] is Map<String, dynamic>
          ? json['explosionConfiguration'] as Map<String, dynamic>
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type,
      if (model != null) 'model': model,
      if (manufacturer != null) 'manufacturer': manufacturer,
      if (location != null) 'location': location,
      if (serialNumber != null) 'serialNumber': serialNumber,
      if (category != null) 'category': category,
      if (referenceImage != null) 'referenceImage': referenceImage,
      if (cadModel != null) 'cadModel': cadModel!.toJson(),
      if (documentation.isNotEmpty) 'documentation': documentation,
      if (components.isNotEmpty) 'components': components,
      if (explosionConfiguration != null) 'explosionConfiguration': explosionConfiguration,
    };
  }
}
