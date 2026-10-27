import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { AssistantPage } from "./pages/AssistantPage";
import { KnowledgeLibraryPage } from "./pages/KnowledgeLibraryPage";
import { ManualViewerPage } from "./pages/ManualViewerPage";
import { EquipmentPage } from "./pages/EquipmentPage";
import { SummariesPage } from "./pages/SummariesPage";
import { InsightsPage } from "./pages/InsightsPage";
import { ActivityPage } from "./pages/ActivityPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ManagerDashboardPage } from "./pages/ManagerDashboardPage";
import { EngineerMobileRequiredPage } from "./pages/EngineerMobileRequiredPage";
import type { UserRole } from "@man-u-ai/shared";

type WebPanel = "admin" | "manager";

/**
 * Compatibility mapping while the existing backend still calls the operational
 * account role "viewer". The web experience labels that role Manager / Operator.
 * Role-schema and endpoint-permission migration is deliberately separate.
 */
function getWebPanel(role: UserRole | undefined): WebPanel | null {
  if (role === "admin") return "admin";
  if (role === "viewer") return "manager";
  return null;
}

function getRoleLanding(role: UserRole | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "viewer") return "/manager";
  if (role === "engineer") return "/engineer-mobile-required";
  return "/unsupported-access";
}

function ProtectedPanelRoute({
  panel,
  children,
}: {
  panel: WebPanel;
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (getWebPanel(user.role) !== panel) {
    return <Navigate to={getRoleLanding(user.role)} replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to={getRoleLanding(user?.role)} replace />;
  return <>{children}</>;
}

function RoleHomeRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={getRoleLanding(user.role)} replace />;
}

function LegacyRouteRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

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

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      <Route
        path="/"
        element={<RoleHomeRedirect />}
      />

      <Route
        path="/admin"
        element={
          <ProtectedPanelRoute panel="admin">
            <AppShell panel="admin" />
          </ProtectedPanelRoute>
        }
      >
        <Route index element={<InsightsPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="chat/:conversationId" element={<AssistantPage />} />
        <Route path="knowledge" element={<KnowledgeLibraryPage />} />
        <Route path="knowledge/manuals/:documentId" element={<ManualViewerPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="summaries" element={<SummariesPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route
        path="/manager"
        element={
          <ProtectedPanelRoute panel="manager">
            <AppShell panel="manager" />
          </ProtectedPanelRoute>
        }
      >
        <Route index element={<ManagerDashboardPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="chat/:conversationId" element={<AssistantPage />} />
        <Route path="knowledge" element={<KnowledgeLibraryPage />} />
        <Route path="knowledge/manuals/:documentId" element={<ManualViewerPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="summaries" element={<SummariesPage />} />
        <Route path="*" element={<Navigate to="/manager" replace />} />
      </Route>

      <Route
        path="/engineer-mobile-required"
        element={
          <EngineerOnlyRoute>
            <EngineerMobileRequiredPage />
          </EngineerOnlyRoute>
        }
      />
      <Route
        path="/unsupported-access"
        element={
          <AuthenticatedOnlyRoute>
            <UnsupportedAccessPage />
          </AuthenticatedOnlyRoute>
        }
      />

      <Route path="*" element={<LegacyRouteRedirect />} />
    </Routes>
  );
}

function AuthenticatedOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function EngineerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role !== "engineer") return <Navigate to={getRoleLanding(user.role)} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
