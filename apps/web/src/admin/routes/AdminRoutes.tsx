import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AdminShell } from "../layout/AdminShell";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { AdminLoginPage } from "../pages/AdminLoginPage";
import { AdminRegisterPage } from "../pages/AdminRegisterPage";
import { AdminAnalyticsPage } from "../pages/AdminAnalyticsPage";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import { AssistantPage } from "@/pages/AssistantPage";
import { KnowledgeLibraryPage } from "@/pages/KnowledgeLibraryPage";
import { ManualViewerPage } from "@/pages/ManualViewerPage";
import { EquipmentPage } from "@/pages/EquipmentPage";
import { SummariesPage } from "@/pages/SummariesPage";
import { ActivityPage } from "@/pages/ActivityPage";
import { IntegrationsPage } from "@/pages/IntegrationsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ManagerTasksPage } from "@/manager/pages/ManagerTasksPage";
import { SopFlowchartPage } from "@/pages/SopFlowchartPage";

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated || !user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.role !== "admin") {
    if (user.role === "manager") return <Navigate to="/manager" replace />;
    if (user.role === "engineer") return <Navigate to="/engineer-mobile-required" replace />;
    return <Navigate to="/unsupported-access" replace />;
  }

  return <>{children}</>;
}

function PublicAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated && user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}

export function AdminRoutes() {
  return (
    <Routes>
      {/* Public Admin Auth Routes */}
      <Route
        path="login"
        element={
          <PublicAdminRoute>
            <AdminLoginPage />
          </PublicAdminRoute>
        }
      />
      <Route
        path="register"
        element={
          <PublicAdminRoute>
            <AdminRegisterPage />
          </PublicAdminRoute>
        }
      />

      {/* Authenticated Admin Shell Routes */}
      <Route
        element={
          <ProtectedAdminRoute>
            <AdminShell />
          </ProtectedAdminRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="chat/:conversationId" element={<AssistantPage />} />
        <Route path="knowledge" element={<KnowledgeLibraryPage />} />
        <Route path="knowledge/manuals/:documentId" element={<ManualViewerPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="summaries" element={<SummariesPage />} />
        <Route path="flowcharts" element={<SopFlowchartPage />} />
        <Route path="tasks" element={<ManagerTasksPage />} />
        <Route path="insights" element={<AdminAnalyticsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
