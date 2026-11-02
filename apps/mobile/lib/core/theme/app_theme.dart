import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';
import 'app_typography.dart';

/// MAN-U-AI Mobile AppTheme
/// Featuring modern Light Industrial and Dark Industrial design systems.
class AppTheme {
  AppTheme._();

  /// Default Light Industrial Theme
  static ThemeData get lightTheme {
    final fontFamily = GoogleFonts.spaceGrotesk().fontFamily;

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: const ColorScheme.light(
        surface: AppColors.surfaceAlt,
        onSurface: AppColors.onSurface,
        primary: AppColors.primaryAction,
        onPrimary: AppColors.onPrimaryAction,
        secondary: AppColors.primary,
        onSecondary: Colors.white,
        error: AppColors.error,
        onError: Colors.white,
        outline: AppColors.border,
      ),
      textTheme: TextTheme(
        displayLarge: AppTypography.displayLg,
        headlineLarge: AppTypography.headlineLg,
        headlineMedium: AppTypography.headlineMd,
        titleLarge: AppTypography.headlineMd,
        titleMedium: AppTypography.bodyMd,
        titleSmall: AppTypography.bodySm,
        bodyLarge: AppTypography.bodyMd,
        bodyMedium: AppTypography.bodyMdRegular,
        bodySmall: AppTypography.bodySm,
        labelLarge: AppTypography.labelMd,
        labelMedium: AppTypography.labelUppercase,
        labelSmall: AppTypography.caption,
      ),
      cardTheme: CardThemeData(
        color: AppColors.surfaceAlt,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18.0),
          side: const BorderSide(color: AppColors.border, width: 1.0),
        ),
        margin: EdgeInsets.zero,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceAlt,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14.0),
        hintStyle: AppTypography.labelUppercase.copyWith(
          color: AppColors.textMuted,
        ),
        labelStyle: AppTypography.labelUppercase.copyWith(
          color: AppColors.onSurfaceVariant,
        ),
        errorStyle: AppTypography.bodySm.copyWith(
          color: AppColors.error,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.0),
          borderSide: const BorderSide(color: AppColors.border, width: 1.0),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.0),
          borderSide: const BorderSide(color: AppColors.border, width: 1.0),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.0),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.8),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.0),
          borderSide: const BorderSide(color: AppColors.error, width: 1.0),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.0),
          borderSide: const BorderSide(color: AppColors.error, width: 1.8),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primaryAction,
          foregroundColor: AppColors.onPrimaryAction,
          elevation: 0,
          minimumSize: const Size.fromHeight(54.0),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28.0),
          ),
          textStyle: AppTypography.headlineMd.copyWith(
            fontSize: 15.5,
            letterSpacing: 0.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.onSurface,
          backgroundColor: AppColors.surfaceAlt,
          side: const BorderSide(color: AppColors.border, width: 1.0),
          minimumSize: const Size.fromHeight(44.0),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20.0),
          ),
          textStyle: AppTypography.labelMd,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: AppTypography.labelMd,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1.0,
        space: 1.0,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: AppTypography.headlineMd,
        iconTheme: const IconThemeData(color: AppColors.onSurface, size: 20.0),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surfaceAlt,
        elevation: 4.0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20.0),
          side: const BorderSide(color: AppColors.border, width: 1.0),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surfaceAlt,
        elevation: 8.0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24.0)),
        ),
      ),
    );
  }

  /// Dark Industrial Theme
  static ThemeData get darkTheme {
    final fontFamily = GoogleFonts.spaceGrotesk().fontFamily;

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: AppColors.darkBackground,
      colorScheme: const ColorScheme.dark(
        surface: AppColors.darkSurfaceAlt,
        onSurface: AppColors.darkOnSurface,
        primary: AppColors.darkPrimaryAction,
        onPrimary: AppColors.darkOnPrimaryAction,
        secondary: AppColors.darkPrimary,
        onSecondary: Colors.white,
        error: AppColors.error,
        onError: Colors.white,
        outline: AppColors.darkBorder,
      ),
      textTheme: TextTheme(
        displayLarge: AppTypography.displayLg.copyWith(color: AppColors.darkOnSurface),
        headlineLarge: AppTypography.headlineLg.copyWith(color: AppColors.darkOnSurface),
        headlineMedium: AppTypography.headlineMd.copyWith(color: AppColors.darkOnSurface),
        titleLarge: AppTypography.headlineMd.copyWith(color: AppColors.darkOnSurface),
        titleMedium: AppTypography.bodyMd.copyWith(color: AppColors.darkOnSurface),
        titleSmall: AppTypography.bodySm.copyWith(color: AppColors.darkOnSurfaceVariant),
        bodyLarge: AppTypography.bodyMd.copyWith(color: AppColors.darkOnSurface),
        bodyMedium: AppTypography.bodyMdRegular.copyWith(color: AppColors.darkOnSurfaceVariant),
        bodySmall: AppTypography.bodySm.copyWith(color: AppColors.darkOnSurfaceVariant),
        labelLarge: AppTypography.labelMd.copyWith(color: AppColors.darkOnSurface),
        labelMedium: AppTypography.labelUppercase.copyWith(color: AppColors.darkOnSurfaceVariant),
        labelSmall: AppTypography.caption.copyWith(color: AppColors.darkTextMuted),
      ),
      cardTheme: CardThemeData(
        color: AppColors.darkSurfaceAlt,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18.0),
          side: const BorderSide(color: AppColors.darkBorder, width: 1.0),
        ),
        margin: EdgeInsets.zero,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.darkSurfaceMuted,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14.0),
        hintStyle: AppTypography.labelUppercase.copyWith(
          color: AppColors.darkTextMuted,
        ),
        labelStyle: AppTypography.labelUppercase.copyWith(
          color: AppColors.darkOnSurfaceVariant,
        ),
        errorStyle: AppTypography.bodySm.copyWith(
          color: AppColors.error,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.0),
          borderSide: const BorderSide(color: AppColors.darkBorder, width: 1.0),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.0),
          borderSide: const BorderSide(color: AppColors.darkBorder, width: 1.0),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.0),
          borderSide: const BorderSide(color: AppColors.darkPrimary, width: 1.8),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.0),
          borderSide: const BorderSide(color: AppColors.error, width: 1.0),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.0),
          borderSide: const BorderSide(color: AppColors.error, width: 1.8),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.darkPrimaryAction,
          foregroundColor: AppColors.darkOnPrimaryAction,
          elevation: 0,
          minimumSize: const Size.fromHeight(54.0),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28.0),
          ),
          textStyle: AppTypography.headlineMd.copyWith(
            fontSize: 15.5,
            letterSpacing: 0.5,
            fontWeight: FontWeight.w600,
            color: AppColors.darkOnPrimaryAction,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.darkOnSurface,
          backgroundColor: AppColors.darkSurfaceAlt,
          side: const BorderSide(color: AppColors.darkBorder, width: 1.0),
          minimumSize: const Size.fromHeight(44.0),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20.0),
          ),
          textStyle: AppTypography.labelMd.copyWith(color: AppColors.darkOnSurface),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.darkPrimary,
          textStyle: AppTypography.labelMd.copyWith(color: AppColors.darkPrimary),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.darkBorder,
        thickness: 1.0,
        space: 1.0,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.darkBackground,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: AppTypography.headlineMd.copyWith(color: AppColors.darkOnSurface),
        iconTheme: const IconThemeData(color: AppColors.darkOnSurface, size: 20.0),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.darkSurfaceAlt,
        elevation: 4.0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20.0),
          side: const BorderSide(color: AppColors.darkBorder, width: 1.0),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.darkSurfaceAlt,
        elevation: 8.0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24.0)),
        ),
      ),
    );
  }
}
