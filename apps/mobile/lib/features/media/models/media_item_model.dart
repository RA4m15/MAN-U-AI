import 'package:flutter/foundation.dart';

@immutable
class MediaItemModel {
  final String id;
  final String title;
  final String? description;
  final String mediaType; // 'image' or 'video'
  final String originalFilename;
  final String mimeType;
  final int sizeBytes;
  final double? durationSeconds;
  final String? equipmentId;
  final String uploadedById;
  final String status; // 'uploading', 'uploaded', 'processing', 'indexed', 'failed'
  final String? processingError;
  final String? technicalFindings;
  final String? extractedText;
  final List<String> tags;
  final DateTime? createdAt;

  const MediaItemModel({
    required this.id,
    required this.title,
    this.description,
    required this.mediaType,
    required this.originalFilename,
    required this.mimeType,
    required this.sizeBytes,
    this.durationSeconds,
    this.equipmentId,
    required this.uploadedById,
    required this.status,
    this.processingError,
    this.technicalFindings,
    this.extractedText,
    this.tags = const [],
    this.createdAt,
  });

  factory MediaItemModel.fromJson(Map<String, dynamic> json) {
    return MediaItemModel(
      id: json['id'] as String? ?? json['_id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      mediaType: json['mediaType'] as String? ?? 'image',
      originalFilename: json['originalFilename'] as String? ?? '',
      mimeType: json['mimeType'] as String? ?? 'image/jpeg',
      sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
      durationSeconds: (json['durationSeconds'] as num?)?.toDouble(),
      equipmentId: json['equipmentId'] as String?,
      uploadedById: json['uploadedById'] as String? ?? '',
      status: json['status'] as String? ?? 'processing',
      processingError: json['processingError'] as String?,
      technicalFindings: json['technicalFindings'] as String?,
      extractedText: json['extractedText'] as String?,
      tags: (json['tags'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      if (description != null) 'description': description,
      'mediaType': mediaType,
      'originalFilename': originalFilename,
      'mimeType': mimeType,
      'sizeBytes': sizeBytes,
      if (durationSeconds != null) 'durationSeconds': durationSeconds,
      if (equipmentId != null) 'equipmentId': equipmentId,
      'uploadedById': uploadedById,
      'status': status,
      if (processingError != null) 'processingError': processingError,
      if (technicalFindings != null) 'technicalFindings': technicalFindings,
      if (extractedText != null) 'extractedText': extractedText,
      'tags': tags,
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
    };
  }
}

