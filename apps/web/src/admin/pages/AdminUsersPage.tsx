import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Loader2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Shield,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { usersApi } from "@/lib/api";
import type { UserRole } from "@man-u-ai/shared";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orgId?: string;
  isActive?: boolean;
  createdAt?: string;
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("manager");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    data: usersResp,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });

  const users: UserRecord[] = usersResp?.data?.data || [];

  const createUserMutation = useMutation({
    mutationFn: (data: { name: string; email: string; password?: string; role: string }) =>
      usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setErrorMessage(null);
      setSuccessMessage("Personnel account provisioned successfully.");
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      setErrorMessage(
        err.response?.data?.error?.message || "Failed to provision user. Administrator permissions required."
      );
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: (data: { id: string; role: string }) => usersApi.updateRole(data.id, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setErrorMessage(null);
      setSuccessMessage("User role updated successfully.");
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any) => {
      setErrorMessage(
        err.response?.data?.error?.message || "Failed to update role. Administrator permissions required."
      );
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setErrorMessage(null);
      setSuccessMessage("User removed from facility registry.");
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any) => {
      setErrorMessage(
        err.response?.data?.error?.message || "Failed to remove user. Administrator permissions required."
      );
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) return;
    createUserMutation.mutate({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      password: newUserPassword,
      role: newUserRole,
    });
  };

  const handleRoleChange = (id: string, role: UserRole) => {
    updateRoleMutation.mutate({ id, role });
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove user "${name}"?`)) {
      deleteUserMutation.mutate(id);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-canvas p-4 md:p-8 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="text-primary w-5 h-5" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink">
              Personnel & Role Management
            </h1>
            <span className="badge-primary text-2xs">Admin Exclusive</span>
          </div>
          <p className="text-xs md:text-sm text-ink-subtle">
            Authoritative user registry. Provision new personnel, promote operators to managers, and enforce role-based access boundaries.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary p-2 self-start"
          title="Refresh User List"
        >
          <RefreshCw size={14} />
        </button>
      </header>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-danger font-bold text-xs">
            <X size={14} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-xs text-success flex items-center gap-2">
          <CheckCircle2 size={15} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Provisioning Form */}
      <div className="card bg-surface-1 border border-hairline rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="text-primary" />
          <h2 className="text-xs font-semibold text-ink uppercase tracking-wider">
            Provision New Plant Account
          </h2>
        </div>
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
            <option value="manager">Plant Manager / Operator</option>
            <option value="admin">Site Administrator</option>
            <option value="engineer">Reliability Engineer</option>
            <option value="viewer">Restricted Sandbox Viewer</option>
          </select>
          <button
            type="submit"
            disabled={createUserMutation.isPending}
            className="btn-primary text-xs flex items-center justify-center gap-1.5"
          >
            {createUserMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
            <span>Provision Account</span>
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="card bg-surface-1 border border-hairline rounded-xl overflow-hidden shadow-card">
        <div className="p-4 border-b border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink uppercase tracking-wider">
              Enrolled Personnel
            </span>
            <span className="badge-muted text-2xs">{users.length} Total</span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-8 text-xs py-1.5"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 border-b border-hairline text-2xs uppercase tracking-wider text-ink-tertiary">
              <tr>
                <th className="py-3 px-4">Personnel</th>
                <th className="py-3 px-4">Authorized Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {isLoading && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-ink-subtle">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-primary" />
                      <span>Loading authoritative personnel registry...</span>
                    </div>
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-danger">
                    <div className="flex items-center justify-center gap-2">
                      <AlertCircle size={16} />
                      <span>Failed to load users from database.</span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                filteredUsers.map((u) => (
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
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        disabled={updateRoleMutation.isPending}
                        className="input py-1 px-2 text-2xs font-medium w-40 bg-surface-2"
                      >
                        <option value="admin">Administrator</option>
                        <option value="manager">Plant Manager</option>
                        <option value="engineer">Reliability Engineer</option>
                        <option value="viewer">Restricted Viewer</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge-success text-2xs inline-flex items-center gap-1">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        disabled={deleteUserMutation.isPending}
                        className="btn-icon p-1 text-ink-tertiary hover:text-danger hover:bg-danger/10 transition-colors ml-auto"
                        title="Delete user"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}

              {!isLoading && !isError && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-ink-tertiary">
                    No users matching "{searchQuery}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
