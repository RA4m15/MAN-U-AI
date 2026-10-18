import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, ShieldCheck, ArrowRight, Lock, Mail, User, AlertCircle, Wrench, Shield, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import type { UserRole } from "@man-u-ai/shared";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("engineer");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        const res = await authApi.register({ name, email, password, role });
        if (res.data?.success && res.data.data) {
          login(res.data.data.token, res.data.data.user);
          navigate("/");
          return;
        } else {
          throw new Error(res.data?.error?.message || "Registration failed");
        }
      } else {
        const res = await authApi.login(email, password);
        if (res.data?.success && res.data.data) {
          login(res.data.data.token, res.data.data.user);
          navigate("/");
          return;
        } else {
          throw new Error(res.data?.error?.message || "Authentication failed");
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || "Authentication failed. Please verify credentials.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (demoRole: UserRole, demoName: string, demoEmail: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Attempt genuine login with seeded demo password
      try {
        const res = await authApi.login(demoEmail, "Industry2025!");
        if (res.data?.success && res.data.data) {
          login(res.data.data.token, res.data.data.user);
          navigate("/");
          return;
        }
      } catch (loginErr: any) {
        // If not yet registered, register real user on backend
        if (loginErr.response?.status === 401 || loginErr.response?.status === 404) {
          const regRes = await authApi.register({
            name: demoName,
            email: demoEmail,
            password: "Industry2025!",
            role: demoRole,
          });
          if (regRes.data?.success && regRes.data.data) {
            login(regRes.data.data.token, regRes.data.data.user);
            navigate("/");
            return;
          }
        }
        throw loginErr;
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || "Backend login failed. Ensure API server is active.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-canvas flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-surface-1 border border-hairline rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 backdrop-blur-xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-3 shadow-glow-primary">
            <Zap className="text-primary w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-primary">
            MAN-U-AI
          </h1>
          <p className="text-xs text-ink-subtle mt-1 max-w-xs">
            Industrial Multimodal AI Copilot for SOPs, Equipment Manuals & Reliability Engineering
          </p>
        </div>

        {/* Demo Fast Access Pill */}
        <div className="mb-6 p-3 rounded-lg bg-surface-2 border border-hairline">
          <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-ink-tertiary font-semibold mb-2">
            <Wrench size={11} className="text-primary" />
            Quick Demo Access (Backend Authenticated)
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickDemo("engineer", "Alex Mercer", "alex.mercer@plant.io")}
              className="px-2 py-1.5 rounded bg-surface-3 hover:bg-primary/20 hover:text-ink text-ink-subtle text-2xs font-medium border border-hairline transition-colors text-center disabled:opacity-50"
            >
              Lead Eng
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickDemo("admin", "Elena Rostova", "admin@plant.io")}
              className="px-2 py-1.5 rounded bg-surface-3 hover:bg-primary/20 hover:text-ink text-ink-subtle text-2xs font-medium border border-hairline transition-colors text-center disabled:opacity-50"
            >
              Plant Admin
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickDemo("viewer", "Marcus Vance", "marcus.v@plant.io")}
              className="px-2 py-1.5 rounded bg-surface-3 hover:bg-primary/20 hover:text-ink text-ink-subtle text-2xs font-medium border border-hairline transition-colors text-center disabled:opacity-50"
            >
              Field Tech
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 flex items-center gap-2 text-xs text-danger">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-2xs font-medium text-ink-subtle mb-1 uppercase tracking-wider">
                Full Name & Title
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe, Lead Reliability"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input pl-9"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-2xs font-medium text-ink-subtle mb-1 uppercase tracking-wider">
              Work Email
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <input
                type="email"
                required
                placeholder="engineer@plant-line.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-2xs font-medium text-ink-subtle mb-1 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-9"
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-2xs font-medium text-ink-subtle mb-1 uppercase tracking-wider">
                Access Level
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="input"
              >
                <option value="engineer">Reliability & Maintenance Engineer</option>
                <option value="admin">Industrial Site Administrator</option>
                <option value="viewer">Shopfloor Operator / Viewer</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-2.5 mt-2 flex items-center justify-center gap-2 text-sm font-semibold"
          >
            {isLoading ? "Authenticating with Backend..." : isRegister ? "Create Account & Workspace" : "Sign In to Industrial Workspace"}
            <ArrowRight size={14} />
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-hairline flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-ink-subtle hover:text-primary transition-colors font-medium"
          >
            {isRegister ? "Already have workspace credentials? Sign in" : "Need plant-level access? Request enrollment"}
          </button>

          <div className="flex items-center gap-2 text-2xs text-ink-tertiary">
            <ShieldCheck size={12} className="text-success" />
            <span>Encrypted with SHA-256 JWT & SOC2 Role Isolation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
