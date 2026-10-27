import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, ShieldCheck, ArrowRight, Lock, Mail, User, AlertCircle, Wrench } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        // The API assigns the restricted viewer role. Manager, Admin, and Engineer
        // roles must be provisioned or promoted by a Plant Administrator.
        const res = await authApi.register({ name, email, password });
        if (res.data?.success && res.data.data) {
          login(res.data.data.token, res.data.data.user);
          navigate("/", { replace: true });
          return;
        }
        throw new Error(res.data?.error?.message || "Registration failed");
      }

      const res = await authApi.login(email, password);
      if (res.data?.success && res.data.data) {
        login(res.data.data.token, res.data.data.user);
        navigate("/", { replace: true });
        return;
      }
      throw new Error(res.data?.error?.message || "Authentication failed");
    } catch (err: any) {
      if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        setError(
          "Authentication request timed out after 30 seconds. The backend service may be cold starting or database connection is unreachable. Please retry in a moment."
        );
      } else {
        setError(err.message || "Authentication failed. Please verify credentials.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (demoEmail: string) => {
    setIsLoading(true);
    setError(null);
    setEmail(demoEmail);

    try {
      // Demo accounts still authenticate against the backend; no account is created here.
      const demoPassword = import.meta.env.VITE_DEMO_PASSWORD || (import.meta.env.DEV ? "Industry2025!" : "");

      if (!demoPassword) {
        setError(
          `Demo account selected (${demoEmail}). Production demo credentials are not configured. Please enter the password provisioned for this account, or provision the account using the administrative CLI utility.`
        );
        return;
      }

      const res = await authApi.login(demoEmail, demoPassword);
      if (res.data?.success && res.data.data) {
        login(res.data.data.token, res.data.data.user);
        navigate("/", { replace: true });
        return;
      }
      throw new Error(res.data?.error?.message || "Authentication failed");
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 400) {
        setError(
          `Authentication failed for ${demoEmail}. The account is either not provisioned or credentials are invalid. In production, accounts must be provisioned securely via the administrative CLI utility.`
        );
      } else if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        setError(
          "Backend authentication request timed out after 30 seconds. The API service may be cold starting. Please retry in a moment."
        );
      } else {
        setError(err.message || "Backend login failed. Ensure API server is active.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-canvas flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-surface-1 border border-hairline rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 backdrop-blur-xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-3 shadow-glow-primary">
            <Zap className="text-primary w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-primary">MAN-U-AI</h1>
          <p className="text-xs text-ink-subtle mt-1 max-w-xs">
            Industrial Multimodal AI Copilot for SOPs, Equipment Manuals & Reliability Engineering
          </p>
        </div>

        <div className="mb-6 p-3 rounded-lg bg-surface-2 border border-hairline">
          <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-ink-tertiary font-semibold mb-2">
            <Wrench size={11} className="text-primary" />
            Quick Demo Access (Backend Authenticated)
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickDemo("admin@plant.io")}
              className="px-2 py-1.5 rounded bg-surface-3 hover:bg-primary/20 hover:text-ink text-ink-subtle text-2xs font-medium border border-hairline transition-colors text-center disabled:opacity-50"
            >
              Plant Admin
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickDemo("marcus.v@plant.io")}
              className="px-2 py-1.5 rounded bg-surface-3 hover:bg-primary/20 hover:text-ink text-ink-subtle text-2xs font-medium border border-hairline transition-colors text-center disabled:opacity-50"
            >
              Manager / Operator
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
            <>
              <div className="p-2.5 rounded-lg bg-surface-2 border border-hairline text-2xs text-ink-subtle">
                <span className="font-semibold text-primary">Notice:</span> Public self-registration is restricted in production environments. Accounts must be provisioned by an administrator.
              </div>
              <div className="p-2.5 rounded-lg bg-surface-2 border border-hairline text-2xs text-ink-subtle">
                Self-registration enrolls with restricted sandbox access. Plant Manager, Engineer, and Admin roles must be provisioned or promoted by a Plant Administrator.
              </div>
              <div>
                <label className="block text-2xs font-medium text-ink-subtle mb-1 uppercase tracking-wider">
                  Full Name & Title
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe, Lab Manager"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input pl-9"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-2xs font-medium text-ink-subtle mb-1 uppercase tracking-wider">Work Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <input
                type="email"
                required
                placeholder="manager@plant-line.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-2xs font-medium text-ink-subtle mb-1 uppercase tracking-wider">Password</label>
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

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-2.5 mt-2 flex items-center justify-center gap-2 text-sm font-semibold"
          >
            {isLoading ? "Authenticating with Backend..." : isRegister ? "Create Account & Workspace" : "Sign In to Web Workspace"}
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
            <span>Role-based access with server-verified permissions</span>
          </div>
        </div>
      </div>
    </div>
  );
}
