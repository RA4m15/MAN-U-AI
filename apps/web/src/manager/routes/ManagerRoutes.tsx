import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ManagerShell } from "../layout/ManagerShell";
import { ManagerDashboardPage } from "../pages/ManagerDashboardPage";
import { ManagerLoginPage } from "../pages/ManagerLoginPage";
import { ManagerRegisterPage } from "../pages/ManagerRegisterPage";
import { ManagerOperationsPage } from "../pages/ManagerOperationsPage";
import { ManagerMaintenancePage } from "../pages/ManagerMaintenancePage";
import { ManagerTasksPage } from "../pages/ManagerTasksPage";
import { AssistantPage } from "@/pages/AssistantPage";
import { KnowledgeLibraryPage } from "@/pages/KnowledgeLibraryPage";
import { ManualViewerPage } from "@/pages/ManualViewerPage";
import { EquipmentPage } from "@/pages/EquipmentPage";
import { SummariesPage } from "@/pages/SummariesPage";
import { SopFlowchartPage } from "@/pages/SopFlowchartPage";

function ProtectedManagerRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated || !user) {
    return <Navigate to="/manager/login" replace />;
  }

  if (user.role !== "manager") {
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (user.role === "engineer") return <Navigate to="/engineer-mobile-required" replace />;
    return <Navigate to="/unsupported-access" replace />;
  }

  return <>{children}</>;
}

function PublicManagerRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated && user?.role === "manager") {
    return <Navigate to="/manager" replace />;
  }
  return <>{children}</>;
}

export function ManagerRoutes() {
  return (
    <Routes>
      {/* Public Manager Auth Routes */}
      <Route
        path="login"
        element={
          <PublicManagerRoute>
            <ManagerLoginPage />
          </PublicManagerRoute>
        }
      />
      <Route
        path="register"
        element={
          <PublicManagerRoute>
            <ManagerRegisterPage />
          </PublicManagerRoute>
        }
      />

      {/* Authenticated Manager Shell Routes */}
      <Route
        element={
          <ProtectedManagerRoute>
            <ManagerShell />
          </ProtectedManagerRoute>
        }
      >
        <Route index element={<ManagerDashboardPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="chat/:conversationId" element={<AssistantPage />} />
        <Route path="knowledge" element={<KnowledgeLibraryPage />} />
        <Route path="knowledge/manuals/:documentId" element={<ManualViewerPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="summaries" element={<SummariesPage />} />
        <Route path="flowcharts" element={<SopFlowchartPage />} />
        <Route path="operations" element={<ManagerOperationsPage />} />
        <Route path="maintenance" element={<ManagerMaintenancePage />} />
        <Route path="tasks" element={<ManagerTasksPage />} />
        <Route path="*" element={<Navigate to="/manager" replace />} />
      </Route>
    </Routes>
  );
}
