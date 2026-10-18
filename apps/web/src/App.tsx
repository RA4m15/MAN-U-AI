import { Routes, Route, Navigate } from "react-router-dom";
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
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
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<AssistantPage />} />
        <Route path="chat/:conversationId" element={<AssistantPage />} />
        <Route path="knowledge" element={<KnowledgeLibraryPage />} />
        <Route path="knowledge/manuals/:documentId" element={<ManualViewerPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="summaries" element={<SummariesPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
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
