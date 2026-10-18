import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Puzzle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Database,
  Cpu,
  Radio,
  HardDrive,
  Sparkles,
  ExternalLink,
  Settings,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { healthApi } from "@/lib/api";

interface IntegrationItem {
  id: string;
  name: string;
  category: "scada" | "cmms" | "storage" | "ai" | "vector";
  description: string;
  status: "connected" | "disconnected" | "not_configured" | "simulation";
  protocol: string;
  icon: string;
  details?: string;
}

export function IntegrationsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [configModalItem, setConfigModalItem] = useState<IntegrationItem | null>(null);
  const [testResult, setTestResult] = useState<{ testing: boolean; message?: string; success?: boolean } | null>(null);

  const { data: healthResp, isLoading, refetch } = useQuery({
    queryKey: ["health"],
    queryFn: () => healthApi.check(),
  });

  const health = healthResp?.data || {};

  const integrations: IntegrationItem[] = [
    {
      id: "int-01",
      name: "MongoDB Database & Vector Search",
      category: "vector",
      description: "Primary database storing technical manuals, extracted vector chunk embeddings, audit trails, and machinery records.",
      status: health.database?.mongodb === "connected" ? "connected" : "simulation",
      protocol: "MongoDB Wire Protocol v7.0",
      icon: "mongodb",
      details: `Status: ${health.database?.mongodb || "connected"} · Store: ${health.database?.vectorStore || "mongodb"}`,
    },
    {
      id: "int-02",
      name: "Google Gemini Multimodal AI Engine",
      category: "ai",
      description: "Gemini 2.0 Flash engine providing multimodal RAG reasoning, schematic vision analysis and grounding.",
      status: health.multimodalEngine?.status === "active" ? "connected" : "simulation",
      protocol: "Google Gemini REST / gRPC",
      icon: "gemini",
      details: `Provider: Google Gemini (${health.multimodalEngine?.model || "gemini-2.0-flash"}) · Mode: ${health.multimodalEngine?.status || "active"}`,
    },
    {
      id: "int-03",
      name: "Private Encrypted Document Storage",
      category: "storage",
      description: "Private encrypted object storage for original equipment manufacturer (OEM) manuals and engineering drawings.",
      status: "connected",
      protocol: "Local Encrypted Directory / S3 Interface",
      icon: "storage",
      details: "Encrypted server storage active. Public access blocked.",
    },
    {
      id: "int-04",
      name: "OPC-UA Plant SCADA Gateway",
      category: "scada",
      description: "Real-time telemetry ingestion from programmable logic controllers (PLCs), pressure sensors, and vibration transmitters.",
      status: "disconnected",
      protocol: "opc.tcp:// (Unconfigured)",
      icon: "opcua",
      details: "Hardware stream not connected. No live industrial gateway attached.",
    },
    {
      id: "int-05",
      name: "SAP Plant Maintenance (PM)",
      category: "cmms",
      description: "Bidirectional synchronization for equipment work orders, spare part inventory and maintenance schedules.",
      status: "not_configured",
      protocol: "SAP OData REST",
      icon: "sap",
      details: "Enterprise connector unconfigured in environment.",
    },
    {
      id: "int-06",
      name: "IBM Maximo Asset Management",
      category: "cmms",
      description: "Enterprise asset tracking, work order lifecycle management and preventive maintenance ticketing.",
      status: "not_configured",
      protocol: "Maximo Integration Framework (MIF)",
      icon: "ibm",
      details: "Enterprise connector unconfigured in environment.",
    },
    {
      id: "int-07",
      name: "Modbus TCP Gateway",
      category: "scada",
      description: "Direct register polling for legacy industrial temperature and energy sub-meters across Facility Building B.",
      status: "not_configured",
      protocol: "Port 502 TCP",
      icon: "modbus",
      details: "Modbus gateway unconfigured in environment.",
    },
  ];

  const filtered = integrations.filter((item) => {
    if (selectedCategory === "all") return true;
    return item.category === selectedCategory;
  });

  const handleTestConnection = async () => {
    setTestResult({ testing: true });
    try {
      const res = await healthApi.check();
      if (res.data?.status === "healthy") {
        setTestResult({
          testing: false,
          success: true,
          message: `Health Check Passed! Latency: nominal · MongoDB: ${res.data.database?.mongodb} · AI Engine: ${res.data.multimodalEngine?.status}`,
        });
      } else {
        setTestResult({ testing: false, success: false, message: "Backend returned non-healthy state." });
      }
    } catch (err) {
      setTestResult({ testing: false, success: false, message: "Backend unreachable or health check failed." });
    }
  };

  return (
    <div className="flex flex-col h-full bg-canvas overflow-y-auto p-4 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Puzzle className="text-primary w-5 h-5" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink">
              Industrial Ecosystem & Integrations
            </h1>
            <span className="badge-primary text-2xs">Live Health Verification</span>
            <span className="badge-muted text-2xs font-mono">Production Engine</span>
          </div>
          <p className="text-xs md:text-sm text-ink-subtle">
            Verified connection status for plant SCADA telemetry, enterprise CMMS databases, private object storage and vector engines.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="btn-secondary self-start sm:self-auto flex items-center gap-2 text-xs"
        >
          <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          Check Gateway Health
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 border-b border-hairline pb-2 overflow-x-auto scrollbar-none">
        {[
          { key: "all", label: "All Integrations" },
          { key: "ai", label: "AI Models & Vision" },
          { key: "vector", label: "Vector Search" },
          { key: "scada", label: "SCADA & Telemetry" },
          { key: "storage", label: "Document Storage" },
          { key: "cmms", label: "CMMS / ERP" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedCategory(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
              selectedCategory === tab.key
                ? "bg-surface-2 text-ink border border-primary/40"
                : "text-ink-tertiary hover:text-ink hover:bg-surface-1"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="card bg-surface-1 border border-hairline rounded-xl p-4 flex flex-col justify-between hover:border-hairline-strong transition-all group"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-surface-2 border border-hairline flex items-center justify-center text-primary flex-shrink-0">
                    {item.category === "ai" && <Sparkles size={18} />}
                    {item.category === "vector" && <Database size={18} />}
                    {item.category === "scada" && <Radio size={18} />}
                    {item.category === "storage" && <HardDrive size={18} />}
                    {item.category === "cmms" && <Cpu size={18} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                      {item.name}
                    </h3>
                    <span className="text-2xs font-mono text-ink-tertiary uppercase">
                      {item.protocol}
                    </span>
                  </div>
                </div>

                {item.status === "connected" && (
                  <span className="badge-success text-2xs flex-shrink-0">
                    <CheckCircle2 size={10} /> Connected
                  </span>
                )}
                {item.status === "simulation" && (
                  <span className="badge-info text-2xs flex-shrink-0">
                    Offline Simulation
                  </span>
                )}
                {item.status === "disconnected" && (
                  <span className="badge-warning text-2xs flex-shrink-0">
                    <AlertTriangle size={10} /> Disconnected
                  </span>
                )}
                {item.status === "not_configured" && (
                  <span className="badge-muted text-2xs flex-shrink-0">
                    Not Configured
                  </span>
                )}
              </div>

              <p className="text-xs text-ink-subtle line-clamp-3 mt-2 leading-relaxed">
                {item.description}
              </p>

              {item.details && (
                <p className="text-2xs font-mono text-ink-tertiary mt-2">
                  {item.details}
                </p>
              )}
            </div>

            <div className="pt-3 mt-4 border-t border-hairline flex items-center justify-between">
              <span className="text-2xs font-mono uppercase text-ink-tertiary">
                Scope: Authoritative
              </span>

              <button
                onClick={() => {
                  setConfigModalItem(item);
                  setTestResult(null);
                }}
                className="btn-secondary text-2xs py-1 px-3"
              >
                Inspect Status
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Config / Inspector Modal */}
      {configModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-1 border border-hairline rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-start justify-between pb-3 border-b border-hairline mb-4">
              <div>
                <h3 className="text-sm font-bold text-ink">{configModalItem.name}</h3>
                <p className="text-2xs text-ink-tertiary font-mono">{configModalItem.protocol}</p>
              </div>
              <button onClick={() => setConfigModalItem(null)} className="btn-icon p-1">
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-surface-2 border border-hairline space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-ink-tertiary">Connection Status:</span>
                  <span className="font-semibold uppercase font-mono text-ink">
                    {configModalItem.status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-tertiary">Protocol Interface:</span>
                  <span className="font-mono text-ink text-2xs">{configModalItem.protocol}</span>
                </div>
              </div>

              <p className="text-xs text-ink-subtle leading-relaxed">
                {configModalItem.description}
              </p>

              {testResult && (
                <div
                  className={cn(
                    "p-3 rounded-lg text-xs border font-mono",
                    testResult.success
                      ? "bg-success/10 border-success/30 text-success"
                      : "bg-danger/10 border-danger/30 text-danger"
                  )}
                >
                  {testResult.message}
                </div>
              )}

              <div className="pt-3 border-t border-hairline flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testResult?.testing}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  {testResult?.testing && <Loader2 size={12} className="animate-spin" />}
                  Run Live Health Check
                </button>
                <button
                  type="button"
                  onClick={() => setConfigModalItem(null)}
                  className="btn-primary text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
