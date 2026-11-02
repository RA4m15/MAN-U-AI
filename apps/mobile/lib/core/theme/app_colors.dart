import 'package:flutter/material.dart';

/// MAN-U-AI Industrial Design System Color Tokens.
/// Featuring Light Industrial and Dark Industrial color systems:
/// - Light: Crisp icy-blue canvas, elevated white surfaces, charcoal typography, electric blue accents.
/// - Dark: Deep slate/navy canvas, elevated dark slate cards, high-contrast off-white typography.
class AppColors {
  AppColors._();

  // Background & Surfaces (Light)
  static const Color background = Color(0xFFE8F0F2); // Light icy-blue page canvas
  static const Color backgroundSecondary = Color(0xFFDCE8EB); // Subtle depth layer
  static const Color surface = Color(0xFFE8F0F2); // Scaffold canvas
  static const Color surfaceCard = Color(0xFFF4F8F9); // Main secondary card fill
  static const Color surfaceAlt = Color(0xFFFFFFFF); // Elevated cards, rows, modals
  static const Color surfaceElevated = Color(0xFFFFFFFF); // Floating dialogs & sheets
  static const Color surfaceMuted = Color(0xFFEDF3F5); // Recessed wells, inputs, chips

  // Typography & Foreground Content (Light)
  static const Color onSurface = Color(0xFF101820); // Deep charcoal / near black primary
  static const Color onSurfaceVariant = Color(0xFF52636A); // Slate secondary text & metadata
  static const Color textMuted = Color(0xFF819197); // Tertiary caption & placeholder text

  // Primary Actions (Light)
  static const Color primaryAction = Color(0xFF111820); // Minimal black pill action button
  static const Color onPrimaryAction = Color(0xFFFFFFFF); // White text on dark button

  // AI & Brand Accents
  static const Color primary = Color(0xFF087EFF); // Saturated AI electric blue
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color primaryHover = Color(0xFF2670FF);
  static const Color primaryFocus = Color(0xFF087EFF);
  static const Color primaryMuted = Color(0xFF003BB3);
  static const Color primarySubtle = Color(0xFFE5F1FF); // Soft blue tint for light surfaces

  // Cyan Accent (for AI Orb, status glows, and technical telemetry)
  static const Color accentCyan = Color(0xFF00BBD4);
  static const Color accentCyanGlow = Color(0x6600BBD4);

  // Borders & Hairlines (Light)
  static const Color border = Color(0xFFD3E0E3); // 1px clean crisp hairline
  static const Color borderSubtle = Color(0xFFE2ECED); // Extra light hairline
  static const Color borderFocus = Color(0xFF087EFF);

  // Semantic Feedback
  static const Color success = Color(0xFF159D78); // Modern industrial green
  static const Color error = Color(0xFFD94B4B); // Industrial red
  static const Color danger = Color(0xFFD94B4B);
  static const Color warning = Color(0xFFE1A900); // Amber warning
  static const Color info = Color(0xFF087EFF);

  // Dark Industrial Theme Tokens
  static const Color darkBackground = Color(0xFF0F171E); // Deep slate canvas
  static const Color darkBackgroundSecondary = Color(0xFF141F28);
  static const Color darkSurface = Color(0xFF0F171E);
  static const Color darkSurfaceCard = Color(0xFF16232D);
  static const Color darkSurfaceAlt = Color(0xFF1B2B38); // Elevated cards & modals
  static const Color darkSurfaceElevated = Color(0xFF1F3240);
  static const Color darkSurfaceMuted = Color(0xFF14202B); // Recessed inputs, chips
  static const Color darkOnSurface = Color(0xFFE6EEF2); // Crisp silver-white text
  static const Color darkOnSurfaceVariant = Color(0xFF94A7B0); // Slate muted text
  static const Color darkTextMuted = Color(0xFF6B7E88); // Caption text
  static const Color darkBorder = Color(0xFF283A48);
  static const Color darkBorderSubtle = Color(0xFF1E2D38);
  static const Color darkPrimaryAction = Color(0xFFFFFFFF); // High-contrast white pill in dark mode
  static const Color darkOnPrimaryAction = Color(0xFF0F171E); // Dark text on pill
  static const Color darkPrimary = Color(0xFF3898FF); // Vibrant electric AI blue

  // Categorical Identity Dots & Indicators
  static const Color accentCategorical1 = Color(0xFFFF7A00); // Orange
  static const Color accentCategorical2 = Color(0xFF087EFF); // Blue
  static const Color accentCategorical3 = Color(0xFF00BBD4); // Cyan
  static const Color accentCategorical4 = Color(0xFF8B5CF6); // Purple
  static const Color accentCategorical5 = Color(0xFF06B6D4); // Teal
  static const Color accentCategorical6 = Color(0xFFEC4899); // Pink
  static const Color accentCategorical7 = Color(0xFFEF4444); // Red
  static const Color accentCategorical8 = Color(0xFFF59E0B); // Yellow

  // Backward-compatibility aliases for existing codebase references
  static const Color canvas = surface;
  static const Color surface1 = surfaceAlt;
  static const Color surface2 = surfaceMuted;
  static const Color surface3 = surfaceMuted;
  static const Color surface4 = backgroundSecondary;
  static const Color hairline = border;
  static const Color hairlineStrong = Color(0xFFB8C8CC);
  static const Color hairlineTertiary = borderSubtle;
  static const Color ink = onSurface;
  static const Color inkMuted = onSurfaceVariant;
  static const Color inkSubtle = onSurfaceVariant;
  static const Color inkTertiary = textMuted;
  static const Color brandSecure = primary;
}
