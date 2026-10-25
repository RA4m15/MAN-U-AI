import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/env_config.dart';
import '../../../core/theme/app_colors.dart';
import '../controllers/auth_controller.dart';
import '../models/auth_state.dart';

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
        // Clear password on failed attempt for security and UX
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
          content: Text(result.statusMessage),
          backgroundColor: result.isHealthy ? AppColors.surface3 : AppColors.danger,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  void _showServerConfigModal(BuildContext context) {
    final urlController = TextEditingController(text: EnvConfig.apiBaseUrl);
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface1,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16.0)),
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
                  const Text(
                    'API Server Configuration',
                    style: TextStyle(
                      color: AppColors.ink,
                      fontSize: 16.0,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: AppColors.inkSubtle),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 12.0),
              const Text(
                'Configure the backend host for physical device LAN testing or cloud staging:',
                style: TextStyle(color: AppColors.inkSubtle, fontSize: 12.0),
              ),
              const SizedBox(height: 16.0),
              TextField(
                key: const Key('server_url_input'),
                controller: urlController,
                style: const TextStyle(color: AppColors.ink, fontSize: 13.5),
                decoration: InputDecoration(
                  labelText: 'API Base URL',
                  labelStyle: const TextStyle(color: AppColors.inkSubtle),
                  hintText: 'https://man-u-ai.onrender.com/api/v1',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8.0)),
                ),
              ),
              const SizedBox(height: 12.0),
              Wrap(
                spacing: 8.0,
                runSpacing: 8.0,
                children: [
                  ActionChip(
                    label: const Text('Production Cloud', style: TextStyle(fontSize: 11.0)),
                    onPressed: () {
                      urlController.text = EnvConfig.productionApiBaseUrl;
                    },
                  ),
                  ActionChip(
                    label: const Text('Emulator (10.0.2.2)', style: TextStyle(fontSize: 11.0)),
                    onPressed: () {
                      urlController.text = EnvConfig.emulatorApiBaseUrl;
                    },
                  ),
                  ActionChip(
                    label: const Text('Localhost (4000)', style: TextStyle(fontSize: 11.0)),
                    onPressed: () {
                      urlController.text = EnvConfig.localHostApiBaseUrl;
                    },
                  ),
                ],
              ),
              const SizedBox(height: 20.0),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12.0),
                  Expanded(
                    child: ElevatedButton(
                      key: const Key('save_server_url_button'),
                      onPressed: () {
                        final newUrl = urlController.text.trim();
                        if (newUrl.isNotEmpty) {
                          ref.read(authControllerProvider.notifier).setServerUrl(newUrl);
                        }
                        Navigator.of(ctx).pop();
                        _runHealthCheck();
                      },
                      child: const Text('Apply & Test'),
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
    final isLoading = authState is AuthLoading;
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
                        width: 56.0,
                        height: 56.0,
                        decoration: BoxDecoration(
                          color: AppColors.surface2,
                          borderRadius: BorderRadius.circular(14.0),
                          border: Border.all(color: AppColors.hairlineStrong),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.25),
                              blurRadius: 20.0,
                              spreadRadius: 2.0,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.precision_manufacturing_rounded,
                          color: AppColors.primary,
                          size: 30.0,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20.0),

                    // Title & Tagline
                    Text(
                      'MAN-U-AI',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            letterSpacing: -0.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink,
                          ),
                    ),
                    const SizedBox(height: 6.0),
                    Text(
                      'Industrial Reliability AI Copilot',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.primaryHover,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.2,
                          ),
                    ),
                    const SizedBox(height: 10.0),
                    Text(
                      'Sign in to access evidence-grounded plant troubleshooting, equipment SOPs, and technical manuals.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.inkSubtle,
                            height: 1.4,
                          ),
                    ),
                    const SizedBox(height: 28.0),

                    // Error Banner with Diagnostic Action
                    if (errorMessage != null && errorMessage.isNotEmpty) ...[
                      Container(
                        key: const Key('login_error_banner'),
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
                            const SizedBox(height: 8.0),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                TextButton.icon(
                                  key: const Key('retry_test_connection_button'),
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
                      const SizedBox(height: 20.0),
                    ],

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
                      key: const Key('login_email_input'),
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
                    const SizedBox(height: 20.0),

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
                      key: const Key('login_password_input'),
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.password],
                      enabled: !isLoading,
                      style: const TextStyle(color: AppColors.ink, fontSize: 14.0),
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        hintText: 'Enter your password',
                        prefixIcon: const Icon(
                          Icons.lock_outline_rounded,
                          color: AppColors.inkTertiary,
                          size: 20.0,
                        ),
                        suffixIcon: IconButton(
                          key: const Key('login_password_toggle'),
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
                          return 'Please enter your password';
                        }
                        if (value.length < 6) {
                          return 'Password must be at least 6 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 28.0),

                    // Submit Button
                    ElevatedButton(
                      key: const Key('login_submit_button'),
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
                          : const Text('Sign in to MAN-U-AI'),
                    ),
                    const SizedBox(height: 16.0),

                    // Create Account Link
                    Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        const Text(
                          "Don't have an account?",
                          style: TextStyle(
                            color: AppColors.inkSubtle,
                            fontSize: 13.0,
                          ),
                        ),
                        TextButton(
                          key: const Key('login_create_account_button'),
                          onPressed: isLoading
                              ? null
                              : () {
                                  ref.read(authControllerProvider.notifier).clearError();
                                  context.push('/register');
                                },
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.primaryHover,
                            padding: const EdgeInsets.symmetric(horizontal: 6.0),
                          ),
                          child: const Text(
                            'Create account',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13.0,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16.0),

                    // Server Connectivity Strip (Transparent Diagnostics)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                      decoration: BoxDecoration(
                        color: AppColors.surface1,
                        borderRadius: BorderRadius.circular(8.0),
                        border: Border.all(color: AppColors.hairline),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.cloud_outlined,
                            size: 15.0,
                            color: _healthStatus != null && _healthStatus!.contains('Connected')
                                ? AppColors.success
                                : AppColors.inkSubtle,
                          ),
                          const SizedBox(width: 8.0),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'API: ${Uri.tryParse(activeBaseUrl)?.host ?? activeBaseUrl}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: AppColors.inkSubtle,
                                    fontSize: 11.0,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                if (_healthStatus != null) ...[
                                  const SizedBox(height: 2.0),
                                  Text(
                                    _healthStatus!,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: _healthStatus!.contains('Connected')
                                          ? AppColors.success
                                          : AppColors.warning,
                                      fontSize: 10.0,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          IconButton(
                            key: const Key('check_server_health_button'),
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
                          if (kDebugMode) ...[
                            IconButton(
                              key: const Key('configure_server_button'),
                              icon: const Icon(Icons.settings_outlined, size: 16.0),
                              color: AppColors.inkSubtle,
                              tooltip: 'Configure server URL',
                              onPressed: () => _showServerConfigModal(context),
                              visualDensity: VisualDensity.compact,
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 18.0),

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
