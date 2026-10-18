import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { UserDTO } from "@man-u-ai/shared";

interface AuthState {
  user: UserDTO | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: UserDTO) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem("manuai_token");
      const userRaw = localStorage.getItem("manuai_user");
      if (token && userRaw) {
        const user: UserDTO = JSON.parse(userRaw);
        setState({ user, token, isAuthenticated: true, isLoading: false });
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const login = useCallback((token: string, user: UserDTO) => {
    localStorage.setItem("manuai_token", token);
    localStorage.setItem("manuai_user", JSON.stringify(user));
    setState({ user, token, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("manuai_token");
    localStorage.removeItem("manuai_user");
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
