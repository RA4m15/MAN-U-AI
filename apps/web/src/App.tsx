import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AdminRoutes } from "./admin/routes/AdminRoutes";
import { ManagerRoutes } from "./manager/routes/ManagerRoutes";
import { LoginPage } from "./pages/LoginPage";
import { PortalSelectionPage } from "./pages/PortalSelectionPage";
import { EngineerMobileRequiredPage } from "./pages/EngineerMobileRequiredPage";
import { getHostnameType, buildSubdomainUrl, performExternalRedirect } from "./lib/hostname";
import type { UserRole } from "@man-u-ai/shared";

export type WebPanel = "admin" | "manager";

export function getWebPanel(role: UserRole | undefined): WebPanel | null {
  if (role === "admin") return "admin";
  if (role === "manager") return "manager";
  return null;
}

export function getRoleLanding(role: UserRole | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "manager") return "/manager";
  if (role === "engineer") return "/engineer-mobile-required";
  return "/unsupported-access";
}

function LoadingIndicator() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4">
      <img src="/logo.png" alt="MAN-U-AI" className="w-12 h-12 mb-3 object-contain" />
      <div className="flex items-center gap-2 text-xs text-primary font-mono tracking-widest uppercase">
        <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Authorizing clearance...</span>
      </div>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingIndicator />;
  if (isAuthenticated) return <Navigate to={getRoleLanding(user?.role)} replace />;
  return <>{children}</>;
}

function RoleHomeRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingIndicator />;

  const hostnameType = getHostnameType();

  // Admin hostname root routing (e.g. admin.sharprad-x.tech)
  if (hostnameType === "admin") {
    if (!isAuthenticated || !user) {
      return <Navigate to="/admin/login" replace />;
    }
    if (user.role === "admin") {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to={getRoleLanding(user.role)} replace />;
  }

  // Manager hostname root routing (e.g. manager.sharprad-x.tech)
  if (hostnameType === "manager") {
    if (!isAuthenticated || !user) {
      return <Navigate to="/manager/login" replace />;
    }
    if (user.role === "manager") {
      return <Navigate to="/manager" replace />;
    }
    return <Navigate to={getRoleLanding(user.role)} replace />;
  }

  // Root / Main hostname routing (e.g. sharprad-x.tech or localhost)
  if (!isAuthenticated || !user) {
    return <PortalSelectionPage />;
  }
  return <Navigate to={getRoleLanding(user.role)} replace />;
}

function CrossSubdomainRedirect({ target }: { target: "admin" | "manager" }) {
  const location = useLocation();

  useEffect(() => {
    const targetUrl = buildSubdomainUrl(
      target,
      location.pathname,
      location.search,
      location.hash
    );
    performExternalRedirect(targetUrl);
  }, [target, location.pathname, location.search, location.hash]);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="text-sm text-ink-subtle flex items-center gap-2">
        <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>
          Redirecting to {target === "admin" ? "Plant Administration Console" : "Plant Operations Workspace"}...
        </span>
      </div>
    </div>
  );
}

function HostnameLoginRoute({ children }: { children: React.ReactNode }) {
  const hostnameType = getHostnameType();
  if (hostnameType === "admin") {
    return <Navigate to="/admin/login" replace />;
  }
  if (hostnameType === "manager") {
    return <Navigate to="/manager/login" replace />;
  }
  return <>{children}</>;
}

function LegacyRouteRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingIndicator />;
  const hostnameType = getHostnameType();

  if (!isAuthenticated || !user) {
    if (hostnameType === "admin") return <Navigate to="/admin/login" replace />;
    if (hostnameType === "manager") return <Navigate to="/manager/login" replace />;
    return <Navigate to="/login" replace />;
  }

  const panel = getWebPanel(user.role);
  if (!panel) return <Navigate to={getRoleLanding(user.role)} replace />;

  // Preserve older bookmarks such as /knowledge and /equipment by moving them
  // under the authenticated user's panel prefix.
  return (
    <Navigate
      to={`/${panel}${location.pathname === "/" ? "" : location.pathname}${location.search}${location.hash}`}
      replace
    />
  );
}

function UnsupportedAccessPage() {
  const { logout } = useAuth();

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <section className="max-w-lg rounded-2xl border border-hairline bg-surface-1 p-7">
        <h1 className="text-xl font-bold text-ink">Workspace access unavailable</h1>
        <p className="text-sm text-ink-subtle mt-2">
          This account does not have a supported web-panel role. Contact your administrator if you believe this is incorrect.
        </p>
        <button onClick={logout} className="btn-secondary mt-5">Sign out</button>
      </section>
    </main>
  );
}

function AuthenticatedOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingIndicator />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function EngineerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingIndicator />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role !== "engineer") return <Navigate to={getRoleLanding(user.role)} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const hostnameType = getHostnameType();

  return (
    <Routes>
      {/* Root Role-Based Home Redirect & Portal Selection */}
      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="/portal" element={<RoleHomeRedirect />} />

      {/* Global / Legacy Login */}
      <Route
        path="/login"
        element={
          <HostnameLoginRoute>
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          </HostnameLoginRoute>
        }
      />

      {/* Admin Panel Independent Route Tree */}
      <Route
        path="/admin/*"
        element={
          hostnameType === "manager" ? (
            <CrossSubdomainRedirect target="admin" />
          ) : (
            <AdminRoutes />
          )
        }
      />

      {/* Manager Panel Independent Route Tree */}
      <Route
        path="/manager/*"
        element={
          hostnameType === "admin" ? (
            <CrossSubdomainRedirect target="manager" />
          ) : (
            <ManagerRoutes />
          )
        }
      />

      {/* Dedicated Engineer Mobile Application Notice */}
      <Route
        path="/engineer-mobile-required"
        element={
          <EngineerOnlyRoute>
            <EngineerMobileRequiredPage />
          </EngineerOnlyRoute>
        }
      />

      {/* Restricted Sandbox / Viewer Unsupported Access Notice */}
      <Route
        path="/unsupported-access"
        element={
          <AuthenticatedOnlyRoute>
            <UnsupportedAccessPage />
          </AuthenticatedOnlyRoute>
        }
      />

      {/* Legacy Fallback Redirect */}
      <Route path="*" element={<LegacyRouteRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
