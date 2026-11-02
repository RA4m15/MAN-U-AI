import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/core/theme/app_theme.dart';
import 'package:manuai_mobile/features/documents/views/widgets/document_upload_modal.dart';
import 'package:manuai_mobile/features/media/views/media_capture_screen.dart';
import 'package:manuai_mobile/features/media/controllers/media_capture_controller.dart';
import 'package:manuai_mobile/features/equipment/controllers/equipment_controller.dart';
import 'package:manuai_mobile/features/equipment/models/equipment_model.dart';
import '../unit/media_capture_controller_test.dart';

class TestMediaCaptureController extends MediaCaptureController {
  TestMediaCaptureController() : super(MockMediaRepository()) {
    state = const MediaCaptureState(
      isInitializing: false,
      isCameraInitialized: false,
      cameraErrorMessage:
          'Optical sensor standby: test runner has no physical camera hardware.',
    );
  }

  @override
  Future<void> initCamera() async {
    // Keep deterministic in widget test
  }
}

void main() {
  Widget buildTestApp({EquipmentModel? equipment}) {
    return ProviderScope(
      overrides: [
        mediaCaptureControllerProvider.overrideWith(
          (ref) => TestMediaCaptureController(),
        ),
        equipmentListProvider.overrideWith(
          (ref) => Future.value([]),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.darkTheme,
        home: MediaCaptureScreen(initialEquipment: equipment),
      ),
    );
  }

  group('MediaCaptureScreen Widget Tests', () {
    testWidgets('renders optical inspection console header and controls',
        (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump();

      expect(find.text('INSPECTION OPTICS // 4K'), findsOneWidget);
      expect(find.byKey(const Key('media_capture_close_button')), findsOneWidget);
      expect(find.byKey(const Key('open_pdf_ingest_button')), findsOneWidget);
      expect(find.text('PHOTO'), findsOneWidget);
      expect(find.text('VIDEO'), findsOneWidget);
    });

    testWidgets(
        'renders optical sensor standby and fallback buttons in test environment',
        (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump();

      expect(find.text('OPTICAL SENSOR STANDBY'), findsOneWidget);
      expect(find.byKey(const Key('gallery_fallback_button')), findsOneWidget);
      expect(find.byKey(const Key('pdf_fallback_button')), findsOneWidget);
    });

    testWidgets(
        'switching between PHOTO and VIDEO modes updates active tab styling',
        (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump();

      // Initially in PHOTO mode
      expect(find.byKey(const Key('photo_shutter_button')), findsOneWidget);

      // Tap VIDEO tab
      await tester.tap(find.text('VIDEO'));
      await tester.pump();

      expect(find.byKey(const Key('video_shutter_button')), findsOneWidget);

      // Tap PHOTO tab
      await tester.tap(find.text('PHOTO'));
      await tester.pump();

      expect(find.byKey(const Key('photo_shutter_button')), findsOneWidget);
    });

    testWidgets('tapping INGEST PDF fallback button opens DocumentUploadModal',
        (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump();

      await tester.tap(find.byKey(const Key('pdf_fallback_button')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(DocumentUploadModal), findsOneWidget);
    });

    testWidgets('tapping PDF header icon opens DocumentUploadModal',
        (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump();

      await tester.tap(find.byKey(const Key('open_pdf_ingest_button')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(DocumentUploadModal), findsOneWidget);
    });
  });
}
