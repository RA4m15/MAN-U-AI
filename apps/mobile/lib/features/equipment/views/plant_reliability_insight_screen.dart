import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/widgets/terminal_components.dart';

/// Plant Reliability Insight Screen.
/// Directly inspired by the left screen in the reference UI:
/// Telemetry review, observation cards with squircle icons,
/// weekly uptime bar chart, and minimal black pill action button.
class PlantReliabilityInsightScreen extends StatelessWidget {
  final void Function(String prompt)? onConsultCopilot;

  const PlantReliabilityInsightScreen({
    super.key,
    this.onConsultCopilot,
  });

  @override
  Widget build(BuildContext context) {
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
          'AI plant insight',
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
                padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Overview Top Card
                    Container(
                      padding: const EdgeInsets.all(16.0),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(20.0),
                        border: Border.all(color: AppColors.border, width: 1.0),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.03),
                            blurRadius: 8.0,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
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
                                Icons.offline_bolt_rounded,
                                color: Colors.white,
                                size: 22.0,
                              ),
                            ),
                          ),
                          const SizedBox(width: 14.0),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Your shift in review',
                                  style: AppTypography.bodyMd.copyWith(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14.5,
                                    color: AppColors.onSurface,
                                  ),
                                ),
                                const SizedBox(height: 2.0),
                                Text(
                                  'Maintaining 98.4% uptime across Area 4',
                                  style: AppTypography.caption.copyWith(
                                    fontSize: 11.0,
                                    color: AppColors.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12.0),

                    // Observation Card 1: Steam loop pressure
                    _buildObservationCard(
                      icon: Icons.nightlight_round,
                      title: 'Steam loop pressure is getting more consistent.',
                      subtitle:
                          'Variation varied by only 1.2 bar over past 24 hours - 36% steadier than last week.',
                    ),
                    const SizedBox(height: 12.0),

                    // Observation Card 2: Bearing vibration
                    _buildObservationCard(
                      icon: Icons.speed_rounded,
                      title: 'Bearing vibration dipped.',
                      subtitle:
                          'A 10-minute lubrication cycle after shift change could help maintain peak load throughput.',
                    ),
                    const SizedBox(height: 12.0),

                    // Observation Card 3: Pump temperature
                    _buildObservationCard(
                      icon: Icons.favorite_border_rounded,
                      title: 'Feedwater motor temperature nominal.',
                      subtitle:
                          '7-day average 62°C (thermal warning limit 85°C). Equipment running within optimal tolerance.',
                    ),
                    const SizedBox(height: 16.0),

                    // Weekly Availability & Uptime Bar Chart Card
                    Container(
                      padding: const EdgeInsets.all(20.0),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(22.0),
                        border: Border.all(color: AppColors.border, width: 1.0),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.03),
                            blurRadius: 8.0,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.query_stats_rounded,
                                      size: 20.0,
                                      color: AppColors.onSurface,
                                    ),
                                    const SizedBox(width: 8.0),
                                    Flexible(
                                      child: Text(
                                        'Plant availability',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: AppTypography.bodyMd.copyWith(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 14.5,
                                          color: AppColors.onSurface,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8.0),
                              Text(
                                '+8%',
                                style: AppTypography.headlineLg.copyWith(
                                  fontSize: 22.0,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.onSurface,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20.0),
                          const ModernWeeklyBarChart(
                            values: [0.82, 0.65, 0.94, 0.88, 0.96, 0.80, 0.98],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12.0),
                  ],
                ),
              ),
            ),

            // Bottom CTA
            Padding(
              padding: const EdgeInsets.fromLTRB(20.0, 10.0, 20.0, 20.0),
              child: MachinedPrimaryButton(
                label: 'Discuss with Copilot',
                height: 54.0,
                onPressed: () {
                  final prompt =
                      'Review Area 4 telemetry insights: steam loop pressure is steady, bearing vibration normalized, and overall availability is up +8%. Recommend preventative maintenance priorities for the next shift.';
                  if (onConsultCopilot != null) {
                    onConsultCopilot!(prompt);
                    Navigator.of(context).pop();
                  } else {
                    Navigator.of(context).pop(prompt);
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildObservationCard({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(20.0),
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6.0,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40.0,
            height: 40.0,
            decoration: BoxDecoration(
              color: AppColors.surfaceMuted,
              borderRadius: BorderRadius.circular(12.0),
            ),
            child: Icon(
              icon,
              size: 20.0,
              color: AppColors.onSurface,
            ),
          ),
          const SizedBox(width: 14.0),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.bodyMd.copyWith(
                    fontWeight: FontWeight.w700,
                    fontSize: 13.5,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 4.0),
                Text(
                  subtitle,
                  style: AppTypography.bodyMdRegular.copyWith(
                    fontSize: 12.0,
                    color: AppColors.onSurfaceVariant,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
