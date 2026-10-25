import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../controllers/document_upload_controller.dart';
import 'full_screen_figure_viewer.dart';

class AuthenticatedFigureViewer extends ConsumerStatefulWidget {
  final String documentId;
  final String figureId;
  final String documentTitle;
  final int page;
  final String? caption;

  const AuthenticatedFigureViewer({
    super.key,
    required this.documentId,
    required this.figureId,
    required this.documentTitle,
    required this.page,
    this.caption,
  });

  @override
  ConsumerState<AuthenticatedFigureViewer> createState() =>
      _AuthenticatedFigureViewerState();
}

class _AuthenticatedFigureViewerState extends ConsumerState<AuthenticatedFigureViewer> {
  Future<Uint8List>? _imageFuture;

  @override
  void initState() {
    super.initState();
    _loadImage();
  }

  void _loadImage() {
    setState(() {
      _imageFuture = ref.read(documentRepositoryProvider).getFigureImageBytes(
            documentId: widget.documentId,
            figureId: widget.figureId,
          );
    });
  }

  void _openFullScreen(Uint8List bytes) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => FullScreenFigureViewer(
          imageBytes: bytes,
          title: widget.documentTitle,
          page: widget.page,
          caption: widget.caption,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8.0),
      decoration: BoxDecoration(
        color: AppColors.canvas,
        borderRadius: BorderRadius.circular(8.0),
        border: Border.all(color: AppColors.hairlineStrong),
      ),
      child: FutureBuilder<Uint8List>(
        future: _imageFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Container(
              height: 140.0,
              alignment: Alignment.center,
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 20.0,
                    height: 20.0,
                    child: CircularProgressIndicator(strokeWidth: 2.0),
                  ),
                  SizedBox(height: 8.0),
                  Text(
                    'Loading technical figure...',
                    style: TextStyle(color: AppColors.inkSubtle, fontSize: 11.0),
                  ),
                ],
              ),
            );
          }

          if (snapshot.hasError) {
            final error = snapshot.error;
            String message = 'Figure unavailable';
            if (error is DioException) {
              if (error.response?.statusCode == 403) {
                message = 'Access restricted: Figure viewing unauthorized';
              } else if (error.response?.statusCode == 404) {
                message = 'Technical diagram not found or processing incomplete';
              } else if (error.type == DioExceptionType.connectionTimeout ||
                  error.type == DioExceptionType.receiveTimeout) {
                message = 'Network timeout loading diagram';
              }
            }

            return Container(
              padding: const EdgeInsets.all(12.0),
              child: Row(
                children: [
                  const Icon(Icons.broken_image_outlined,
                      color: AppColors.danger, size: 20.0),
                  const SizedBox(width: 8.0),
                  Expanded(
                    child: Text(
                      message,
                      style: const TextStyle(
                        color: AppColors.inkMuted,
                        fontSize: 11.5,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, size: 16.0, color: AppColors.primaryHover),
                    tooltip: 'Retry loading figure',
                    onPressed: _loadImage,
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            );
          }

          final bytes = snapshot.data!;
          return InkWell(
            key: Key('figure_preview_${widget.figureId}'),
            borderRadius: BorderRadius.circular(8.0),
            onTap: () => _openFullScreen(bytes),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Stack(
                    children: [
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 220.0),
                        child: Image.memory(
                          bytes,
                          width: double.infinity,
                          fit: BoxFit.cover,
                        ),
                      ),
                      Positioned(
                        right: 8.0,
                        bottom: 8.0,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                          decoration: BoxDecoration(
                            color: AppColors.surface1.withValues(alpha: 0.85),
                            borderRadius: BorderRadius.circular(6.0),
                            border: Border.all(color: AppColors.hairlineStrong),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.zoom_in_rounded, size: 13.0, color: AppColors.ink),
                              SizedBox(width: 4.0),
                              Text(
                                'Tap to inspect',
                                style: TextStyle(
                                  color: AppColors.ink,
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (widget.caption != null && widget.caption!.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Text(
                        widget.caption!,
                        style: const TextStyle(
                          fontSize: 11.0,
                          color: AppColors.inkSubtle,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
