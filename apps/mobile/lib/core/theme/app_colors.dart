import 'package:flutter/material.dart';

/// MAN-U-AI Light Industrial Design System Color Tokens.
/// Inspired by modern minimal technical interfaces:
/// Light icy-blue canvas, crisp elevated white surfaces,
/// deep charcoal primary typography, minimal black pill actions,
/// electric blue and glowing cyan AI accents.
class AppColors {
  AppColors._();

  // Background & Surfaces
  static const Color background = Color(0xFFE8F0F2); // Light icy-blue page canvas
  static const Color backgroundSecondary = Color(0xFFDCE8EB); // Subtle depth layer
  static const Color surface = Color(0xFFE8F0F2); // Scaffold canvas
  static const Color surfaceCard = Color(0xFFF4F8F9); // Main secondary card fill
  static const Color surfaceAlt = Color(0xFFFFFFFF); // Elevated cards, rows, modals
  static const Color surfaceElevated = Color(0xFFFFFFFF); // Floating dialogs & sheets
  static const Color surfaceMuted = Color(0xFFEDF3F5); // Recessed wells, inputs, chips

  // Typography & Foreground Content
  static const Color onSurface = Color(0xFF101820); // Deep charcoal / near black primary
  static const Color onSurfaceVariant = Color(0xFF52636A); // Slate secondary text & metadata
  static const Color textMuted = Color(0xFF819197); // Tertiary caption & placeholder text

  // Primary Actions
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

  // Borders & Hairlines
  static const Color border = Color(0xFFD3E0E3); // 1px clean crisp hairline
  static const Color borderSubtle = Color(0xFFE2ECED); // Extra light hairline
  static const Color borderFocus = Color(0xFF087EFF);

  // Semantic Feedback
  static const Color success = Color(0xFF159D78); // Modern industrial green
  static const Color error = Color(0xFFD94B4B); // Industrial red
  static const Color danger = Color(0xFFD94B4B);
  static const Color warning = Color(0xFFE1A900); // Amber warning
  static const Color info = Color(0xFF087EFF);

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
