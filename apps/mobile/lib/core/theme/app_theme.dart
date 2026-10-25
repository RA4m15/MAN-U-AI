import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get darkTheme {
    final interFont = GoogleFonts.inter().fontFamily;

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: interFont,
      scaffoldBackgroundColor: AppColors.canvas,
      colorScheme: const ColorScheme.dark(
        surface: AppColors.surface1,
        primary: AppColors.primary,
        onPrimary: AppColors.ink,
        secondary: AppColors.primaryHover,
        onSecondary: AppColors.ink,
        error: AppColors.danger,
        onError: AppColors.ink,
        outline: AppColors.hairline,
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          color: AppColors.ink,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.03,
        ),
        headlineMedium: TextStyle(
          color: AppColors.ink,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.02,
        ),
        titleLarge: TextStyle(
          color: AppColors.ink,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.01,
        ),
        titleMedium: TextStyle(
          color: AppColors.ink,
          fontWeight: FontWeight.w500,
        ),
        bodyLarge: TextStyle(
          color: AppColors.inkMuted,
          fontSize: 15.0,
          height: 1.5,
        ),
        bodyMedium: TextStyle(
          color: AppColors.inkMuted,
          fontSize: 14.0,
          height: 1.5,
        ),
        bodySmall: TextStyle(
          color: AppColors.inkSubtle,
          fontSize: 12.0,
          height: 1.4,
        ),
        labelLarge: TextStyle(
          color: AppColors.ink,
          fontWeight: FontWeight.w500,
          fontSize: 14.0,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface1,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8.0),
          side: const BorderSide(color: AppColors.hairline),
        ),
        margin: EdgeInsets.zero,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface3,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 14.0),
        hintStyle: const TextStyle(
          color: AppColors.inkTertiary,
          fontSize: 14.0,
          fontWeight: FontWeight.w400,
        ),
        labelStyle: const TextStyle(
          color: AppColors.inkSubtle,
          fontSize: 14.0,
          fontWeight: FontWeight.w500,
        ),
        errorStyle: const TextStyle(
          color: AppColors.danger,
          fontSize: 12.0,
          fontWeight: FontWeight.w500,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8.0),
          borderSide: const BorderSide(color: AppColors.hairline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8.0),
          borderSide: const BorderSide(color: AppColors.hairline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8.0),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8.0),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8.0),
          borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.ink,
          elevation: 0,
          minimumSize: const Size.fromHeight(46.0),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8.0),
          ),
          textStyle: const TextStyle(
            fontSize: 14.0,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.01,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          side: const BorderSide(color: AppColors.hairline),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8.0),
          ),
          textStyle: const TextStyle(
            fontSize: 14.0,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primaryHover,
          textStyle: const TextStyle(
            fontSize: 13.0,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.hairline,
        thickness: 1.0,
        space: 1.0,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.surface1,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: AppColors.ink,
          fontSize: 16.0,
          fontWeight: FontWeight.w600,
        ),
        iconTheme: IconThemeData(color: AppColors.ink),
      ),
    );
  }
}
