import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/widgets/terminal_components.dart';
import '../controllers/auth_controller.dart';
import '../models/auth_state.dart';

/// Terminal Cobalt Mobile Registration Screen
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
  bool _isSubmitting = false;

  @override
  void dispose() {
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

    setState(() => _isSubmitting = true);

    try {
      final success = await ref.read(authControllerProvider.notifier).register(
            name: _nameController.text.trim(),
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );
      if (success && mounted) {
        _nameController.clear();
        _emailController.clear();
        _passwordController.clear();
        _confirmPasswordController.clear();
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _testConnection() async {
    final health = await ref.read(authControllerProvider.notifier).checkServerHealth();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(health.statusMessage),
          backgroundColor: health.isHealthy ? AppColors.success : AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState is AuthLoading || _isSubmitting;
    final errorMessage = authState is Unauthenticated ? authState.errorMessage : null;

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: Center(
          child: ButtonIconTile(
            key: const Key('register_back_to_login_button'),
            icon: Icons.arrow_back_ios_new_rounded,
            size: 36.0,
            onPressed: () {
              ref.read(authControllerProvider.notifier).clearError();
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/login');
              }
            },
          ),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 12.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Avatar Slot
                    Center(
                      child: Container(
                        width: 56.0,
                        height: 56.0,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(16.0),
                          border: Border.all(color: AppColors.border, width: 1.0),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 8.0,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.person_add_alt_1_rounded,
                            color: AppColors.primary,
                            size: 28.0,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16.0),

                    // Headings
                    Text(
                      'Create Technician Account',
                      textAlign: TextAlign.center,
                      style: AppTypography.headlineLg.copyWith(fontSize: 22.0),
                    ),
                    const SizedBox(height: 4.0),
                    Text(
                      'MAN-U-AI Copilot Access Registration',
                      textAlign: TextAlign.center,
                      style: AppTypography.labelUppercase.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 20.0),

                    // Error Banner
                    if (errorMessage != null && errorMessage.isNotEmpty) ...[
                      Container(
                        key: const Key('register_error_banner'),
                        padding: const EdgeInsets.all(12.0),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(color: AppColors.error.withValues(alpha: 0.20)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.error_outline_rounded, size: 16.0, color: AppColors.error),
                                const SizedBox(width: 8.0),
                                Expanded(
                                  child: Text(
                                    errorMessage,
                                    style: AppTypography.caption.copyWith(color: AppColors.error),
                                  ),
                                ),
                              ],
                            ),
                            if (errorMessage.toLowerCase().contains('already registered') ||
                                errorMessage.toLowerCase().contains('sign in')) ...[
                              const SizedBox(height: 8.0),
                              TextButton(
                                key: const Key('register_error_signin_button'),
                                onPressed: () {
                                  ref.read(authControllerProvider.notifier).clearError();
                                  if (context.canPop()) {
                                    context.pop();
                                  } else {
                                    context.go('/login');
                                  }
                                },
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(50, 30),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: Text(
                                  'Sign in now',
                                  style: AppTypography.labelMd.copyWith(
                                    color: AppColors.primary,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                              ),
                            ],
                            const SizedBox(height: 8.0),
                            OutlinedButton(
                              key: const Key('register_test_connection_button'),
                              onPressed: _testConnection,
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: AppColors.border),
                                padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
                              ),
                              child: Text(
                                'TEST CONNECTION',
                                style: AppTypography.caption.copyWith(color: AppColors.onSurfaceVariant),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16.0),
                    ],

                    const SectionHeader(
                      title: 'OPERATOR IDENTITY',
                      padding: EdgeInsets.only(bottom: 12.0),
                    ),

                    // Name
                    Text('FULL NAME', style: AppTypography.labelUppercase),
                    const SizedBox(height: 6.0),
                    TextFormField(
                      key: const Key('register_name_input'),
                      controller: _nameController,
                      style: AppTypography.bodyMd,
                      enabled: !isLoading,
                      decoration: const InputDecoration(hintText: 'MARCUS VANCE'),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Please enter your full name';
                        if (val.trim().length < 2) return 'Full name must be at least 2 characters';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16.0),

                    // Email
                    Text('WORK EMAIL', style: AppTypography.labelUppercase),
                    const SizedBox(height: 6.0),
                    TextFormField(
                      key: const Key('register_email_input'),
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      style: AppTypography.bodyMd,
                      enabled: !isLoading,
                      decoration: const InputDecoration(hintText: 'OPERATOR@PLANT.IO'),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Please enter your email address';
                        final emailRegex = RegExp(r'^[^@]+@[^@]+\.[^@]+$');
                        if (!emailRegex.hasMatch(val.trim())) return 'Please enter a valid email address';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16.0),

                    // Password
                    Text('CREATE PASSWORD', style: AppTypography.labelUppercase),
                    const SizedBox(height: 6.0),
                    TextFormField(
                      key: const Key('register_password_input'),
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      style: AppTypography.bodyMd,
                      enabled: !isLoading,
                      decoration: InputDecoration(
                        hintText: '••••••••••••',
                        suffixIcon: IconButton(
                          key: const Key('register_password_toggle'),
                          icon: Icon(
                            _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            size: 18.0,
                            color: AppColors.onSurfaceVariant,
                          ),
                          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                        ),
                      ),
                      validator: (val) {
                        if (val == null || val.isEmpty) return 'Please enter a password';
                        if (val.length < 8) return 'Password must be at least 8 characters';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16.0),

                    // Confirm Password
                    Text('CONFIRM PASSWORD', style: AppTypography.labelUppercase),
                    const SizedBox(height: 6.0),
                    TextFormField(
                      key: const Key('register_confirm_password_input'),
                      controller: _confirmPasswordController,
                      obscureText: _obscureConfirmPassword,
                      style: AppTypography.bodyMd,
                      enabled: !isLoading,
                      decoration: InputDecoration(
                        hintText: '••••••••••••',
                        suffixIcon: IconButton(
                          key: const Key('register_confirm_password_toggle'),
                          icon: Icon(
                            _obscureConfirmPassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                            size: 18.0,
                            color: AppColors.onSurfaceVariant,
                          ),
                          onPressed: () =>
                              setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                        ),
                      ),
                      validator: (val) {
                        if (val == null || val.isEmpty) return 'Please confirm your password';
                        if (val != _passwordController.text) return 'Passwords do not match';
                        return null;
                      },
                    ),
                    const SizedBox(height: 24.0),

                    // Submit Button
                    MachinedPrimaryButton(
                      buttonKey: const Key('register_submit_button'),
                      label: 'SUBMIT ENROLLMENT',
                      isLoading: isLoading,
                      icon: Icons.assignment_turned_in_rounded,
                      onPressed: _submit,
                    ),
                    const SizedBox(height: 16.0),

                    // Footer
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
}
