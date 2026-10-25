class EquipmentModel {
  final String id;
  final String name;
  final String type;
  final String? model;
  final String? manufacturer;
  final String? location;
  final String? serialNumber;

  const EquipmentModel({
    required this.id,
    required this.name,
    required this.type,
    this.model,
    this.manufacturer,
    this.location,
    this.serialNumber,
  });

  String get displayName {
    if (model != null && model!.isNotEmpty) {
      return '$name ($model)';
    }
    return name;
  }

  factory EquipmentModel.fromJson(Map<String, dynamic> json) {
    return EquipmentModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Equipment',
      type: json['type']?.toString() ?? 'General',
      model: json['model']?.toString(),
      manufacturer: json['manufacturer']?.toString(),
      location: json['location']?.toString(),
      serialNumber: json['serialNumber']?.toString(),
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
    };
  }
}
