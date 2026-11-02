import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/localization/locale_notifier.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/theme_notifier.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../auth/models/auth_state.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentThemeMode = ref.watch(themeNotifierProvider);
    final currentLocale = ref.watch(localeNotifierProvider);
    final authState = ref.watch(authControllerProvider);
    final currentUser = authState is Authenticated ? authState.user : null;
    final l10n = AppLocalizations.of(context)!;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final cardBg = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final cardBorder = isDark ? AppColors.darkBorder : AppColors.border;
    final textPrimary = isDark ? AppColors.darkOnSurface : AppColors.onSurface;
    final textSecondary = isDark ? AppColors.darkOnSurfaceVariant : AppColors.onSurfaceVariant;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          l10n.settingsTitle,
          style: AppTypography.headlineMd.copyWith(color: textPrimary, fontSize: 16.0),
        ),
        leading: IconButton(
          key: const Key('settings_back_button'),
          icon: Icon(Icons.arrow_back_rounded, color: textPrimary, size: 22.0),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/home');
            }
          },
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 20.0),
        children: [
          // Section: Appearance / Theme
          _buildSectionHeader(context, l10n.appearanceSection, Icons.palette_outlined),
          const SizedBox(height: 10.0),
          _buildThemeCard(
            context: context,
            ref: ref,
            title: l10n.lightMode,
            description: l10n.lightModeDescription,
            mode: ThemeMode.light,
            currentMode: currentThemeMode,
            icon: Icons.light_mode_outlined,
            cardBg: cardBg,
            cardBorder: cardBorder,
            textPrimary: textPrimary,
            textSecondary: textSecondary,
            widgetKey: const Key('theme_option_light'),
          ),
          const SizedBox(height: 10.0),
          _buildThemeCard(
            context: context,
            ref: ref,
            title: l10n.darkMode,
            description: l10n.darkModeDescription,
            mode: ThemeMode.dark,
            currentMode: currentThemeMode,
            icon: Icons.dark_mode_outlined,
            cardBg: cardBg,
            cardBorder: cardBorder,
            textPrimary: textPrimary,
            textSecondary: textSecondary,
            widgetKey: const Key('theme_option_dark'),
          ),
          const SizedBox(height: 10.0),
          _buildThemeCard(
            context: context,
            ref: ref,
            title: l10n.systemDefault,
            description: l10n.systemDefaultDescription,
            mode: ThemeMode.system,
            currentMode: currentThemeMode,
            icon: Icons.brightness_auto_outlined,
            cardBg: cardBg,
            cardBorder: cardBorder,
            textPrimary: textPrimary,
            textSecondary: textSecondary,
            widgetKey: const Key('theme_option_system'),
          ),

          const SizedBox(height: 28.0),

          // Section: Language / भाषा
          _buildSectionHeader(context, l10n.languageSection, Icons.translate_rounded),
          const SizedBox(height: 10.0),
          _buildLocaleCard(
            context: context,
            ref: ref,
            title: l10n.englishLanguage,
            subtitle: l10n.englishLanguageSubtitle,
            locale: const Locale('en'),
            currentLocale: currentLocale,
            badge: 'EN',
            cardBg: cardBg,
            cardBorder: cardBorder,
            textPrimary: textPrimary,
            textSecondary: textSecondary,
            widgetKey: const Key('language_option_en'),
          ),
          const SizedBox(height: 10.0),
          _buildLocaleCard(
            context: context,
            ref: ref,
            title: l10n.hindiLanguage,
            subtitle: l10n.hindiLanguageSubtitle,
            locale: const Locale('hi'),
            currentLocale: currentLocale,
            badge: 'HI',
            cardBg: cardBg,
            cardBorder: cardBorder,
            textPrimary: textPrimary,
            textSecondary: textSecondary,
            widgetKey: const Key('language_option_hi'),
          ),

          const SizedBox(height: 28.0),

          // Section: Operator Account
          _buildSectionHeader(context, l10n.userAccountSection, Icons.badge_outlined),
          const SizedBox(height: 10.0),
          Container(
            padding: const EdgeInsets.all(16.0),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(16.0),
              border: Border.all(color: cardBorder, width: 1.0),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 44.0,
                      height: 44.0,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12.0),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        (currentUser?.name.isNotEmpty == true)
                            ? currentUser!.name[0].toUpperCase()
                            : 'E',
                        style: AppTypography.headlineMd.copyWith(
                          color: AppColors.primary,
                          fontSize: 18.0,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14.0),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            currentUser?.name ?? 'Field Reliability Engineer',
                            style: AppTypography.bodyMd.copyWith(
                              color: textPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 2.0),
                          Text(
                            currentUser?.email ?? 'engineer@plant.com',
                            style: AppTypography.caption.copyWith(color: textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14.0),
                Divider(color: cardBorder, height: 1.0),
                const SizedBox(height: 12.0),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      l10n.activeRole,
                      style: AppTypography.labelUppercase.copyWith(
                        fontSize: 11.0,
                        color: textSecondary,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12.0),
                      ),
                      child: Text(
                        (currentUser?.role ?? 'engineer').toUpperCase(),
                        style: AppTypography.labelUppercase.copyWith(
                          fontSize: 10.5,
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16.0),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    key: const Key('settings_sign_out_button'),
                    icon: const Icon(Icons.logout_rounded, size: 18.0, color: AppColors.error),
                    label: Text(
                      l10n.signOut,
                      style: AppTypography.bodyMd.copyWith(
                        color: AppColors.error,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.error, width: 1.0),
                      padding: const EdgeInsets.symmetric(vertical: 12.0),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12.0),
                      ),
                    ),
                    onPressed: () {
                      _showSignOutDialog(context, ref, l10n);
                    },
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 28.0),

          // Section: Application Information
          _buildSectionHeader(context, l10n.appInfoSection, Icons.info_outline_rounded),
          const SizedBox(height: 10.0),
          Container(
            padding: const EdgeInsets.all(16.0),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(16.0),
              border: Border.all(color: cardBorder, width: 1.0),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'MAN-U-AI Copilot',
                      style: AppTypography.bodyMd.copyWith(
                        color: textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      l10n.appVersion,
                      style: AppTypography.caption.copyWith(color: textSecondary),
                    ),
                  ],
                ),
                const SizedBox(height: 12.0),
                Divider(color: cardBorder, height: 1.0),
                const SizedBox(height: 12.0),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      l10n.offlineCacheTitle,
                      style: AppTypography.caption.copyWith(color: textSecondary),
                    ),
                    TextButton(
                      key: const Key('settings_clear_cache_button'),
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(l10n.cacheClearedNotice),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      },
                      child: Text(
                        l10n.clearCacheButton,
                        style: AppTypography.caption.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 32.0),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title, IconData icon) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = isDark ? AppColors.darkOnSurfaceVariant : AppColors.onSurfaceVariant;
    return Row(
      children: [
        Icon(icon, size: 16.0, color: AppColors.primary),
        const SizedBox(width: 8.0),
        Text(
          title,
          style: AppTypography.labelUppercase.copyWith(
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _buildThemeCard({
    required BuildContext context,
    required WidgetRef ref,
    required String title,
    required String description,
    required ThemeMode mode,
    required ThemeMode currentMode,
    required IconData icon,
    required Color cardBg,
    required Color cardBorder,
    required Color textPrimary,
    required Color textSecondary,
    required Key widgetKey,
  }) {
    final isSelected = currentMode == mode;
    final activeBorderColor = isSelected ? AppColors.primary : cardBorder;
    final activeBgColor = isSelected
        ? AppColors.primary.withValues(alpha: 0.08)
        : cardBg;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        key: widgetKey,
        onTap: () {
          ref.read(themeNotifierProvider.notifier).setThemeMode(mode);
        },
        borderRadius: BorderRadius.circular(16.0),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14.0),
          decoration: BoxDecoration(
            color: activeBgColor,
            borderRadius: BorderRadius.circular(16.0),
            border: Border.all(color: activeBorderColor, width: isSelected ? 1.8 : 1.0),
          ),
          child: Row(
            children: [
              Container(
                width: 40.0,
                height: 40.0,
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.primary
                      : (Theme.of(context).brightness == Brightness.dark
                          ? AppColors.darkSurfaceMuted
                          : AppColors.surfaceMuted),
                  borderRadius: BorderRadius.circular(10.0),
                ),
                child: Icon(
                  icon,
                  size: 20.0,
                  color: isSelected ? Colors.white : textSecondary,
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
                        color: textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 14.0,
                      ),
                    ),
                    const SizedBox(height: 2.0),
                    Text(
                      description,
                      style: AppTypography.caption.copyWith(
                        color: textSecondary,
                        fontSize: 11.0,
                      ),
                    ),
                  ],
                ),
              ),
              if (isSelected)
                const Icon(
                  Icons.check_circle_rounded,
                  color: AppColors.primary,
                  size: 22.0,
                )
              else
                Icon(
                  Icons.radio_button_unchecked_rounded,
                  color: textSecondary.withValues(alpha: 0.5),
                  size: 22.0,
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLocaleCard({
    required BuildContext context,
    required WidgetRef ref,
    required String title,
    required String subtitle,
    required Locale locale,
    required Locale currentLocale,
    required String badge,
    required Color cardBg,
    required Color cardBorder,
    required Color textPrimary,
    required Color textSecondary,
    required Key widgetKey,
  }) {
    final isSelected = currentLocale.languageCode == locale.languageCode;
    final activeBorderColor = isSelected ? AppColors.primary : cardBorder;
    final activeBgColor = isSelected
        ? AppColors.primary.withValues(alpha: 0.08)
        : cardBg;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        key: widgetKey,
        onTap: () {
          ref.read(localeNotifierProvider.notifier).setLocale(locale);
        },
        borderRadius: BorderRadius.circular(16.0),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14.0),
          decoration: BoxDecoration(
            color: activeBgColor,
            borderRadius: BorderRadius.circular(16.0),
            border: Border.all(color: activeBorderColor, width: isSelected ? 1.8 : 1.0),
          ),
          child: Row(
            children: [
              Container(
                width: 40.0,
                height: 40.0,
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.primary
                      : (Theme.of(context).brightness == Brightness.dark
                          ? AppColors.darkSurfaceMuted
                          : AppColors.surfaceMuted),
                  borderRadius: BorderRadius.circular(10.0),
                ),
                alignment: Alignment.center,
                child: Text(
                  badge,
                  style: AppTypography.headlineMd.copyWith(
                    color: isSelected ? Colors.white : textSecondary,
                    fontSize: 14.0,
                    fontWeight: FontWeight.w800,
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
                        color: textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 14.0,
                      ),
                    ),
                    const SizedBox(height: 2.0),
                    Text(
                      subtitle,
                      style: AppTypography.caption.copyWith(
                        color: textSecondary,
                        fontSize: 11.0,
                      ),
                    ),
                  ],
                ),
              ),
              if (isSelected)
                const Icon(
                  Icons.check_circle_rounded,
                  color: AppColors.primary,
                  size: 22.0,
                )
              else
                Icon(
                  Icons.radio_button_unchecked_rounded,
                  color: textSecondary.withValues(alpha: 0.5),
                  size: 22.0,
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showSignOutDialog(BuildContext context, WidgetRef ref, AppLocalizations l10n) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.signOut),
        content: Text(l10n.confirmSignOut),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.cancel),
          ),
          ElevatedButton(
            key: const Key('confirm_sign_out_button'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              minimumSize: const Size(100, 42),
            ),
            onPressed: () {
              Navigator.of(ctx).pop();
              ref.read(authControllerProvider.notifier).logout();
            },
            child: Text(l10n.signOut),
          ),
        ],
      ),
    );
  }
}
