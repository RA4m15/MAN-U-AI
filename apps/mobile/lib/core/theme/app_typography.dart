import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// MAN-U-AI Light Industrial Typography
/// Clean humanist sans-serif headings with generous geometry,
/// high-legibility body, and crisp numeric readouts.
class AppTypography {
  AppTypography._();

  // Headings — Space Grotesk
  static TextStyle get displayLg => GoogleFonts.spaceGrotesk(
        fontSize: 40.0,
        fontWeight: FontWeight.w700,
        height: 1.15,
        letterSpacing: -0.8,
        color: AppColors.onSurface,
      );

  static TextStyle get headlineLg => GoogleFonts.spaceGrotesk(
        fontSize: 22.0,
        fontWeight: FontWeight.w700,
        height: 1.25,
        letterSpacing: -0.4,
        color: AppColors.onSurface,
      );

  /// Load-bearing section header anchor style
  static TextStyle get headlineMd => GoogleFonts.spaceGrotesk(
        fontSize: 17.0,
        fontWeight: FontWeight.w700,
        height: 1.3,
        letterSpacing: 0.2,
        color: AppColors.onSurface,
      );

  // Body & Telemetry — JetBrains Mono & Sans
  static TextStyle get bodyMd => GoogleFonts.jetBrainsMono(
        fontSize: 14.0,
        fontWeight: FontWeight.w600,
        height: 1.45,
        letterSpacing: 0.0,
        color: AppColors.onSurface,
      );

  static TextStyle get bodyMdRegular => GoogleFonts.jetBrainsMono(
        fontSize: 14.0,
        fontWeight: FontWeight.w400,
        height: 1.45,
        letterSpacing: 0.0,
        color: AppColors.onSurfaceVariant,
      );

  static TextStyle get bodySm => GoogleFonts.jetBrainsMono(
        fontSize: 12.0,
        fontWeight: FontWeight.w400,
        height: 1.4,
        letterSpacing: 0.0,
        color: AppColors.onSurfaceVariant,
      );

  static TextStyle get labelMd => GoogleFonts.jetBrainsMono(
        fontSize: 12.0,
        fontWeight: FontWeight.w700,
        height: 1.2,
        letterSpacing: 1.2,
        color: AppColors.onSurface,
      );

  /// Workhorse of secondary information: status pills, row metadata, titles
  static TextStyle get labelUppercase => GoogleFonts.jetBrainsMono(
        fontSize: 11.5,
        fontWeight: FontWeight.w600,
        height: 1.2,
        letterSpacing: 1.5,
        color: AppColors.onSurfaceVariant,
      );

  static TextStyle get caption => GoogleFonts.jetBrainsMono(
        fontSize: 10.5,
        fontWeight: FontWeight.w500,
        height: 1.3,
        letterSpacing: 1.0,
        color: AppColors.onSurfaceVariant,
      );

  static TextStyle get numericMd => GoogleFonts.jetBrainsMono(
        fontSize: 16.0,
        fontWeight: FontWeight.w700,
        height: 1.25,
        letterSpacing: 0.0,
        color: AppColors.onSurface,
      );
}
