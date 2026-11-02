import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[MAN-U-AI Workspace Uncaught Exception]:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleSignOut = () => {
    try {
      localStorage.removeItem("manuai_token");
      localStorage.removeItem("manuai_user");
    } catch {}
    window.location.href = "/login";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface-1 p-6 md:p-8 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-danger/10 border border-danger/20 text-danger flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-danger">Workspace Anomaly Detected</p>
            <h1 className="text-xl font-bold text-ink mt-2">Operational Interface Interrupted</h1>
            <p className="text-xs text-ink-subtle mt-2 leading-relaxed">
              A runtime component exception occurred while rendering the plant console. Your authenticated session and plant data remain secure.
            </p>

            {this.state.error && (
              <div className="mt-4 p-3 rounded-lg bg-surface-2 border border-hairline text-left text-2xs font-mono text-danger/80 overflow-x-auto max-h-28">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto btn-primary inline-flex items-center justify-center gap-2 text-xs py-2.5 px-4"
              >
                <RefreshCw size={13} />
                <span>Reload Workspace</span>
              </button>
              <button
                onClick={this.handleSignOut}
                className="w-full sm:w-auto btn-secondary inline-flex items-center justify-center gap-2 text-xs py-2.5 px-4"
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
