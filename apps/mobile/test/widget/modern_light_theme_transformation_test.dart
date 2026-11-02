import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/core/theme/app_colors.dart';
import 'package:manuai_mobile/core/theme/app_theme.dart';
import 'package:manuai_mobile/core/theme/widgets/terminal_components.dart';
import 'package:manuai_mobile/features/diagnostics/views/guided_diagnostics_screen.dart';
import 'package:manuai_mobile/features/equipment/views/plant_reliability_insight_screen.dart';

void main() {
  group('Modern Light Theme Transformation & Components', () {
    testWidgets('AiOrbWidget renders concentric layers and core without overflow', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            backgroundColor: AppColors.background,
            body: Center(
              child: AiOrbWidget(size: 140.0),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(AiOrbWidget), findsOneWidget);
    });

    testWidgets('QuestionOptionCard renders unselected and selected states', (tester) async {
      bool isSelected = false;

      await tester.pumpWidget(
        StatefulBuilder(
          builder: (context, setState) {
            return MaterialApp(
              home: Scaffold(
                body: Center(
                  child: QuestionOptionCard(
                    identifier: 'A',
                    label: 'Severe - difficult to operate / exceeding 7.1 mm/s RMS',
                    isSelected: isSelected,
                    onTap: () {
                      setState(() {
                        isSelected = !isSelected;
                      });
                    },
                  ),
                ),
              ),
            );
          },
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('A'), findsOneWidget);
      expect(find.text('Severe - difficult to operate / exceeding 7.1 mm/s RMS'), findsOneWidget);
      expect(find.byIcon(Icons.check_rounded), findsNothing);

      // Tap card to select
      await tester.tap(find.byType(QuestionOptionCard));
      await tester.pumpAndSettle();

      expect(isSelected, isTrue);
      expect(find.byIcon(Icons.check_rounded), findsOneWidget);
    });

    testWidgets('ModernWeeklyBarChart renders 7 weekday labels and bars', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(
              child: ModernWeeklyBarChart(
                values: [0.8, 0.6, 0.9, 0.85, 0.95, 0.75, 1.0],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      for (final day in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
        expect(find.text(day), findsOneWidget);
      }
    });

    testWidgets('GuidedDiagnosticsScreen renders complete flow and triggers completion', (tester) async {
      String? completedPrompt;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: GuidedDiagnosticsScreen(
            equipmentName: 'Boiler B-201',
            onCompleteDiagnosis: (prompt) {
              completedPrompt = prompt;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('A few questions'), findsOneWidget);
      expect(find.text('Question 3 of 5'), findsOneWidget);
      expect(find.text('This helps isolate failure urgency'), findsOneWidget);
      expect(find.text('How severe is the Boiler B-201 anomaly right now?'), findsOneWidget);

      // Check all 4 options
      expect(find.text('A'), findsOneWidget);
      expect(find.text('B'), findsOneWidget);
      expect(find.text('C'), findsOneWidget);
      expect(find.text('D'), findsOneWidget);
      expect(find.text('View guidance'), findsOneWidget);

      // Select option B
      await tester.tap(find.text('B'));
      await tester.pumpAndSettle();

      // Tap View Guidance button
      await tester.tap(find.text('View guidance'));
      await tester.pumpAndSettle();

      expect(completedPrompt, contains('Step 3/5'));
      expect(completedPrompt, contains('Selected: B'));
      expect(completedPrompt, contains('Boiler B-201'));
    });

    testWidgets('PlantReliabilityInsightScreen renders telemetry review, chart, and triggers Copilot', (tester) async {
      String? copilotPrompt;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: PlantReliabilityInsightScreen(
            onConsultCopilot: (prompt) {
              copilotPrompt = prompt;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('AI plant insight'), findsOneWidget);
      expect(find.text('Your shift in review'), findsOneWidget);
      expect(find.text('Maintaining 98.4% uptime across Area 4'), findsOneWidget);
      expect(find.text('Steam loop pressure is getting more consistent.'), findsOneWidget);
      expect(find.text('Bearing vibration dipped.'), findsOneWidget);
      expect(find.text('Feedwater motor temperature nominal.'), findsOneWidget);
      expect(find.text('Plant availability'), findsOneWidget);
      expect(find.text('+8%'), findsOneWidget);
      expect(find.text('Discuss with Copilot'), findsOneWidget);

      // Tap Discuss with Copilot button
      await tester.tap(find.text('Discuss with Copilot'));
      await tester.pumpAndSettle();

      expect(copilotPrompt, contains('Review Area 4 telemetry insights'));
    });

    testWidgets('GuidedDiagnosticsScreen has zero pixel overflow on narrow 360x640 screen', (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const GuidedDiagnosticsScreen(
            equipmentName: 'Slurry Pump P-102',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });

    testWidgets('PlantReliabilityInsightScreen has zero pixel overflow on narrow 360x640 screen', (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const PlantReliabilityInsightScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });

    testWidgets('PlantReliabilityInsightScreen has zero pixel overflow on ultra-narrow 320x568 screen', (tester) async {
      tester.view.physicalSize = const Size(320, 568);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const PlantReliabilityInsightScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });

    testWidgets('GuidedDiagnosticsScreen has zero pixel overflow on ultra-narrow 320x568 screen', (tester) async {
      tester.view.physicalSize = const Size(320, 568);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const GuidedDiagnosticsScreen(
            equipmentName: 'Slurry Pump P-102',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });
}
