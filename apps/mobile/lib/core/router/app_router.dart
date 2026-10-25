import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/controllers/auth_controller.dart';
import '../../features/auth/models/auth_state.dart';
import '../../features/auth/views/login_screen.dart';
import '../../features/auth/views/register_screen.dart';
import '../../features/chat/views/chat_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authNotifier = _AuthStateNotifier(ref);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final authState = ref.read(authControllerProvider);
      final loc = state.matchedLocation;
      final isAuthRoute = loc == '/login' || loc == '/register';

      if (authState is Authenticated) {
        // Once authenticated, redirect from auth screens to chat
        return isAuthRoute ? '/home' : null;
      }

      if (authState is Unauthenticated) {
        // If not authenticated, allow /login and /register; redirect protected screens to /login
        return isAuthRoute ? null : '/login';
      }

      // Keep current screen while initial status or loading check is occurring
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const ChatScreen(),
      ),
    ],
  );
});

/// Bridge notifier that triggers GoRouter redirects whenever AuthState changes
class _AuthStateNotifier extends ChangeNotifier {
  _AuthStateNotifier(Ref ref) {
    ref.listen<AuthState>(
      authControllerProvider,
      (_, _) => notifyListeners(),
    );
  }
}
