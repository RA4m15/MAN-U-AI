import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/env_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/widgets/terminal_components.dart';
import '../controllers/auth_controller.dart';
import '../models/auth_state.dart';

/// Terminal Cobalt Mobile Login Screen
/// Industrial. Instrumented. Operational.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isCheckingHealth = false;
  bool _isSubmitting = false;
  String? _healthStatus;

  String _lastSubmittedEmail = '';
  String _lastSubmittedPassword = '';

  @override
  void initState() {
    super.initState();
    _emailController.addListener(_onFieldChanged);
    _passwordController.addListener(_onFieldChanged);
  }

  void _onFieldChanged() {
    if (_isSubmitting) return;
    final state = ref.read(authControllerProvider);
    if (state is Unauthenticated && state.errorMessage != null) {
      if (_emailController.text != _lastSubmittedEmail ||
          _passwordController.text != _lastSubmittedPassword) {
        ref.read(authControllerProvider.notifier).clearError();
      }
    }
  }

  @override
  void dispose() {
    _emailController.removeListener(_onFieldChanged);
    _passwordController.removeListener(_onFieldChanged);
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final authState = ref.read(authControllerProvider);
    if (authState is AuthLoading || _isSubmitting) return;

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() {
      _isSubmitting = true;
      _lastSubmittedEmail = _emailController.text;
      _lastSubmittedPassword = _passwordController.text;
    });

    try {
      final success = await ref.read(authControllerProvider.notifier).login(
            _emailController.text,
            _passwordController.text,
          );
      if (!success && mounted) {
        _passwordController.clear();
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _runHealthCheck() async {
    setState(() {
      _isCheckingHealth = true;
      _healthStatus = null;
    });

    final result = await ref.read(authControllerProvider.notifier).checkServerHealth();
    if (mounted) {
      setState(() {
        _isCheckingHealth = false;
        _healthStatus = result.statusMessage;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.statusMessage.toUpperCase(),
            style: AppTypography.caption.copyWith(color: Colors.white),
          ),
          backgroundColor: result.isHealthy ? AppColors.surfaceAlt : AppColors.error,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  void _fillCredentials(String email, String password) {
    setState(() {
      _emailController.text = email;
      _passwordController.text = password;
    });
  }

  void _showServerConfigModal(BuildContext context) {
    final urlController = TextEditingController(text: EnvConfig.apiBaseUrl);
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceAlt,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(8.0)), // rounded.lg
        side: BorderSide(color: AppColors.border, width: 1.0),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20.0,
            right: 20.0,
            top: 20.0,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24.0,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const SectionHeader(
                    title: 'API Server Config',
                    padding: EdgeInsets.zero,
                  ),
                  ButtonIconTile(
                    icon: Icons.close_rounded,
                    size: 36.0,
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 12.0),
              Text(
                'Configure the active backend host for local or cloud environments:'
                    .toUpperCase(),
                style: AppTypography.caption,
              ),
              const SizedBox(height: 16.0),
              TextField(
                key: const Key('server_url_input'),
                controller: urlController,
                style: AppTypography.bodyMd,
                decoration: InputDecoration(
                  labelText: 'API BASE URL',
                  hintText: 'http://localhost:4000/api/v1',
                ),
              ),
              const SizedBox(height: 14.0),
              Wrap(
                spacing: 8.0,
                runSpacing: 8.0,
                children: [
                  SecondaryButton(
                    label: 'Localhost (4000)',
                    onPressed: () {
                      urlController.text = EnvConfig.localHostApiBaseUrl;
                    },
                  ),
                  SecondaryButton(
                    label: 'Emulator (10.0.2.2)',
                    onPressed: () {
                      urlController.text = EnvConfig.emulatorApiBaseUrl;
                    },
                  ),
                  SecondaryButton(
                    label: 'Cloud Staging',
                    onPressed: () {
                      urlController.text = EnvConfig.productionApiBaseUrl;
                    },
                  ),
                ],
              ),
              const SizedBox(height: 20.0),
              Row(
                children: [
                  Expanded(
                    child: SecondaryButton(
                      label: 'CANCEL',
                      onPressed: () => Navigator.of(ctx).pop(),
                    ),
                  ),
                  const SizedBox(width: 12.0),
                  Expanded(
                    child: MachinedPrimaryButton(
                      buttonKey: const Key('save_server_url_button'),
                      label: 'APPLY & SAVE',
                      height: 40.0,
                      onPressed: () {
                        final raw = urlController.text.trim();
                        final err = EnvConfig.validateBaseUrl(raw, isRelease: false);
                        if (err != null) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(err),
                              backgroundColor: AppColors.error,
                            ),
                          );
                          return;
                        }
                        ref.read(authControllerProvider.notifier).setServerUrl(raw);
                        Navigator.of(ctx).pop();
                        setState(() {});
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState is AuthLoading || _isSubmitting;
    final errorMessage = authState is Unauthenticated ? authState.errorMessage : null;
    final activeBaseUrl = EnvConfig.apiBaseUrl;

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Top Status Line
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const StatusDot(color: AppColors.success),
                            const SizedBox(width: 8.0),
                            Text(
                              'OPERATIONAL CONSOLE // 4000',
                              style: AppTypography.caption.copyWith(
                                color: AppColors.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                        if (kDebugMode)
                          ButtonIconTile(
                            key: const Key('configure_server_button'),
                            icon: Icons.settings_rounded,
                            size: 36.0,
                            tooltip: 'Configure Server',
                            onPressed: () => _showServerConfigModal(context),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12.0),

                    // Square Avatar Slot (Signature 48px, 2px Primary Border)
                    Center(
                      child: Container(
                        width: 48.0,
                        height: 48.0,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(color: AppColors.primary, width: 2.0),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Image.asset(
                          'assets/images/logo.png',
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) => const Center(
                            child: Icon(
                              Icons.precision_manufacturing_rounded,
                              color: AppColors.primary,
                              size: 26.0,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8.0),

                    // Title & Tagline
                    Text(
                      'MAN-U-AI',
                      textAlign: TextAlign.center,
                      style: AppTypography.headlineLg.copyWith(
                        fontSize: 24.0,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 2.0),
                    Text(
                      'Industrial Reliability AI Copilot',
                      textAlign: TextAlign.center,
                      style: AppTypography.labelUppercase.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 12.0),

                    // Section Heading with 4px Primary Bar
                    const SectionHeader(
                      title: 'OPERATOR CREDENTIALS',
                      padding: EdgeInsets.only(bottom: 8.0),
                    ),

                    // Quick Role Switcher Chips (Instrumented Preset Buttons)
                    Wrap(
                      spacing: 8.0,
                      runSpacing: 8.0,
                      children: [
                        _buildQuickRoleChip(
                          label: 'LEAD ENGINEER',
                          email: 'engineer@plant.io',
                          password: 'EngineerPassword123!',
                          dotColor: AppColors.accentCategorical2,
                        ),
                        _buildQuickRoleChip(
                          label: 'SHIFT OPERATOR',
                          email: 'operator@plant.io',
                          password: 'OperatorPassword123!',
                          dotColor: AppColors.accentCategorical1,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8.0),

                    // Error Banner
                    if (errorMessage != null && errorMessage.isNotEmpty) ...[
                      Container(
                        key: const Key('login_error_banner'),
                        padding: const EdgeInsets.all(12.0),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(
                            color: AppColors.error.withValues(alpha: 0.20),
                            width: 1.0,
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Padding(
                              padding: EdgeInsets.only(top: 1.0),
                              child: Icon(
                                Icons.error_outline_rounded,
                                color: AppColors.error,
                                size: 16.0,
                              ),
                            ),
                            const SizedBox(width: 10.0),
                            Expanded(
                              child: Text(
                                errorMessage,
                                style: AppTypography.caption.copyWith(
                                  color: AppColors.error,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16.0),
                    ],

                    // Email Field
                    Text(
                      'WORK EMAIL',
                      style: AppTypography.labelUppercase,
                    ),
                    const SizedBox(height: 6.0),
                    TextFormField(
                      key: const Key('login_email_input'),
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      enabled: !isLoading,
                      style: AppTypography.bodyMd,
                      decoration: const InputDecoration(
                        hintText: 'OPERATOR@PLANT.IO',
                        prefixIcon: Icon(
                          Icons.alternate_email_rounded,
                          size: 18.0,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Please enter your email address';
                        }
                        if (!value.contains('@')) {
                          return 'Please enter a valid email address';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 10.0),

                    // Password Field
                    Text(
                      'ACCESS KEY / PASSWORD',
                      style: AppTypography.labelUppercase,
                    ),
                    const SizedBox(height: 6.0),
                    TextFormField(
                      key: const Key('login_password_input'),
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.done,
                      enabled: !isLoading,
                      style: AppTypography.bodyMd,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        hintText: '••••••••••••',
                        prefixIcon: const Icon(
                          Icons.lock_outline_rounded,
                          size: 18.0,
                          color: AppColors.onSurfaceVariant,
                        ),
                        suffixIcon: IconButton(
                          key: const Key('login_password_toggle'),
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                            size: 18.0,
                            color: AppColors.onSurfaceVariant,
                          ),
                          onPressed: () {
                            setState(() {
                              _obscurePassword = !_obscurePassword;
                            });
                          },
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please enter your password';
                        }
                        if (value.length < 6) {
                          return 'Password must be at least 6 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16.0),

                    // Submit Button (Machined Primary Cobalt CTA)
                    MachinedPrimaryButton(
                      buttonKey: const Key('login_submit_button'),
                      label: 'Sign in to MAN-U-AI',
                      isLoading: isLoading,
                      icon: Icons.login_rounded,
                      onPressed: _submit,
                    ),
                    const SizedBox(height: 16.0),

                    // Register Link
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          "NEED PLANT ENROLLMENT? ",
                          style: AppTypography.caption,
                        ),
                        InkWell(
                          key: const Key('login_create_account_button'),
                          onTap: isLoading
                              ? null
                              : () {
                                  ref.read(authControllerProvider.notifier).clearError();
                                  context.push('/register');
                                },
                          child: Text(
                            "Create account",
                            style: AppTypography.caption.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24.0),

                    // Telemetry & Diagnostics Strip
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(8.0),
                        border: Border.all(color: AppColors.border, width: 1.0),
                      ),
                      child: Row(
                        children: [
                          const StatusDot(color: AppColors.success, size: 8.0),
                          const SizedBox(width: 8.0),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'HOST: ${activeBaseUrl.replaceAll('/api/v1', '')}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTypography.caption,
                                ),
                                if (_healthStatus != null)
                                  Text(
                                    _healthStatus!,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.caption.copyWith(
                                      color: _healthStatus!.contains('Connected')
                                          ? AppColors.success
                                          : AppColors.warning,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          ButtonIconTile(
                            key: const Key('check_server_health_button'),
                            icon: _isCheckingHealth
                                ? Icons.sync_rounded
                                : Icons.cloud_outlined,
                            size: 32.0,
                            tooltip: 'Ping Health',
                            onPressed: _isCheckingHealth ? null : _runHealthCheck,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16.0),

                    // Security Footer
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.shield_outlined,
                          size: 14.0,
                          color: AppColors.onSurfaceVariant,
                        ),
                        const SizedBox(width: 6.0),
                        Text(
                          'Authorized Facility Personnel Only',
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQuickRoleChip({
    required String label,
    required String email,
    required String password,
    required Color dotColor,
  }) {
    final isSelected = _emailController.text == email;

    return Container(
      decoration: BoxDecoration(
        color: isSelected ? AppColors.primary : AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(8.0), // rounded.lg
        border: Border.all(
          color: isSelected ? AppColors.primary : AppColors.border,
          width: 1.0,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(8.0),
          onTap: () => _fillCredentials(email, password),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 8.0),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8.0,
                  height: 8.0,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8.0),
                Text(
                  label,
                  style: AppTypography.labelMd.copyWith(
                    fontSize: 11.0,
                    color: isSelected ? Colors.white : AppColors.onSurface,
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
