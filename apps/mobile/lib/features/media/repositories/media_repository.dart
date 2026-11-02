import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../features/auth/controllers/auth_controller.dart';
import '../models/media_item_model.dart';

final mediaRepositoryProvider = Provider<MediaRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return MediaRepository(apiClient.dio);
});

class MediaRepository {
  final Dio dio;

  const MediaRepository(this.dio);

  /// Ingests machine evidence (photo or video) into the backend pipeline.
  Future<MediaItemModel> ingestMedia({
    required String fileName,
    required List<int> bytes,
    required String title,
    String? description,
    String? equipmentId,
    List<String>? tags,
    ProgressCallback? onSendProgress,
    CancelToken? cancelToken,
  }) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(
        bytes,
        filename: fileName,
      ),
      'title': title.trim(),
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
      if (equipmentId != null && equipmentId.trim().isNotEmpty)
        'equipmentId': equipmentId.trim(),
      if (tags != null && tags.isNotEmpty)
        'tags': tags.join(','),
    });

    final response = await dio.post(
      '/media/ingest',
      data: formData,
      onSendProgress: onSendProgress,
      cancelToken: cancelToken,
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is Map<String, dynamic>) {
      return MediaItemModel.fromJson(data['data'] as Map<String, dynamic>);
    }
    throw Exception('Malformed response when uploading machine media evidence');
  }

  /// Lists machine evidence.
  Future<List<MediaItemModel>> fetchMediaList({String? equipmentId}) async {
    final response = await dio.get(
      '/media',
      queryParameters: {
        if (equipmentId != null && equipmentId.isNotEmpty) 'equipmentId': equipmentId,
      },
    );
    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is List) {
      return (data['data'] as List)
          .map((e) => MediaItemModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  }
}

