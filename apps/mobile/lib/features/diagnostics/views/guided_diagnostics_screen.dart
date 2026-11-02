import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/widgets/terminal_components.dart';

/// Guided Diagnostics Screen.
/// Directly inspired by the right screen in the reference UI:
/// Step indicator with icon, horizontal progress bar, question headline,
/// selectable option cards (A, B, C, D), and minimal black pill action button.
class GuidedDiagnosticsScreen extends StatefulWidget {
  final String equipmentName;
  final void Function(String prompt)? onCompleteDiagnosis;

  const GuidedDiagnosticsScreen({
    super.key,
    this.equipmentName = 'Boiler B-201',
    this.onCompleteDiagnosis,
  });

  @override
  State<GuidedDiagnosticsScreen> createState() => _GuidedDiagnosticsScreenState();
}

class _GuidedDiagnosticsScreenState extends State<GuidedDiagnosticsScreen> {
  final int _currentStep = 3;
  final int _totalSteps = 5;
  int? _selectedOptionIndex = 0; // Default selected Option A like reference

  final List<Map<String, String>> _options = const [
    {
      'id': 'A',
      'label': 'Severe - difficult to operate / exceeding 7.1 mm/s RMS',
    },
    {
      'id': 'B',
      'label': 'Mild - noticeable high-pitch whine but manageable',
    },
    {
      'id': 'C',
      'label': 'Moderate - affects feed rate and requires monitoring',
    },
    {
      'id': 'D',
      'label': 'Very severe - tripping safety interlocks / immediate shutdown',
    },
  ];

  void _handleProceed() {
    final selectedOption = _selectedOptionIndex != null
        ? _options[_selectedOptionIndex!]
        : _options.first;

    final prompt =
        'Evaluate guided diagnostic for ${widget.equipmentName}: Step $_currentStep/$_totalSteps - '
        'Selected: ${selectedOption['id']} (${selectedOption['label']}). '
        'Provide root-cause analysis, isolation SOP, and safety preconditions.';

    if (widget.onCompleteDiagnosis != null) {
      widget.onCompleteDiagnosis!(prompt);
      Navigator.of(context).pop();
    } else {
      Navigator.of(context).pop(prompt);
    }
  }

  @override
  Widget build(BuildContext context) {
    final progress = (_currentStep / _totalSteps).clamp(0.0, 1.0);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: Center(
          child: ButtonIconTile(
            icon: Icons.arrow_back_ios_new_rounded,
            size: 38.0,
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        title: Text(
          'A few questions',
          style: AppTypography.headlineMd.copyWith(
            fontSize: 16.5,
            fontWeight: FontWeight.w700,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Step Indicator Row with Squircle Icon Tile
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44.0,
                          height: 44.0,
                          decoration: BoxDecoration(
                            color: AppColors.primaryAction,
                            borderRadius: BorderRadius.circular(12.0),
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.add_rounded,
                              color: Colors.white,
                              size: 24.0,
                            ),
                          ),
                        ),
                        const SizedBox(width: 14.0),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Question $_currentStep of $_totalSteps',
                                style: AppTypography.caption.copyWith(
                                  color: AppColors.onSurfaceVariant,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 11.0,
                                ),
                              ),
                              const SizedBox(height: 2.0),
                              Text(
                                'This helps isolate failure urgency',
                                style: AppTypography.bodyMd.copyWith(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.onSurface,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20.0),

                    // Rounded Linear Progress Bar
                    Container(
                      height: 8.0,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(4.0),
                      ),
                      alignment: Alignment.centerLeft,
                      child: FractionallySizedBox(
                        widthFactor: progress,
                        child: Container(
                          decoration: BoxDecoration(
                            color: AppColors.onSurface,
                            borderRadius: BorderRadius.circular(4.0),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 28.0),

                    // Diagnostic Question Headline
                    Text(
                      'How severe is the ${widget.equipmentName} anomaly right now?',
                      style: AppTypography.headlineLg.copyWith(
                        fontSize: 19.0,
                        fontWeight: FontWeight.w700,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 6.0),
                    Text(
                      'Choose the option that feels closest to field telemetry.',
                      style: AppTypography.bodyMdRegular.copyWith(
                        fontSize: 13.0,
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 24.0),

                    // Selectable Options (A, B, C, D)
                    ...List.generate(_options.length, (index) {
                      final opt = _options[index];
                      final isSelected = _selectedOptionIndex == index;

                      return QuestionOptionCard(
                        identifier: opt['id']!,
                        label: opt['label']!,
                        isSelected: isSelected,
                        onTap: () {
                          setState(() {
                            _selectedOptionIndex = index;
                          });
                        },
                      );
                    }),
                  ],
                ),
              ),
            ),

            // Bottom CTA: Minimal Black Pill Button
            Padding(
              padding: const EdgeInsets.fromLTRB(24.0, 12.0, 24.0, 20.0),
              child: MachinedPrimaryButton(
                label: 'View guidance',
                height: 54.0,
                onPressed: _handleProceed,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
