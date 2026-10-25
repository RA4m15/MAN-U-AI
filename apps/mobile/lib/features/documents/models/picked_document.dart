import 'dart:typed_data';

class PickedDocument {
  final String name;
  final int size;
  final Future<Uint8List> Function() readBytes;

  const PickedDocument({
    required this.name,
    required this.size,
    required this.readBytes,
  });
}
