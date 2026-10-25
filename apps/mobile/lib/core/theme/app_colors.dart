import 'package:flutter/material.dart';

/// MAN-U-AI Industrial Dark design tokens.
/// Exactly matches `apps/web/tailwind.config.js` and `apps/web/src/index.css`.
class AppColors {
  AppColors._();

  // Background and Canvas
  static const Color canvas = Color(0xFF010102);

  // Surfaces (Linear-inspired, industrial dark hierarchy)
  static const Color surface1 = Color(0xFF0F1011);
  static const Color surface2 = Color(0xFF141516);
  static const Color surface3 = Color(0xFF18191A);
  static const Color surface4 = Color(0xFF1E1F21);

  // Hairlines and Borders
  static const Color hairline = Color(0xFF23252A);
  static const Color hairlineStrong = Color(0xFF34343A);
  static const Color hairlineTertiary = Color(0xFF3E3E44);

  // Primary Violet Accent
  static const Color primary = Color(0xFF5E6AD2);
  static const Color primaryHover = Color(0xFF828FFF);
  static const Color primaryFocus = Color(0xFF5E69D1);
  static const Color primaryMuted = Color(0xFF3D4499);
  static const Color primarySubtle = Color(0xFF1E2154);

  // Text / Ink Hierarchy
  static const Color ink = Color(0xFFF7F8F8);
  static const Color inkMuted = Color(0xFFD0D6E0);
  static const Color inkSubtle = Color(0xFF8A8F98);
  static const Color inkTertiary = Color(0xFF62666D);

  // Semantic Diagnostic Colors
  static const Color danger = Color(0xFFEF4444); // Critical LOTO / High Hazard
  static const Color warning = Color(0xFFF59E0B); // Amber Caution
  static const Color success = Color(0xFF27A644); // Healthy / Operational
  static const Color info = Color(0xFF3B82F6);

  // Brand Security Accent
  static const Color brandSecure = Color(0xFF7A7FAD);
}
