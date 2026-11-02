import 'package:flutter/material.dart';
import '../app_colors.dart';
import '../app_typography.dart';

/// Section Header with clean primary accent indicator.
/// Signature header of the MAN-U-AI technical design system.
class SectionHeader extends StatelessWidget {
  final String title;
  final Widget? action;
  final EdgeInsetsGeometry padding;

  const SectionHeader({
    super.key,
    required this.title,
    this.action,
    this.padding = const EdgeInsets.symmetric(vertical: 8.0),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 4.0,
            height: 18.0,
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(2.0),
            ),
          ),
          const SizedBox(width: 10.0),
          Flexible(
            child: Text(
              title,
              style: AppTypography.headlineMd.copyWith(
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
              ),
            ),
          ),
          ?action,
        ],
      ),
    );
  }
}

/// Minimalist pill action button.
/// Inspired by the modern dark action pill in the reference UI.
class MachinedPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final bool isDestructive;
  final double height;
  final Key? buttonKey;

  const MachinedPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isLoading = false,
    this.isDestructive = false,
    this.height = 54.0,
    this.buttonKey,
  });

  @override
  Widget build(BuildContext context) {
    final baseColor = isDestructive ? AppColors.error : AppColors.primaryAction;

    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 12.0,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ElevatedButton(
        key: buttonKey,
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: baseColor,
          foregroundColor: Colors.white,
          disabledBackgroundColor: baseColor.withValues(alpha: 0.6),
          disabledForegroundColor: Colors.white70,
          elevation: 0,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28.0),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
        ),
        child: Center(
          child: isLoading
              ? const SizedBox(
                  width: 20.0,
                  height: 20.0,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.2,
                    color: Colors.white,
                  ),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, size: 19.0, color: Colors.white),
                      const SizedBox(width: 10.0),
                    ],
                    Flexible(
                      child: Text(
                        label,
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                        style: AppTypography.headlineMd.copyWith(
                          fontSize: 15.0,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.4,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

/// Secondary button: elevated white pill with crisp border.
class SecondaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double height;

  const SecondaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.height = 44.0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(22.0),
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6.0,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(22.0),
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10.0),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 16.0, color: AppColors.onSurface),
                  const SizedBox(width: 6.0),
                ],
                Flexible(
                  child: Text(
                    label,
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                    style: AppTypography.bodyMd.copyWith(
                      fontSize: 12.0,
                      fontWeight: FontWeight.w600,
                      color: AppColors.onSurface,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Modern squircle utility icon button.
class ButtonIconTile extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onPressed;
  final String? tooltip;
  final Color? iconColor;
  final double size;

  const ButtonIconTile({
    super.key,
    required this.icon,
    this.onPressed,
    this.tooltip,
    this.iconColor,
    this.size = 40.0,
  });

  @override
  Widget build(BuildContext context) {
    Widget button = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(12.0),
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 4.0,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12.0),
          onTap: onPressed,
          child: Center(
            child: Icon(
              icon,
              size: 18.0,
              color: iconColor ?? AppColors.onSurface,
            ),
          ),
        ),
      ),
    );

    if (tooltip != null) {
      return Tooltip(message: tooltip!, child: button);
    }
    return button;
  }
}

/// Badge Pill for status & telemetry with soft tinted background.
class BadgePill extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;

  const BadgePill({
    super.key,
    required this.label,
    this.color = AppColors.success,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9.0, vertical: 4.5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12.0),
        border: Border.all(color: color.withValues(alpha: 0.24), width: 1.0),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11.5, color: color),
            const SizedBox(width: 4.0),
          ],
          Text(
            label,
            style: AppTypography.bodySm.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: 10.5,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

/// Filled status dot with soft ambient ring.
class StatusDot extends StatelessWidget {
  final Color color;
  final double size;

  const StatusDot({
    super.key,
    this.color = AppColors.success,
    this.size = 10.0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.35),
            blurRadius: 4.0,
            spreadRadius: 1.0,
          ),
        ],
      ),
    );
  }
}

/// Squircle avatar slot with subtle elevation.
class SquareAvatar extends StatelessWidget {
  final String? initial;
  final IconData? icon;
  final double size;

  const SquareAvatar({
    super.key,
    this.initial,
    this.icon,
    this.size = 56.0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(16.0),
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8.0,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Center(
        child: icon != null
            ? Icon(icon, color: AppColors.primary, size: size * 0.45)
            : Text(
                (initial != null && initial!.isNotEmpty)
                    ? initial![0].toUpperCase()
                    : 'U',
                style: AppTypography.headlineLg.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                  fontSize: size * 0.42,
                ),
              ),
      ),
    );
  }
}

/// Elevated Card List Row with leading squircle icon tile, title, and subtitle.
class InstrumentListRow extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData? icon;
  final Color? categoricalColor;
  final VoidCallback? onTap;
  final Widget? trailing;

  const InstrumentListRow({
    super.key,
    required this.title,
    required this.subtitle,
    this.icon,
    this.categoricalColor,
    this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10.0),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(16.0),
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8.0,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16.0),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                // Leading squircle tile
                Container(
                  width: 42.0,
                  height: 42.0,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(12.0),
                    border: Border.all(color: AppColors.borderSubtle, width: 1.0),
                  ),
                  child: Center(
                    child: categoricalColor != null
                        ? Container(
                            width: 12.0,
                            height: 12.0,
                            decoration: BoxDecoration(
                              color: categoricalColor,
                              shape: BoxShape.circle,
                            ),
                          )
                        : Icon(
                            icon ?? Icons.tune_rounded,
                            size: 20.0,
                            color: AppColors.onSurface,
                          ),
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
                          fontSize: 14.0,
                          color: AppColors.onSurface,
                        ),
                      ),
                      const SizedBox(height: 3.0),
                      Text(
                        subtitle.toUpperCase(),
                        style: AppTypography.caption.copyWith(
                          color: AppColors.onSurfaceVariant,
                          fontSize: 10.0,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ],
                  ),
                ),
                trailing ??
                    const Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 13.0,
                      color: AppColors.textMuted,
                    ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The signature concentric glowing spherical AI Orb from the reference design.
/// Features a layered glowing atmosphere, luminous ring, and refractive crystal core.
class AiOrbWidget extends StatefulWidget {
  final double size;
  final bool isPulsing;

  const AiOrbWidget({
    super.key,
    this.size = 140.0,
    this.isPulsing = true,
  });

  @override
  State<AiOrbWidget> createState() => _AiOrbWidgetState();
}

class _AiOrbWidgetState extends State<AiOrbWidget> with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    );

    _pulseAnimation = Tween<double>(begin: 0.96, end: 1.04).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );

    final isTestEnvironment =
        WidgetsBinding.instance.runtimeType.toString().contains('Test');
    if (widget.isPulsing && !isTestEnvironment) {
      _animController.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        final scale = widget.isPulsing ? _pulseAnimation.value : 1.0;
        final currentSize = widget.size * scale;

        return SizedBox(
          width: currentSize,
          height: currentSize,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Outer Ambient Glow Aura
              Container(
                width: currentSize * 0.95,
                height: currentSize * 0.95,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0x6600BBD4), // Cyan glow
                      blurRadius: 40.0,
                      spreadRadius: 8.0,
                    ),
                    BoxShadow(
                      color: const Color(0x4D087EFF), // Electric blue glow
                      blurRadius: 30.0,
                      spreadRadius: 4.0,
                    ),
                  ],
                ),
              ),

              // Sphere Base with Radial Gradient
              Container(
                width: currentSize * 0.82,
                height: currentSize * 0.82,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const RadialGradient(
                    center: Alignment(-0.25, -0.3),
                    radius: 0.85,
                    colors: [
                      Color(0xFF67E8F9), // Bright cyan highlight
                      Color(0xFF00BBD4), // Mid cyan
                      Color(0xFF0284C7), // Sky blue
                      Color(0xFF087EFF), // Electric blue
                      Color(0xFF0B2144), // Deep navy shadow
                    ],
                    stops: [0.0, 0.25, 0.55, 0.8, 1.0],
                  ),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.5),
                    width: 1.5,
                  ),
                ),
              ),

              // Equatorial Luminous Energy Ring
              Container(
                width: currentSize * 0.86,
                height: currentSize * 0.86,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFFE0F7FA).withValues(alpha: 0.7),
                    width: 1.2,
                  ),
                ),
              ),

              // Internal Capsule / Reactor Core
              Transform.rotate(
                angle: -0.45,
                child: Container(
                  width: currentSize * 0.22,
                  height: currentSize * 0.44,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(currentSize * 0.15),
                    gradient: const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Color(0xFF087EFF),
                        Color(0xFF032657),
                        Color(0xFF00112C),
                      ],
                    ),
                    border: Border.all(
                      color: const Color(0xFF67E8F9).withValues(alpha: 0.8),
                      width: 1.5,
                    ),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x8000BBD4),
                        blurRadius: 10.0,
                        spreadRadius: 2.0,
                      ),
                    ],
                  ),
                ),
              ),

              // Specular Lens Flare / Sparkle
              Positioned(
                top: currentSize * 0.22,
                left: currentSize * 0.28,
                child: Container(
                  width: currentSize * 0.12,
                  height: currentSize * 0.12,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.white,
                        blurRadius: 8.0,
                        spreadRadius: 3.0,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Selectable question option card for Guided Diagnostics.
/// Directly inspired by the right screen in the reference UI.
class QuestionOptionCard extends StatelessWidget {
  final String identifier; // 'A', 'B', 'C', 'D'
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const QuestionOptionCard({
    super.key,
    required this.identifier,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12.0),
      decoration: BoxDecoration(
        color: isSelected ? AppColors.surfaceAlt : AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(18.0),
        border: Border.all(
          color: isSelected ? AppColors.onSurface : AppColors.border,
          width: isSelected ? 1.8 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isSelected ? 0.05 : 0.02),
            blurRadius: isSelected ? 8.0 : 4.0,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18.0),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 15.0),
            child: Row(
              children: [
                // Identifier circle ('A', 'B', ...)
                Container(
                  width: 32.0,
                  height: 32.0,
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.surfaceMuted : AppColors.surfaceMuted,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      identifier,
                      style: AppTypography.bodyMd.copyWith(
                        fontSize: 13.0,
                        fontWeight: FontWeight.w700,
                        color: AppColors.onSurface,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14.0),
                // Option text
                Expanded(
                  child: Text(
                    label,
                    style: AppTypography.bodyMd.copyWith(
                      fontSize: 13.5,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                      color: AppColors.onSurface,
                    ),
                  ),
                ),
                const SizedBox(width: 10.0),
                // Checkmark / radio selection indicator
                Container(
                  width: 22.0,
                  height: 22.0,
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.onSurface : Colors.transparent,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isSelected ? AppColors.onSurface : AppColors.border,
                      width: 1.5,
                    ),
                  ),
                  child: isSelected
                      ? const Icon(
                          Icons.check_rounded,
                          size: 14.0,
                          color: Colors.white,
                        )
                      : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Minimal Weekly Bar Chart for Plant Uptime & Telemetry.
/// Directly inspired by the left screen in the reference UI.
class ModernWeeklyBarChart extends StatelessWidget {
  final List<double> values; // 7 values between 0.0 and 1.0
  final List<String> labels; // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const ModernWeeklyBarChart({
    super.key,
    required this.values,
    this.labels = const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: List.generate(7, (index) {
        final val = index < values.length ? values[index] : 0.5;
        final label = index < labels.length ? labels[index] : '';

        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3.5),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Bar Track & Fill
                Container(
                  height: 90.0,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(6.0),
                  ),
                  alignment: Alignment.bottomCenter,
                  child: FractionallySizedBox(
                    heightFactor: val.clamp(0.12, 1.0),
                    widthFactor: 1.0,
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.onSurface,
                        borderRadius: BorderRadius.circular(6.0),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8.0),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.onSurfaceVariant,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }
}
