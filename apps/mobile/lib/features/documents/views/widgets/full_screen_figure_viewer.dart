import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class FullScreenFigureViewer extends StatefulWidget {
  final Uint8List imageBytes;
  final String title;
  final String? caption;
  final int page;

  const FullScreenFigureViewer({
    super.key,
    required this.imageBytes,
    required this.title,
    this.caption,
    required this.page,
  });

  @override
  State<FullScreenFigureViewer> createState() => _FullScreenFigureViewerState();
}

class _FullScreenFigureViewerState extends State<FullScreenFigureViewer> {
  final TransformationController _transformationController = TransformationController();

  @override
  void dispose() {
    _transformationController.dispose();
    super.dispose();
  }

  void _resetZoom() {
    _transformationController.value = Matrix4.identity();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        backgroundColor: AppColors.surface1,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: AppColors.ink),
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Close full screen',
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.title,
              style: const TextStyle(fontSize: 14.0, fontWeight: FontWeight.w700, color: AppColors.ink),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              'Page ${widget.page} • Technical Diagram',
              style: const TextStyle(fontSize: 11.0, color: AppColors.primaryHover),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.restart_alt_rounded, color: AppColors.inkSubtle),
            onPressed: _resetZoom,
            tooltip: 'Reset zoom',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: InteractiveViewer(
                  transformationController: _transformationController,
                  minScale: 0.5,
                  maxScale: 6.0,
                  clipBehavior: Clip.none,
                  child: Image.memory(
                    widget.imageBytes,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),
            if (widget.caption != null && widget.caption!.isNotEmpty) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                decoration: const BoxDecoration(
                  color: AppColors.surface1,
                  border: Border(top: BorderSide(color: AppColors.hairline)),
                ),
                child: Text(
                  widget.caption!,
                  style: const TextStyle(
                    fontSize: 12.0,
                    height: 1.4,
                    color: AppColors.inkMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
