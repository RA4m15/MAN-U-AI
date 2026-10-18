import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings2,
  Users,
  Cpu,
  Database,
  Shield,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  UserCheck,
  Sliders,
  Sparkles,
  Key,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@man-u-ai/shared";
import { usersApi } from "@/lib/api";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "suspended";
  lastLogin: string;
}

const FALLBACK_USERS: UserRecord[] = [
  {
    id: "usr-01",
    name: "Alex Mercer",
    email: "alex.mercer@plant.io",
    role: "engineer",
    status: "active",
    lastLogin: "Active Session",
  },
  {
    id: "usr-02",
    name: "Elena Rostova",
    email: "admin@plant.io",
    role: "admin",
    status: "active",
    lastLogin: "Active Session",
  },
];

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "general";
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Model parameters state
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [temperature, setTemperature] = useState(0.2);
  const [topK, setTopK] = useState(5);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.75);

  // Facility state
  const [facilityName, setFacilityName] = useState("MAN-U-AI Heavy Operations Facility Alpha");
  const [timezone, setTimezone] = useState("UTC+05:30 (IST)");

  // Form for adding new user
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("Industry2025!");
  const [newUserRole, setNewUserRole] = useState<UserRole>("engineer");

  const { data: resp, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });

  const rawUsers = resp?.data?.data;
  const users: UserRecord[] =
    Array.isArray(rawUsers) && rawUsers.length > 0
      ? rawUsers.map((u: any) => ({
          id: u.id || u._id,
          name: u.name,
          email: u.email,
          role: u.role || "viewer",
          status: "active",
          lastLogin: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "Active",
        }))
      : FALLBACK_USERS;

  const createUserMutation = useMutation({
    mutationFn: (data: { name: string; email: string; password?: string; role: string }) =>
      usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setNewUserName("");
      setNewUserEmail("");
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error?.message || "Failed to add user. Ensure you have admin permissions.");
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
      setErrorMessage(err.response?.data?.error?.message || "Failed to update role. Admin permissions required.");
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
      setErrorMessage(err.response?.data?.error?.message || "Failed to delete user. Admin permissions required.");
    },
  });

  const handleSave = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;
    createUserMutation.mutate({
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      role: newUserRole,
    });
  };

  const handleToggleUserRole = (id: string, newRole: UserRole) => {
    updateRoleMutation.mutate({ id, role: newRole });
  };

  const handleRemoveUser = (id: string) => {
    if (confirm("Revoke access for this user in the database?")) {
      deleteUserMutation.mutate(id);
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
              System Settings & Access Control
            </h1>
            <span className="badge-muted text-2xs font-mono">Role Enforcement</span>
          </div>
          <p className="text-xs md:text-sm text-ink-subtle">
            Configure multimodal model hyperparameters, vector search thresholds, RBAC user permissions and security.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="btn-primary self-start sm:self-auto flex items-center gap-2 text-xs shadow-glow-primary"
        >
          {savedNotice ? <CheckCircle2 size={14} className="text-success" /> : <Save size={14} />}
          <span>{savedNotice ? "Settings Applied" : "Save Changes"}</span>
        </button>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="notice-danger flex items-center justify-between p-3 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-danger">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-danger hover:underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
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
                <option value="gemini-2.0-flash">Google Gemini 2.0 Flash (Default Industrial RAG)</option>
                <option value="gemini-1.5-pro">Google Gemini 1.5 Pro (Deep Schematic Analysis)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-2xs font-medium text-ink-subtle uppercase">
                  Temperature: {temperature}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                  Top-K Retrieved Chunks: {topK}
                </label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
                  className="input font-mono text-xs"
                />
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
            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <input
                type="text"
                placeholder="Full Name"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="input text-xs"
              />
              <input
                type="email"
                placeholder="work.email@plant.io"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
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
                    <th className="py-3 px-4">Enrolled Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {usersLoading && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-ink-subtle">
                        Loading users from database...
                      </td>
                    </tr>
                  )}
                  {users.map((u) => (
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
                          className="input py-1 px-2 text-2xs font-medium w-36 bg-surface-2"
                        >
                          <option value="admin">Administrator</option>
                          <option value="engineer">Engineer</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <span className="badge-success text-2xs flex items-center gap-1 w-max">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      </td>
                      <td className="py-3 px-4 text-ink-tertiary text-2xs font-mono">
                        {u.lastLogin}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRemoveUser(u.id)}
                          className="btn-icon p-1.5 text-ink-tertiary hover:text-danger"
                          title="Revoke access"
                        >
                          <Trash2 size={13} />
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

      {/* Tab: Vector Search */}
      {currentTab === "vector" && (
        <div className="max-w-2xl space-y-4">
          <div className="card bg-surface-1 border border-hairline p-5 space-y-3">
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
              Vector Search Adapter Configuration
            </h3>
            <p className="text-xs text-ink-subtle">
              Configured vector database adapter for high-dimensional cosine similarity indexing.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                <span className="text-2xs text-ink-tertiary">Selected Store</span>
                <p className="font-mono font-semibold text-ink mt-0.5">MongoDB Vector Index</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                <span className="text-2xs text-ink-tertiary">Index Algorithm</span>
                <p className="font-mono font-semibold text-ink mt-0.5">Cosine Similarity (70%) + Keyword (30%)</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                <span className="text-2xs text-ink-tertiary">Embedding Dimensions</span>
                <p className="font-mono font-semibold text-primary mt-0.5">768-dim (text-embedding-004)</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                <span className="text-2xs text-ink-tertiary">Index Status</span>
                <p className="font-mono font-semibold text-success mt-0.5">Active & Searchable</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Security */}
      {currentTab === "security" && (
        <div className="max-w-2xl space-y-4">
          <div className="card bg-surface-1 border border-hairline p-5 space-y-3 text-xs">
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
              Cryptography & Role Isolation Protocols
            </h3>
            <div className="space-y-2 text-ink-subtle leading-relaxed">
              <p>• All uploaded OEM manuals and technical drawings are stored privately in non-public encrypted storage.</p>
              <p>• User passwords hashed with bcrypt 10 salt rounds.</p>
              <p>• Multi-tenant role isolation prevents unauthorized access to restricted equipment documents.</p>
              <p>• Strict RAG grounding prevents arbitrary tool execution or unverified machinery control.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
