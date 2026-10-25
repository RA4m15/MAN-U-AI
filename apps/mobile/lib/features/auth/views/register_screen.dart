import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/env_config.dart';
import '../../../core/theme/app_colors.dart';
import '../controllers/auth_controller.dart';
import '../models/auth_state.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isCheckingHealth = false;
  bool _isSubmitting = false;

  String _lastSubmittedName = '';
  String _lastSubmittedEmail = '';
  String _lastSubmittedPassword = '';
  String _lastSubmittedConfirmPassword = '';

  @override
  void initState() {
    super.initState();
    _nameController.addListener(_onFieldChanged);
    _emailController.addListener(_onFieldChanged);
    _passwordController.addListener(_onFieldChanged);
    _confirmPasswordController.addListener(_onFieldChanged);
  }

  void _onFieldChanged() {
    if (_isSubmitting) return;
    final state = ref.read(authControllerProvider);
    if (state is Unauthenticated && state.errorMessage != null) {
      if (_nameController.text != _lastSubmittedName ||
          _emailController.text != _lastSubmittedEmail ||
          _passwordController.text != _lastSubmittedPassword ||
          _confirmPasswordController.text != _lastSubmittedConfirmPassword) {
        ref.read(authControllerProvider.notifier).clearError();
      }
    }
  }

  @override
  void dispose() {
    _nameController.removeListener(_onFieldChanged);
    _emailController.removeListener(_onFieldChanged);
    _passwordController.removeListener(_onFieldChanged);
    _confirmPasswordController.removeListener(_onFieldChanged);

    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
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
      _lastSubmittedName = _nameController.text;
      _lastSubmittedEmail = _emailController.text;
      _lastSubmittedPassword = _passwordController.text;
      _lastSubmittedConfirmPassword = _confirmPasswordController.text;
    });

    try {
      final success = await ref.read(authControllerProvider.notifier).register(
            name: _nameController.text,
            email: _emailController.text,
            password: _passwordController.text,
          );

      if (success && mounted) {
        // Clear sensitive passwords on successful registration
        _passwordController.clear();
        _confirmPasswordController.clear();
        try {
          if (context.mounted) {
            context.go('/home');
          }
        } catch (_) {
          // Fallback if running outside GoRouter scope in isolated widget tests
        }
      }
      // On failure, keep all fields (including password) in memory for retry.
      // The error banner remains clearly visible and will not be erased.
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
    });

    final result = await ref.read(authControllerProvider.notifier).checkServerHealth();
    if (mounted) {
      setState(() {
        _isCheckingHealth = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.statusMessage),
          backgroundColor: result.isHealthy ? AppColors.surface3 : AppColors.danger,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState is AuthLoading || _isSubmitting;
    final errorMessage = authState is Unauthenticated ? authState.errorMessage : null;
    final activeBaseUrl = EnvConfig.apiBaseUrl;

    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 28.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420.0),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Brand Logo & Icon Header
                    Center(
                      child: Container(
                        width: 52.0,
                        height: 52.0,
                        decoration: BoxDecoration(
                          color: AppColors.surface2,
                          borderRadius: BorderRadius.circular(14.0),
                          border: Border.all(color: AppColors.hairlineStrong),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.25),
                              blurRadius: 18.0,
                              spreadRadius: 2.0,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.person_add_alt_1_rounded,
                          color: AppColors.primary,
                          size: 26.0,
                        ),
                      ),
                    ),
                    const SizedBox(height: 18.0),

                    // Title & Subtitle
                    Text(
                      'Create Technician Account',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            letterSpacing: -0.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink,
                            fontSize: 22.0,
                          ),
                    ),
                    const SizedBox(height: 6.0),
                    Text(
                      'MAN-U-AI Copilot Access Registration',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.primaryHover,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.2,
                          ),
                    ),
                    const SizedBox(height: 8.0),
                    Text(
                      'Register for verified troubleshooting access, equipment manuals, and SOP consultations.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.inkSubtle,
                            height: 1.4,
                            fontSize: 13.0,
                          ),
                    ),
                    const SizedBox(height: 24.0),

                    // Error Banner with Diagnostic Action
                    if (errorMessage != null && errorMessage.isNotEmpty) ...[
                      Container(
                        key: const Key('register_error_banner'),
                        padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(color: AppColors.danger.withValues(alpha: 0.6)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Padding(
                                  padding: EdgeInsets.only(top: 2.0),
                                  child: Icon(
                                    Icons.error_outline_rounded,
                                    color: AppColors.danger,
                                    size: 18.0,
                                  ),
                                ),
                                const SizedBox(width: 10.0),
                                Expanded(
                                  child: Text(
                                    errorMessage,
                                    style: const TextStyle(
                                      color: AppColors.ink,
                                      fontSize: 13.0,
                                      height: 1.4,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10.0),
                            Wrap(
                              spacing: 8.0,
                              runSpacing: 6.0,
                              alignment: WrapAlignment.end,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                if (errorMessage.toLowerCase().contains('already registered') ||
                                    errorMessage.toLowerCase().contains('sign in')) ...[
                                  ElevatedButton.icon(
                                    key: const Key('register_error_signin_button'),
                                    onPressed: () {
                                      ref.read(authControllerProvider.notifier).clearError();
                                      if (context.canPop()) {
                                        context.pop();
                                      } else {
                                        context.go('/login');
                                      }
                                    },
                                    icon: const Icon(Icons.login_rounded, size: 14.0),
                                    label: const Text(
                                      'Sign in now',
                                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primary,
                                      foregroundColor: AppColors.canvas,
                                      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
                                      minimumSize: Size.zero,
                                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    ),
                                  ),
                                ],
                                TextButton.icon(
                                  key: const Key('register_test_connection_button'),
                                  onPressed: _isCheckingHealth ? null : _runHealthCheck,
                                  icon: _isCheckingHealth
                                      ? const SizedBox(
                                          width: 12.0,
                                          height: 12.0,
                                          child: CircularProgressIndicator(strokeWidth: 1.5),
                                        )
                                      : const Icon(Icons.sync_rounded, size: 14.0),
                                  label: const Text(
                                    'Test Server Reachability',
                                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
                                  ),
                                  style: TextButton.styleFrom(
                                    foregroundColor: AppColors.primaryHover,
                                    padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18.0),
                    ],

                    // Full Name Field
                    Text(
                      'Full name',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            fontSize: 13.0,
                            color: AppColors.inkMuted,
                          ),
                    ),
                    const SizedBox(height: 8.0),
                    TextFormField(
                      key: const Key('register_name_input'),
                      controller: _nameController,
                      keyboardType: TextInputType.name,
                      textInputAction: TextInputAction.next,
                      textCapitalization: TextCapitalization.words,
                      enabled: !isLoading,
                      style: const TextStyle(color: AppColors.ink, fontSize: 14.0),
                      decoration: const InputDecoration(
                        hintText: 'Marcus Vance',
                        prefixIcon: Icon(
                          Icons.badge_outlined,
                          color: AppColors.inkTertiary,
                          size: 20.0,
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Please enter your full name';
                        }
                        if (value.trim().length < 2) {
                          return 'Full name must be at least 2 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16.0),

                    // Email Field
                    Text(
                      'Email address',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            fontSize: 13.0,
                            color: AppColors.inkMuted,
                          ),
                    ),
                    const SizedBox(height: 8.0),
                    TextFormField(
                      key: const Key('register_email_input'),
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      enabled: !isLoading,
                      style: const TextStyle(color: AppColors.ink, fontSize: 14.0),
                      decoration: const InputDecoration(
                        hintText: 'operator@plant.io',
                        prefixIcon: Icon(
                          Icons.mail_outline_rounded,
                          color: AppColors.inkTertiary,
                          size: 20.0,
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Please enter your email address';
                        }
                        final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
                        if (!emailRegex.hasMatch(value.trim())) {
                          return 'Please enter a valid email address';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16.0),

                    // Password Field
                    Text(
                      'Password',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            fontSize: 13.0,
                            color: AppColors.inkMuted,
                          ),
                    ),
                    const SizedBox(height: 8.0),
                    TextFormField(
                      key: const Key('register_password_input'),
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.next,
                      enabled: !isLoading,
                      style: const TextStyle(color: AppColors.ink, fontSize: 14.0),
                      decoration: InputDecoration(
                        hintText: 'Minimum 8 characters',
                        prefixIcon: const Icon(
                          Icons.lock_outline_rounded,
                          color: AppColors.inkTertiary,
                          size: 20.0,
                        ),
                        suffixIcon: IconButton(
                          key: const Key('register_password_toggle'),
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                            color: AppColors.inkTertiary,
                            size: 20.0,
                          ),
                          onPressed: () {
                            setState(() {
                              _obscurePassword = !_obscurePassword;
                            });
                          },
                          tooltip: _obscurePassword ? 'Show password' : 'Hide password',
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please enter a password';
                        }
                        if (value.length < 8) {
                          return 'Password must be at least 8 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16.0),

                    // Confirm Password Field
                    Text(
                      'Confirm password',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            fontSize: 13.0,
                            color: AppColors.inkMuted,
                          ),
                    ),
                    const SizedBox(height: 8.0),
                    TextFormField(
                      key: const Key('register_confirm_password_input'),
                      controller: _confirmPasswordController,
                      obscureText: _obscureConfirmPassword,
                      textInputAction: TextInputAction.done,
                      enabled: !isLoading,
                      style: const TextStyle(color: AppColors.ink, fontSize: 14.0),
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        hintText: 'Re-enter your password',
                        prefixIcon: const Icon(
                          Icons.lock_reset_rounded,
                          color: AppColors.inkTertiary,
                          size: 20.0,
                        ),
                        suffixIcon: IconButton(
                          key: const Key('register_confirm_password_toggle'),
                          icon: Icon(
                            _obscureConfirmPassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                            color: AppColors.inkTertiary,
                            size: 20.0,
                          ),
                          onPressed: () {
                            setState(() {
                              _obscureConfirmPassword = !_obscureConfirmPassword;
                            });
                          },
                          tooltip: _obscureConfirmPassword ? 'Show password' : 'Hide password',
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please confirm your password';
                        }
                        if (value != _passwordController.text) {
                          return 'Passwords do not match';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 24.0),

                    // Register Button
                    ElevatedButton(
                      key: const Key('register_submit_button'),
                      onPressed: isLoading ? null : _submit,
                      child: isLoading
                          ? const SizedBox(
                              width: 20.0,
                              height: 20.0,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                                valueColor: AlwaysStoppedAnimation<Color>(AppColors.ink),
                              ),
                            )
                          : const Text('Create Account'),
                    ),
                    const SizedBox(height: 16.0),

                    // Link back to Sign In
                    Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        const Text(
                          'Already have an account?',
                          style: TextStyle(
                            color: AppColors.inkSubtle,
                            fontSize: 13.0,
                          ),
                        ),
                        TextButton(
                          key: const Key('register_back_to_login_button'),
                          onPressed: isLoading
                              ? null
                              : () {
                                  ref.read(authControllerProvider.notifier).clearError();
                                  if (context.canPop()) {
                                    context.pop();
                                  } else {
                                    context.go('/login');
                                  }
                                },
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.primaryHover,
                            padding: const EdgeInsets.symmetric(horizontal: 6.0),
                          ),
                          child: const Text(
                            'Sign in',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13.0,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16.0),

                    // Server Connectivity Strip
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                      decoration: BoxDecoration(
                        color: AppColors.surface1,
                        borderRadius: BorderRadius.circular(8.0),
                        border: Border.all(color: AppColors.hairline),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.cloud_outlined,
                            size: 15.0,
                            color: AppColors.inkSubtle,
                          ),
                          const SizedBox(width: 8.0),
                          Expanded(
                            child: Text(
                              'Target: ${Uri.tryParse(activeBaseUrl)?.host ?? activeBaseUrl}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.inkSubtle,
                                fontSize: 11.0,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          IconButton(
                            icon: _isCheckingHealth
                                ? const SizedBox(
                                    width: 14.0,
                                    height: 14.0,
                                    child: CircularProgressIndicator(strokeWidth: 1.8),
                                  )
                                : const Icon(Icons.wifi_find_rounded, size: 16.0),
                            color: AppColors.primaryHover,
                            tooltip: 'Ping server health',
                            onPressed: _isCheckingHealth ? null : _runHealthCheck,
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16.0),

                    // Plant Security Notice
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.verified_user_outlined,
                          color: AppColors.brandSecure,
                          size: 14.0,
                        ),
                        const SizedBox(width: 6.0),
                        Text(
                          'Authorized Facility Personnel Only',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppColors.inkTertiary,
                                fontSize: 11.0,
                                fontWeight: FontWeight.w500,
                              ),
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
}
