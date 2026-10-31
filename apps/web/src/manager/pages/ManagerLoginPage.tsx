import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight, Eye, EyeOff, Building2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { SubdomainLink } from "@/components/SubdomainLink";
import { IndustrialCompressorSchematic } from "@/components/IndustrialCompressorSchematic";

export function ManagerLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await authApi.login(email, password);
      if (res.data?.success && res.data.data) {
        const { token, user } = res.data.data;
        login(token, user);

        if (user.role === "manager") {
          navigate("/manager", { replace: true });
          return;
        }

        if (user.role === "admin") {
          navigate("/admin", { replace: true });
          return;
        }

        if (user.role === "engineer") {
          navigate("/engineer-mobile-required", { replace: true });
          return;
        }

        setError("Access restricted. This account does not have a supported web-panel role.");
        navigate("/unsupported-access", { replace: true });
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

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen w-full bg-[#070B14] text-white flex flex-col justify-between selection:bg-[#0057FF] selection:text-white relative overflow-x-hidden lg:overflow-hidden font-sans">
      {/* Subtle background tech ambient lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10192e10_1px,transparent_1px),linear-gradient(to_bottom,#10192e10_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Main Split Grid — Single Frame */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-0 relative z-10 h-full">
        
        {/* ── LEFT HERO & INDUSTRIAL SCHEMATIC PANEL (7 COLS) ── */}
        <section className="lg:col-span-7 flex flex-col justify-between p-4 sm:p-6 lg:p-6 xl:p-8 border-b lg:border-b-0 lg:border-r border-[#1E293B]/60 min-h-0 h-full overflow-hidden">
          {/* Top Brand Bar */}
          <div className="flex items-center justify-between mb-2 sm:mb-4 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-8 sm:size-9 bg-[#0057FF] rounded-lg flex items-center justify-center font-bold text-white text-base sm:text-lg shadow-[0_0_15px_rgba(0,87,255,0.4)]">
                F
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base sm:text-lg tracking-tight text-white leading-none font-display">
                  MAN-U-AI
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono text-emerald-400 tracking-[0.2em] uppercase mt-0.5">
                  OPERATIONS WORKSPACE
                </span>
              </div>
            </div>

            <div className="text-[10px] sm:text-xs font-mono text-slate-500 tracking-[0.2em] uppercase hidden sm:block">
              BUILT FOR THE FLOOR.
            </div>
          </div>

          {/* Center Content & Blueprint — strictly fits frame */}
          <div className="my-auto flex flex-col justify-center min-h-0 flex-1 py-1">
            {/* Kicker */}
            <div className="text-[10px] sm:text-xs font-mono text-[#0057FF] font-bold tracking-[0.22em] uppercase mb-1">
              OPERATIONAL INTELLIGENCE
            </div>

            {/* Headline */}
            <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-display font-bold text-white tracking-tight leading-[1.14] mb-1 sm:mb-2">
              Plant Operations Workspace
            </h1>

            {/* Subtitle */}
            <p className="text-slate-400 text-xs sm:text-sm leading-snug max-w-lg mb-2 sm:mb-3 hidden sm:block">
              Operational management, equipment maintenance, technical manuals, and AI troubleshooting.
            </p>

            {/* Industrial Schematic Diagram */}
            <div className="w-full max-w-lg xl:max-w-xl mx-auto flex flex-col items-center justify-center min-h-0 flex-shrink">
              <IndustrialCompressorSchematic className="max-h-[170px] sm:max-h-[200px] lg:max-h-[220px] xl:max-h-[270px] w-full" />

              {/* Sub-schematic metadata row */}
              <div className="flex items-center justify-between mt-1.5 text-[10px] sm:text-xs font-mono w-full">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-[#0057FF]" />
                  <span className="text-[#38BDF8] font-bold uppercase tracking-wider text-[10px] sm:text-[11px]">
                    PRECISION IN MOTION
                  </span>
                </div>
                <span className="text-slate-500 uppercase tracking-widest text-[9px] sm:text-[10px]">
                  STYLIZED ASSEMBLY / NOT A LIVE MACHINE
                </span>
              </div>
            </div>
          </div>

          {/* Left Bottom Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1E293B]/40 text-[10px] sm:text-xs font-mono text-slate-500 flex-shrink-0 mt-1">
            <span>For people who keep industry moving.</span>
            <span className="tracking-widest uppercase">OPERATIONS / V1.0</span>
          </div>
        </section>

        {/* ── RIGHT SIGN IN PANEL (5 COLS) ── */}
        <section className="lg:col-span-5 flex flex-col justify-between p-4 sm:p-6 lg:p-6 xl:p-8 bg-[#080D1A]/60 backdrop-blur-sm min-h-0 h-full overflow-y-auto lg:overflow-hidden">
          {/* Top Security Status */}
          <div className="flex items-center justify-end gap-2 text-[11px] sm:text-xs font-mono text-emerald-400 flex-shrink-0">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="tracking-wider">Manager Role Access</span>
          </div>

          {/* Form Container */}
          <div className="my-auto py-1 sm:py-2 max-w-md w-full mx-auto flex flex-col justify-center flex-1 min-h-0">
            {/* Form Kicker */}
            <div className="text-[10px] sm:text-xs font-mono text-emerald-400 font-bold tracking-[0.22em] uppercase mb-0.5">
              OPERATIONS MANAGEMENT
            </div>

            {/* Form Heading */}
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight mb-0.5">
              Sign in to Operations.
            </h2>
            <p className="text-slate-400 text-xs mb-2 sm:mb-3">
              Floor management and equipment telemetry intelligence.
            </p>

            {/* Error Banner */}
            {error && (
              <div className="mb-3 p-2.5 rounded-lg bg-[#FF3B30]/10 border border-[#FF3B30]/30 flex items-start gap-2 text-xs text-[#FF3B30]">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
              {/* Work Email Field */}
              <div>
                <label className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-1 uppercase tracking-wider font-mono">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="alex.morgan@riverside.example"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0E1526] border border-[#1E293B] rounded-lg px-3 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0057FF] focus:ring-1 focus:ring-[#0057FF] transition-all font-sans"
                />
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-1 uppercase tracking-wider font-mono">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0E1526] border border-[#1E293B] rounded-lg pl-3 pr-10 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0057FF] focus:ring-1 focus:ring-[#0057FF] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Remember this device & Forgot password */}
              <div className="flex items-center justify-between text-[11px] sm:text-xs pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-400 hover:text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="size-3.5 rounded border-[#1E293B] bg-[#0E1526] text-[#0057FF] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#0057FF]"
                  />
                  <span>Remember this device</span>
                </label>

                <a
                  href="#forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    setError("Password reset is managed by your plant administrator. Please contact your IT supervisor.");
                  }}
                  className="text-[#38BDF8] hover:text-[#60A5FA] transition-colors font-medium"
                >
                  Forgot password?
                </a>
              </div>

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={isLoading}
                aria-label="Sign In to Operations Workspace"
                className="w-full h-10 sm:h-11 px-5 bg-[#0057FF] hover:bg-[#1A6BFF] active:scale-[0.99] text-white font-bold text-xs sm:text-sm uppercase tracking-wider border-2 border-[#0057FF]/60 rounded-lg shadow-[0_0_20px_rgba(0,87,255,0.35)] hover:shadow-[0_0_30px_rgba(0,87,255,0.55)] transition-all flex items-center justify-center gap-2 mt-1 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Authenticating..." : "Sign In to Operations Workspace"}
                {!isLoading && <ArrowRight size={15} className="text-white" />}
              </button>
            </form>

            {/* Divider: OR USE COMPANY ACCESS */}
            <div className="relative my-2.5 sm:my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#1E293B]" />
              </div>
              <div className="relative flex justify-center text-center">
                <span className="px-2.5 bg-[#080D1A] text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                  OR USE COMPANY ACCESS
                </span>
              </div>
            </div>

            {/* Continue with SSO Button */}
            <button
              type="button"
              onClick={() => {
                setError("Enterprise SSO is enabled on custom domains. Use your corporate credentials to sign in directly.");
              }}
              className="w-full h-9 sm:h-10 bg-[#0E1526] hover:bg-[#15203A] border border-[#1E293B] rounded-lg text-xs font-mono font-bold tracking-wider text-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Building2 size={15} className="text-slate-400" />
              <span>Continue with SSO</span>
            </button>

            {/* Support / Switching Links */}
            <div className="mt-2.5 text-center space-y-1.5">
              <div>
                <SubdomainLink
                  target="admin"
                  to="/admin/login"
                  className="inline-flex items-center gap-1.5 text-xs text-[#38BDF8] hover:text-[#60A5FA] transition-colors font-medium"
                >
                  <ArrowRight size={13} />
                  <span>Switch to Plant Administration Console</span>
                </SubdomainLink>
              </div>

              <div>
                <Link
                  to="/manager/register"
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Need plant-level access? Request enrollment
                </Link>
              </div>

              <div className="pt-1">
                <Link to="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  Workspace Selection
                </Link>
              </div>
            </div>
          </div>

          {/* Right Bottom Footer Note */}
          <div className="pt-2 border-t border-[#1E293B]/40 text-[10px] sm:text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-1 flex-shrink-0">
            <span className="text-center sm:text-left text-[10px] leading-tight">
              Operational data and decisions are logged for quality audit.
            </span>
            <div className="flex items-center gap-2 text-[10px]">
              <span>© 2026 FORGE</span>
              <span>•</span>
              <span className="hover:text-slate-400 cursor-pointer">Floor Safety</span>
              <span>•</span>
              <span className="hover:text-slate-400 cursor-pointer">Help</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
