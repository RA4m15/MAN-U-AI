import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Smartphone, Upload, MessageSquare, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function EngineerMobileRequiredPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <section className="w-full max-w-xl rounded-2xl border border-hairline bg-surface-1 p-6 md:p-8">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-5">
          <Smartphone size={22} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Engineer workspace</p>
        <h1 className="text-2xl font-bold text-ink mt-2">Continue in the MAN-U-AI Flutter app</h1>
        <p className="text-sm text-ink-subtle mt-3 leading-relaxed">
          Engineer accounts use the dedicated mobile workflow. The web application is reserved for Admin and Manager / Operator panels.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          <div className="rounded-xl border border-hairline bg-surface-2 p-4">
            <Upload size={17} className="text-primary mb-2" />
            <h2 className="text-sm font-semibold text-ink">Capture evidence</h2>
            <p className="text-xs text-ink-subtle mt-1">Submit supported machine photos or videos from the field.</p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface-2 p-4">
            <MessageSquare size={17} className="text-primary mb-2" />
            <h2 className="text-sm font-semibold text-ink">Ask questions</h2>
            <p className="text-xs text-ink-subtle mt-1">Ask troubleshooting questions with citations from available technical sources.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-7">
          <button onClick={handleSignOut} className="btn-secondary inline-flex items-center gap-2">
            <LogOut size={14} />
            Sign out
          </button>
          <button onClick={() => navigate(-1)} className="text-xs text-ink-subtle hover:text-ink inline-flex items-center gap-1.5">
            <ArrowLeft size={13} />
            Go back
          </button>
        </div>
      </section>
    </main>
  );
}
