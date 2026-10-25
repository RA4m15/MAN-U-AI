import 'user_model.dart';

sealed class AuthState {
  const AuthState();
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class Authenticated extends AuthState {
  final UserModel user;
  final String token;

  const Authenticated({required this.user, required this.token});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Authenticated &&
          runtimeType == other.runtimeType &&
          user == other.user &&
          token == other.token;

  @override
  int get hashCode => Object.hash(user, token);
}

class Unauthenticated extends AuthState {
  final String? errorMessage;
  final bool isSessionExpired;

  const Unauthenticated({this.errorMessage, this.isSessionExpired = false});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Unauthenticated &&
          runtimeType == other.runtimeType &&
          errorMessage == other.errorMessage &&
          isSessionExpired == other.isSessionExpired;

  @override
  int get hashCode => Object.hash(errorMessage, isSessionExpired);
}
