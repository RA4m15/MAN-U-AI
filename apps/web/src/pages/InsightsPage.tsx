import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CheckCircle2,
  ShieldCheck,
  Bot,
  Cpu,
  Radio,
  Database,
  Loader2,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api";

export function InsightsPage() {
  const [timeRange, setTimeRange] = useState("all");

  const {
    data: resp,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["insights", timeRange],
    queryFn: () => analyticsApi.insights(timeRange),
  });

  const insights = resp?.data?.data;

  const getErrorMessage = () => {
    if (!error) return "Failed to retrieve analytics metrics from the database.";
    const axiosErr = error as any;
    if (axiosErr.response?.status === 503) {
      return "Database connection unavailable for insights calculation.";
    }
    return axiosErr.response?.data?.error?.message || axiosErr.message || "Failed to load metrics from database.";
  };

  return (
    <div className="flex flex-col h-full bg-canvas overflow-y-auto p-4 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="text-primary w-5 h-5" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink">
              System Insights & Reliability Metrics
            </h1>
            <span className="badge-primary text-2xs">Persisted Database Counts</span>
            <span className="badge-muted text-2xs font-mono">Production MongoDB</span>
          </div>
          <p className="text-xs md:text-sm text-ink-subtle">
            Authoritative counts from persisted application records, RAG query volume, and active knowledge index coverage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {["7d", "30d", "all"].map((t) => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md border transition-colors",
                timeRange === t
                  ? "bg-surface-2 border-primary/50 text-ink"
                  : "bg-surface-1 border-hairline text-ink-tertiary hover:text-ink-subtle"
              )}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card bg-surface-1 border border-hairline p-12 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="text-xs text-ink-subtle">Aggregating system metrics from MongoDB...</p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card bg-surface-1 border border-danger/30 p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-3 rounded-full bg-danger/10 text-danger">
            <AlertCircle size={28} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Failed to Load Insights</h3>
            <p className="text-xs text-ink-subtle mt-1 max-w-md">{getErrorMessage()}</p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={13} />
            Retry Metrics Query
          </button>
        </div>
      )}

      {/* Authoritative KPI Cards Grid */}
      {!isLoading && !isError && insights && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card bg-surface-1 border border-hairline p-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-2xs text-ink-tertiary uppercase font-mono">
              <span>Indexed Documents</span>
              <span className="badge-muted text-2xs">Lifetime Total</span>
            </div>
            <p className="text-2xl font-bold text-ink mt-2">
              {insights.totalIndexedDocuments ?? 0}
            </p>
            <p className="text-2xs text-ink-subtle mt-1">Authorized technical manuals & SOPs</p>
          </div>

          <div className="card bg-surface-1 border border-hairline p-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-2xs text-ink-tertiary uppercase font-mono">
              <span>Registered Machinery</span>
              <span className="badge-muted text-2xs">Lifetime Total</span>
            </div>
            <p className="text-2xl font-bold text-ink mt-2">
              {insights.totalMonitoredEquipment ?? 0}
            </p>
            <p className="text-2xs text-ink-subtle mt-1">Equipment units in registry</p>
          </div>

          <div className="card bg-surface-1 border border-hairline p-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-2xs text-ink-tertiary uppercase font-mono">
              <span>Industrial RAG Queries</span>
              <span className="badge-primary text-2xs font-mono">{timeRange.toUpperCase()}</span>
            </div>
            <p className="text-2xl font-bold text-ink mt-2">
              {insights.totalRAGInquiries ?? 0}
            </p>
            <p className="text-2xs text-ink-subtle mt-1">
              {timeRange === "all" ? "Lifetime user inquiries" : `Inquiries in the last ${timeRange}`}
            </p>
          </div>

          <div className="card bg-surface-1 border border-hairline p-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-2xs text-ink-tertiary uppercase font-mono">
              <span>Citation Grounding</span>
              <span className="text-success flex items-center font-sans">
                <ShieldCheck size={12} /> Policy
              </span>
            </div>
            <p className="text-xl font-bold text-success mt-2">
              {insights.metrics?.groundingPolicy || "STRICT"}
            </p>
            <p className="text-2xs text-ink-subtle mt-1">
              {insights.metrics?.unverifiedCitationsAllowed ?? 0} ungrounded claims permitted
            </p>
          </div>
        </div>
      )}

      {/* Data Range and System Source Info Banner */}
      {!isLoading && !isError && (
        <div className="card bg-surface-1 border border-hairline p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-2 border border-hairline flex items-center justify-center text-primary">
              <Database size={16} />
            </div>
            <div>
              <h4 className="font-semibold text-ink">Authoritative Data Scope</h4>
              <p className="text-2xs text-ink-subtle">
                Data source: <span className="font-mono text-primary">Production MongoDB</span>. All metrics reflect genuine database records without synthetic counts or inferred trends.
              </p>
            </div>
          </div>
          <Link to="/activity" className="btn-secondary text-2xs">
            Inspect Audit Trail →
          </Link>
        </div>
      )}

      {/* Honest Predictive & Telemetry Status Notice */}
      <div className="card bg-surface-1 border border-hairline p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle flex items-center gap-1.5">
            <Radio size={13} className="text-warning" />
            Predictive ML & Sensor Telemetry Status
          </h3>
          <span className="badge-muted text-2xs">Sensor Gateway Standby</span>
        </div>

        <div className="p-4 rounded-xl bg-surface-2/60 border border-hairline text-xs space-y-2">
          <p className="text-ink font-medium">
            Live Hardware Sensor Ingestion: Standby (Not connected)
          </p>
          <p className="text-ink-subtle text-xs leading-relaxed">
            The industrial copilot actively answers technical queries using vector-indexed manuals and SOPs. Equipment telemetry is unavailable until a real hardware sensor stream (OPC-UA, MQTT, or Modbus TCP) is actively connected. Real-time predictive failure detection requires live telemetry data.
          </p>
          <div className="pt-2 flex items-center justify-between text-2xs text-ink-tertiary border-t border-hairline">
            <span>Protocol: OPC-UA TCP (Configurable in Integrations)</span>
            <Link to="/integrations" className="text-primary hover:underline font-medium">
              Configure Industrial Gateway →
            </Link>
          </div>
        </div>
      </div>

      {/* Grounding & Safety Verification Standards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card bg-surface-1 border border-hairline p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-success" />
            <h4 className="text-xs font-semibold text-ink">Strict RAG Grounding Verification Policy</h4>
          </div>
          <p className="text-xs text-ink-subtle leading-relaxed">
            Every technical parameter, bolt torque specification, and fluid clearance returned by MAN-U-AI is cross-referenced with stored chunk embeddings. If sufficient evidence is not present in indexed manuals, the system explicitly returns an insufficient-evidence response rather than fabricating values.
          </p>
          <div className="pt-2 border-t border-hairline flex items-center justify-between text-2xs text-ink-tertiary">
            <span>Model: Google Gemini Live Engine</span>
            <span className="text-success font-medium">Strict Verification Active</span>
          </div>
        </div>

        <div className="card bg-surface-1 border border-hairline p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" />
            <h4 className="text-xs font-semibold text-ink">Industrial Safety Protocol Guardrails</h4>
          </div>
          <p className="text-xs text-ink-subtle leading-relaxed">
            Whenever queries touch high-risk mechanical operations (Lockout/Tagout, hydraulic line depressurization, high-voltage isolations), MAN-U-AI automatically prefixes answers with critical hazard warnings and references corresponding OSHA 1910.147 guidelines.
          </p>
          <div className="pt-2 border-t border-hairline flex items-center justify-between text-2xs text-ink-tertiary">
            <span>Standard: OSHA 1910.147 (LOTO)</span>
            <Link to="/knowledge" className="text-primary hover:underline">
              Review Safety SOPs →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
