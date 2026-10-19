import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings2,
  Users,
  Database,
  Shield,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  AlertCircle,
  Lock,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@man-u-ai/shared";
import { usersApi, settingsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "suspended" | "Status unavailable" | string;
  lastLogin: string;
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "general";
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Persistent settings state
  const [selectedModel, setSelectedModel] = useState("gemini-3.8-flash");
  const [temperature, setTemperature] = useState(0.2);
  const [topK, setTopK] = useState(5);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.5);
  const [facilityName, setFacilityName] = useState("MAN-U-AI Heavy Operations Facility Alpha");
  const [timezone, setTimezone] = useState("UTC+05:30 (IST)");
  const [supportedModels, setSupportedModels] = useState<string[]>([
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3-flash-preview",
    "gemini-4-argon",
  ]);

  // Load persistent settings from backend
  const {
    data: settingsResp,
    isLoading: settingsLoading,
    isError: settingsError,
    error: settingsErrorObj,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  useEffect(() => {
    if (settingsResp?.data?.data) {
      const s = settingsResp.data.data;
      if (s.facilityName) setFacilityName(s.facilityName);
      if (s.timezone) setTimezone(s.timezone);
      if (s.selectedModel) setSelectedModel(s.selectedModel);
      if (typeof s.temperature === "number") setTemperature(s.temperature);
      if (typeof s.topK === "number") setTopK(s.topK);
      if (typeof s.similarityThreshold === "number") setSimilarityThreshold(s.similarityThreshold);
      if (Array.isArray(s.supportedModels) && s.supportedModels.length > 0) {
        setSupportedModels(s.supportedModels);
      }
    }
  }, [settingsResp]);

  const saveSettingsMutation = useMutation({
    mutationFn: (data: {
      facilityName: string;
      timezone: string;
      selectedModel: string;
      temperature: number;
      topK: number;
      similarityThreshold: number;
    }) => settingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSavedNotice(true);
      setErrorMessage(null);
      setTimeout(() => setSavedNotice(false), 3000);
    },
    onError: (err: any) => {
      setErrorMessage(
        err.response?.data?.error?.message || "Failed to persist settings to database. Administrator permissions required."
      );
      setSavedNotice(false);
    },
  });

  // Form for adding new user (NEVER prefill password)
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("engineer");

  const {
    data: resp,
    isLoading: usersLoading,
    isError: usersError,
    error: usersErrorObj,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });

  const isForbidden = (usersErrorObj as any)?.response?.status === 403;
  const isDisconnected = (usersErrorObj as any)?.response?.status === 503;

  const rawUsers = resp?.data?.data;
  const users: UserRecord[] = Array.isArray(rawUsers)
    ? rawUsers.map((u: any) => ({
        id: String(u.id || u._id),
        name: u.name || "Not provided",
        email: u.email || "Not provided",
        role: (u.role as UserRole) || "viewer",
        status: u.status || "Status unavailable",
        lastLogin: u.lastLogin
          ? new Date(u.lastLogin).toLocaleDateString()
          : u.createdAt
          ? new Date(u.createdAt).toLocaleDateString()
          : "Not recorded",
      }))
    : [];

  const createUserMutation = useMutation({
    mutationFn: (data: { name: string; email: string; password?: string; role: string }) =>
      usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(
        err.response?.data?.error?.message || "Failed to add user. Ensure you have administrator permissions."
      );
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: (data: { id: string; role: string }) => usersApi.updateRole(data.id, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(
        err.response?.data?.error?.message || "Failed to update role. Admin permissions required."
      );
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(
        err.response?.data?.error?.message || "Failed to delete user. Admin permissions required."
      );
    },
  });

  const handleSave = () => {
    if (!isAdmin) {
      setErrorMessage("Unauthorized: Site Administrator privileges required to change facility settings.");
      return;
    }
    setErrorMessage(null);
    saveSettingsMutation.mutate({
      facilityName,
      timezone,
      selectedModel,
      temperature,
      topK,
      similarityThreshold,
    });
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword) {
      setErrorMessage("Please supply name, email, and a secure password.");
      return;
    }
    if (newUserPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    setErrorMessage(null);
    createUserMutation.mutate({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      password: newUserPassword,
      role: newUserRole,
    });
  };

  const handleToggleUserRole = (userId: string, newRole: UserRole) => {
    updateRoleMutation.mutate({ id: userId, role: newRole });
  };

  const handleRemoveUser = (userId: string) => {
    if (window.confirm("Are you sure you want to revoke access and delete this user?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-canvas overflow-y-auto p-4 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className="text-primary w-5 h-5" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink">
              System Settings & Configuration
            </h1>
            <span className="badge-muted text-2xs font-mono">Platform Preferences</span>
          </div>
          <p className="text-xs md:text-sm text-ink-subtle">
            Manage operational facility parameters, vector retrieval thresholds, access permissions, and enrolled users.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isAdmin && (
            <span className="text-2xs text-ink-tertiary hidden sm:inline flex items-center gap-1">
              <Lock size={12} /> Read-only (Admin required to edit)
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saveSettingsMutation.isPending || settingsLoading}
            className={cn(
              "btn-primary self-start sm:self-auto flex items-center gap-2 text-xs",
              !isAdmin && "opacity-60 cursor-not-allowed"
            )}
            title={!isAdmin ? "Administrator role required to modify preferences" : "Persist settings to database"}
          >
            {saveSettingsMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : savedNotice ? (
              <CheckCircle2 size={14} className="text-success" />
            ) : (
              <Save size={14} />
            )}
            <span>
              {saveSettingsMutation.isPending
                ? "Saving..."
                : savedNotice
                ? "Preferences Persisted"
                : "Save Preferences"}
            </span>
          </button>
        </div>
      </div>

      {/* Settings Loading / Error Notices */}
      {settingsLoading && (
        <div className="p-3 rounded-lg bg-surface-2 border border-hairline text-xs text-ink-subtle flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-primary" />
          <span>Loading persistent application settings from database...</span>
        </div>
      )}

      {settingsError && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>Failed to load persistent settings from database.</span>
          </div>
          <button onClick={() => refetchSettings()} className="btn-secondary text-2xs py-1 px-2 flex items-center gap-1">
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      )}

      {/* Global Error Notice */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="btn-icon p-1 text-danger hover:bg-danger/20">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-hairline overflow-x-auto pb-px">
        {[
          { key: "general", label: "General & Facility", icon: <Settings2 size={13} /> },
          { key: "ai", label: "AI & Multimodal RAG", icon: <Sparkles size={13} /> },
          { key: "access", label: "Access Control & Roles", icon: <Users size={13} /> },
          { key: "vector", label: "Vector Search Store", icon: <Database size={13} /> },
          { key: "security", label: "Security & Encryption", icon: <Shield size={13} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSearchParams({ tab: tab.key })}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap",
              currentTab === tab.key
                ? "border-primary text-ink"
                : "border-transparent text-ink-tertiary hover:text-ink-subtle"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: General */}
      {currentTab === "general" && (
        <div className="max-w-2xl space-y-5">
          <div className="card bg-surface-1 border border-hairline p-5 space-y-4">
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
              Facility Configuration
            </h3>

            <div>
              <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                Facility / Plant Identifier
              </label>
              <input
                type="text"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                className="input"
              />
              <p className="text-2xs text-ink-tertiary mt-1">
                Stored plant configuration preference (currently has no runtime scheduling consumer).
              </p>
            </div>

            <div>
              <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                Plant Timezone
              </label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="input text-xs"
              />
              <p className="text-2xs text-ink-tertiary mt-1">
                Must be a valid IANA time zone identifier (e.g. 'UTC', 'Asia/Kolkata', 'America/New_York'). Stored as facility configuration.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: AI & Multimodal RAG */}
      {currentTab === "ai" && (
        <div className="max-w-2xl space-y-5">
          <div className="card bg-surface-1 border border-hairline p-5 space-y-4">
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
              Multimodal Reasoning Engine
            </h3>

            <div>
              <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                Primary Foundation Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="input text-xs"
              >
                {supportedModels.map((m) => (
                  <option key={m} value={m}>
                    {m === "gemini-3.8-flash"
                      ? "Google Gemini 3.8 Flash (High-Throughput Industrial Workhorse)"
                      : m === "gemini-3.6-flash"
                      ? "Google Gemini 3.6 Flash (Low-Latency Technical Reasoner)"
                      : m === "gemini-3-flash-preview"
                      ? "Google Gemini 3 Flash Preview (Adaptive Technical Reasoner)"
                      : m === "gemini-4-argon"
                      ? "Google Gemini 4 Argon (Advanced Agentic & Schematic Reasoning)"
                      : m}
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const modelCapabilities = settingsResp?.data?.data?.modelCapabilities || {};
              const currentModelCaps = modelCapabilities[selectedModel] || {
                supportsTemperature: false,
                supportsTopP: false,
                supportsGenerationTopK: false,
              };

              return !currentModelCaps.supportsTemperature ? (
                <div className="p-3 rounded-lg bg-surface-2 border border-hairline text-2xs text-ink-subtle space-y-1">
                  <span className="font-semibold text-ink">Deterministic Reasoning Enforced:</span>
                  <p>
                    {selectedModel} operates with deterministic reasoning parameters. Sampling controls (temperature, top-p, generation top-k) are not supported by the model API and are omitted to guarantee strict factual accuracy.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-2xs font-medium text-ink-subtle uppercase">
                      Generation Temperature: {temperature}
                    </label>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.8"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <p className="text-2xs text-ink-tertiary mt-1">
                    Keep low (0.1 - 0.25) to guarantee strict adherence to technical equipment specifications.
                  </p>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                  RAG Retrieval Top-K (Document Chunks): {topK}
                </label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
                  className="input font-mono text-xs"
                />
                <p className="text-2xs text-ink-tertiary mt-1">
                  Max chunks retrieved from vector store (isolated from model generation configuration).
                </p>
              </div>

              <div>
                <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                  Min Similarity Cutoff: {similarityThreshold}
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="0.99"
                  value={similarityThreshold}
                  onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value) || 0.75)}
                  className="input font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Access Control & Roles */}
      {currentTab === "access" && (
        <div className="space-y-6">
          {/* Add User Bar */}
          <div className="card bg-surface-1 border border-hairline p-4">
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wider mb-3">
              Enroll New Operator / Engineer
            </h3>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
              <input
                type="text"
                placeholder="Full Name *"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="input text-xs"
              />
              <input
                type="email"
                placeholder="work.email@plant.io *"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="input text-xs"
              />
              <input
                type="password"
                placeholder="Password (min 8 chars) *"
                required
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="input text-xs"
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                className="input text-xs"
              >
                <option value="engineer">Reliability Engineer</option>
                <option value="admin">Site Administrator</option>
                <option value="viewer">Shopfloor Operator</option>
              </select>
              <button
                type="submit"
                disabled={createUserMutation.isPending}
                className="btn-primary text-xs flex items-center justify-center gap-1.5"
              >
                {createUserMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
                Add to Database
              </button>
            </form>
          </div>

          {/* Users Table */}
          <div className="card bg-surface-1 border border-hairline rounded-xl overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 border-b border-hairline text-2xs uppercase tracking-wider text-ink-tertiary">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Enforced Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Enrolled / Last Active</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {usersLoading && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-subtle">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin text-primary" />
                          <span>Loading users from database...</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {usersError && isForbidden && (
                    <tr>
                      <td colSpan={5} className="py-8 px-4 text-center">
                        <div className="max-w-md mx-auto space-y-2">
                          <div className="inline-flex p-2.5 rounded-full bg-warning/10 text-warning mb-1">
                            <Lock size={20} />
                          </div>
                          <p className="text-xs font-semibold text-ink">Access Restricted</p>
                          <p className="text-2xs text-ink-subtle">
                            Administrator privileges are required to view and manage personnel records. Your current account does not have admin access to the user registry.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {usersError && !isForbidden && (
                    <tr>
                      <td colSpan={5} className="py-8 px-4 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="inline-flex p-2.5 rounded-full bg-danger/10 text-danger">
                            <AlertCircle size={20} />
                          </div>
                          <p className="text-xs font-semibold text-ink">
                            {isDisconnected
                              ? "Database connection unavailable for user registry."
                              : "Failed to retrieve users from database."}
                          </p>
                          <button
                            onClick={() => refetchUsers()}
                            className="btn-secondary text-2xs flex items-center gap-1.5 mx-auto"
                          >
                            <RefreshCw size={12} />
                            Retry Query
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!usersLoading && !usersError && users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-subtle">
                        No enrolled personnel found in database.
                      </td>
                    </tr>
                  )}

                  {!usersLoading &&
                    !usersError &&
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-surface-2/60 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-semibold text-ink">{u.name}</p>
                            <p className="text-2xs text-ink-tertiary">{u.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleToggleUserRole(u.id, e.target.value as UserRole)}
                            disabled={updateRoleMutation.isPending}
                            className="input py-1 px-2 text-2xs font-medium w-36 bg-surface-2"
                          >
                            <option value="admin">Administrator</option>
                            <option value="engineer">Engineer</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          {u.status === "active" ? (
                            <span className="badge-success text-2xs flex items-center gap-1 w-max">
                              <CheckCircle2 size={10} /> Active
                            </span>
                          ) : u.status === "suspended" ? (
                            <span className="badge-warning text-2xs flex items-center gap-1 w-max">
                              Suspended
                            </span>
                          ) : (
                            <span className="badge-muted text-2xs flex items-center gap-1 w-max">
                              {u.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-ink-tertiary text-2xs font-mono">
                          {u.lastLogin}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleRemoveUser(u.id)}
                            disabled={deleteUserMutation.isPending}
                            className="btn-icon p-1.5 text-ink-tertiary hover:text-danger"
                            title="Revoke access"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Vector Search Store */}
      {currentTab === "vector" && (
        <div className="max-w-2xl space-y-4">
          <div className="card bg-surface-1 border border-hairline p-5 space-y-3">
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
              Vector Storage Engine
            </h3>
            <p className="text-xs text-ink-subtle leading-relaxed">
              Vector indexing runs on MongoDB Atlas Vector Search utilizing cosine distance on 768-dimensional embeddings generated by Google Gemini embedding-001.
            </p>
            <div className="p-3 rounded-lg bg-surface-2 border border-hairline text-2xs space-y-1">
              <div className="flex justify-between">
                <span className="text-ink-tertiary">Embedding Model:</span>
                <span className="font-mono text-ink">gemini-embedding-001</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-tertiary">Vector Dimensions:</span>
                <span className="font-mono text-ink">768</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-tertiary">Similarity Metric:</span>
                <span className="font-mono text-ink">Cosine (Dot Product)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Security & Encryption */}
      {currentTab === "security" && (
        <div className="max-w-2xl space-y-4">
          <div className="card bg-surface-1 border border-hairline p-5 space-y-3">
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
              Security Architecture
            </h3>
            <div className="p-3 rounded-lg bg-surface-2 border border-hairline text-xs space-y-2">
              <div className="flex items-center gap-2 text-success font-medium">
                <Shield size={14} />
                <span>JWT Role-Based Access Control (RBAC) Active</span>
              </div>
              <p className="text-2xs text-ink-subtle leading-relaxed">
                Tokens are signed with HMAC SHA-256 and verified per-request. Passwords are encrypted with bcrypt (cost factor 10). Technical manuals and documents are restricted to authenticated plant operators and engineers.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
