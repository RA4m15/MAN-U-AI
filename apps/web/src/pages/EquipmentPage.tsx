import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  BookOpen,
  Bot,
  ChevronRight,
  Radio,
  Loader2,
  Trash2,
  X,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { equipmentApi } from "@/lib/api";

interface EquipmentItem {
  id: string;
  name: string;
  type: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  location: string;
  status: "operational" | "warning" | "critical" | "offline" | "unavailable";
  healthScore?: number | null;
  temperature?: number | null;
  vibrationRms?: number | null;
  runtimeHours?: number | null;
  linkedManualsCount: number;
  documentIds: Array<{ id?: string; _id?: string; title?: string; filename?: string } | string>;
  activeAlarms: string[];
  telemetryConnected: boolean;
  createdAt?: string | null;
}

export function EquipmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Equipment Form State
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("Centrifugal Pump");
  const [formModel, setFormModel] = useState("");
  const [formManufacturer, setFormManufacturer] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [formLocation, setFormLocation] = useState("");

  const {
    data: resp,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["equipment"],
    queryFn: () => equipmentApi.list(),
  });

  const rawEquipment = resp?.data?.data;
  const equipmentList: EquipmentItem[] = Array.isArray(rawEquipment)
    ? rawEquipment.map((item: any) => ({
        id: String(item.id || item._id),
        name: item.name || "Not provided",
        type: item.type || "Not provided",
        model: item.model || "Not provided",
        manufacturer: item.manufacturer || "Not provided",
        serialNumber: item.serialNumber || "Not provided",
        location: item.location || "Not provided",
        status: (item.status as any) || "unavailable",
        linkedManualsCount: Array.isArray(item.documentIds) ? item.documentIds.length : 0,
        documentIds: Array.isArray(item.documentIds) ? item.documentIds : [],
        activeAlarms: Array.isArray(item.activeAlarms) ? item.activeAlarms : [],
        telemetryConnected: Boolean(item.telemetryConfig?.connected),
        temperature: item.telemetryConfig?.temperature ?? null,
        vibrationRms: item.telemetryConfig?.vibrationRms ?? null,
        healthScore: item.telemetryConfig?.healthScore ?? null,
        runtimeHours: typeof item.runtimeHours === "number" ? item.runtimeHours : null,
        createdAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : null,
      }))
    : [];

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      type: string;
      model?: string;
      manufacturer?: string;
      serialNumber?: string;
      location?: string;
    }) => equipmentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      setIsAddModalOpen(false);
      setFormName("");
      setFormModel("");
      setFormManufacturer("");
      setFormSerial("");
      setFormLocation("");
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(
        err.response?.data?.error?.message || "Failed to register machine in database. Check permissions."
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => equipmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      setSelectedEquipment(null);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(
        err.response?.data?.error?.message || "Failed to delete equipment record. Admin/Engineer privileges required."
      );
    },
  });

  const filtered = equipmentList.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.manufacturer.toLowerCase().includes(q) ||
        item.serialNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAddEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setErrorMessage(null);
    createMutation.mutate({
      name: formName.trim(),
      type: formType,
      model: formModel.trim() || undefined,
      manufacturer: formManufacturer.trim() || undefined,
      serialNumber: formSerial.trim() || undefined,
      location: formLocation.trim() || undefined,
    });
  };

  const handleTroubleshoot = (eq: EquipmentItem) => {
    navigate(
      `/?equipmentId=${encodeURIComponent(eq.id)}&query=Diagnose+and+troubleshoot+operational+procedures+and+specifications+for+${encodeURIComponent(
        eq.name
      )}+(${encodeURIComponent(eq.model)})+manufactured+by+${encodeURIComponent(
        eq.manufacturer
      )}+located+at+${encodeURIComponent(eq.location)}`
    );
  };

  const getErrorMessage = () => {
    if (!error) return "An error occurred while communicating with the equipment API.";
    const axiosErr = error as any;
    if (axiosErr.response?.status === 503) {
      return "Equipment service unavailable: MongoDB is disconnected.";
    }
    return axiosErr.response?.data?.error?.message || axiosErr.message || "Failed to load equipment from database.";
  };

  return (
    <div className="flex flex-col h-full bg-canvas overflow-y-auto p-4 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="text-primary w-5 h-5" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink">
              Equipment Registry
            </h1>
            {!isLoading && !isError && (
              <span className="badge-primary text-2xs">{equipmentList.length} Units</span>
            )}
            <span className="badge-muted text-2xs font-mono">Production MongoDB</span>
          </div>
          <p className="text-xs md:text-sm text-ink-subtle">
            Manage monitored machinery, view connected manuals, telemetry status, and launch AI troubleshooting.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage(null);
            setIsAddModalOpen(true);
          }}
          className="btn-primary self-start sm:self-auto flex items-center gap-2 text-xs"
        >
          <Plus size={14} />
          Register Machine
        </button>
      </div>

      {/* Global Mutation Error Notice */}
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

      {/* Quick Status KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card bg-surface-1 border border-hairline p-3">
          <span className="text-2xs text-ink-tertiary uppercase tracking-wider">Total Machinery</span>
          <p className="text-xl font-bold text-ink mt-0.5">
            {isLoading ? "..." : isError ? "—" : equipmentList.length}
          </p>
        </div>
        <div className="card bg-surface-1 border border-hairline p-3">
          <span className="text-2xs text-success uppercase tracking-wider">Operational</span>
          <p className="text-xl font-bold text-success mt-0.5">
            {isLoading ? "..." : isError ? "—" : equipmentList.filter((e) => e.status === "operational").length}
          </p>
        </div>
        <div className="card bg-surface-1 border border-hairline p-3">
          <span className="text-2xs text-warning uppercase tracking-wider">Warning State</span>
          <p className="text-xl font-bold text-warning mt-0.5">
            {isLoading ? "..." : isError ? "—" : equipmentList.filter((e) => e.status === "warning").length}
          </p>
        </div>
        <div className="card bg-surface-1 border border-hairline p-3">
          <span className="text-2xs text-ink-tertiary uppercase tracking-wider">Telemetry Gateway</span>
          <p className="text-xs font-medium text-ink-subtle mt-1.5 flex items-center gap-1.5">
            <Radio size={12} className={equipmentList.some((e) => e.telemetryConnected) ? "text-success" : "text-warning"} />
            <span>
              {equipmentList.filter((e) => e.telemetryConnected).length > 0
                ? `${equipmentList.filter((e) => e.telemetryConnected).length} Connected`
                : "Not connected"}
            </span>
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input
            type="text"
            placeholder="Search equipment by name, model, serial, manufacturer, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-ink-tertiary" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-xs w-40"
          >
            <option value="all">All Operational States</option>
            <option value="operational">Operational</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical Alarm</option>
            <option value="offline">Offline / Overhaul</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card bg-surface-1 border border-hairline p-12 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="text-xs text-ink-subtle">Querying equipment registry from MongoDB...</p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card bg-surface-1 border border-danger/30 p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-3 rounded-full bg-danger/10 text-danger">
            <AlertCircle size={28} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Failed to Load Equipment</h3>
            <p className="text-xs text-ink-subtle mt-1 max-w-md">{getErrorMessage()}</p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={13} />
            Retry Query
          </button>
        </div>
      )}

      {/* Populated vs Empty State */}
      {!isLoading && !isError && equipmentList.length === 0 && (
        <div className="card bg-surface-1 border border-hairline p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 rounded-full bg-surface-2 border border-hairline text-ink-tertiary">
            <Cpu size={32} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">No Equipment Registered</h3>
            <p className="text-xs text-ink-subtle mt-1 max-w-sm">
              The equipment collection in MongoDB is currently empty. Register your facility's machinery to link manuals and enable AI troubleshooting.
            </p>
          </div>
          <button
            onClick={() => {
              setErrorMessage(null);
              setIsAddModalOpen(true);
            }}
            className="btn-primary text-xs flex items-center gap-2"
          >
            <Plus size={14} />
            Register First Unit
          </button>
        </div>
      )}

      {/* Empty Filter State */}
      {!isLoading && !isError && equipmentList.length > 0 && filtered.length === 0 && (
        <div className="card bg-surface-1 border border-hairline p-8 text-center text-xs text-ink-subtle">
          No equipment matches your current search or status filter.
        </div>
      )}

      {/* Equipment Cards Grid */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((eq) => (
            <div
              key={eq.id}
              onClick={() => setSelectedEquipment(eq)}
              className="card bg-surface-1 border border-hairline rounded-xl p-4 flex flex-col justify-between hover:border-hairline-strong transition-all cursor-pointer group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <span className="text-2xs font-mono uppercase tracking-wider text-ink-tertiary block truncate">
                      {eq.type} · {eq.location}
                    </span>
                    <h3 className="text-sm font-semibold text-ink group-hover:text-primary transition-colors truncate">
                      {eq.name}
                    </h3>
                    <p className="text-2xs text-ink-subtle truncate">
                      {eq.manufacturer} · {eq.model}
                    </p>
                  </div>

                  {/* Status Badges */}
                  {eq.status === "operational" && (
                    <span className="badge-success text-2xs flex-shrink-0">
                      <CheckCircle2 size={10} /> Normal
                    </span>
                  )}
                  {eq.status === "warning" && (
                    <span className="badge-warning text-2xs flex-shrink-0">
                      <AlertTriangle size={10} /> Caution
                    </span>
                  )}
                  {eq.status === "critical" && (
                    <span className="badge-danger text-2xs flex-shrink-0 animate-pulse-subtle">
                      <Flame size={10} /> Critical
                    </span>
                  )}
                  {eq.status === "offline" && (
                    <span className="badge-muted text-2xs flex-shrink-0">Offline</span>
                  )}
                  {(!eq.status || eq.status === "unavailable" || !["operational", "warning", "critical", "offline"].includes(eq.status)) && (
                    <span className="badge-muted text-2xs flex-shrink-0">Status unavailable</span>
                  )}
                </div>

                {/* Active Alarms if any */}
                {eq.activeAlarms.length > 0 && (
                  <div className="mb-3 p-2 rounded bg-surface-2 border border-hairline space-y-1">
                    {eq.activeAlarms.map((alm, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-2xs text-danger font-medium">
                        <AlertTriangle size={11} className="flex-shrink-0" />
                        <span className="truncate">{alm}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Real Telemetry Connection Status Badge */}
                <div className="my-3 p-2.5 rounded-lg bg-surface-2/60 border border-hairline">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-ink-tertiary flex items-center gap-1 font-mono uppercase">
                      <Radio size={11} className={eq.telemetryConnected ? "text-success" : "text-ink-tertiary"} />
                      Telemetry Stream
                    </span>
                    <span
                      className={cn(
                        "text-2xs font-medium px-1.5 py-0.5 rounded",
                        eq.telemetryConnected
                          ? "bg-success/10 text-success border border-success/20"
                          : "bg-surface-3 text-ink-tertiary border border-hairline"
                      )}
                    >
                      {eq.telemetryConnected ? "Live Connected" : "Not connected"}
                    </span>
                  </div>
                  <p className="text-2xs text-ink-subtle mt-1.5">
                    {eq.telemetryConnected && eq.temperature != null && eq.vibrationRms != null
                      ? `Temp: ${eq.temperature}°C · Vib: ${eq.vibrationRms} mm/s`
                      : eq.telemetryConnected
                      ? "Connected (awaiting stream values)"
                      : "No telemetry available. Sensor hardware stream not connected."}
                  </p>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-hairline flex items-center justify-between text-2xs">
                <div className="flex items-center gap-1.5 text-ink-tertiary">
                  <BookOpen size={11} />
                  <span>
                    {eq.linkedManualsCount > 0
                      ? `${eq.linkedManualsCount} Linked Manual${eq.linkedManualsCount > 1 ? "s" : ""}`
                      : "No linked manuals"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete equipment record "${eq.name}" from database?`)) {
                        deleteMutation.mutate(eq.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="btn-icon p-1 text-ink-tertiary hover:text-danger"
                    title="Delete equipment"
                  >
                    <Trash2 size={13} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTroubleshoot(eq);
                    }}
                    className="btn-primary text-2xs py-1 px-2.5 flex items-center gap-1"
                  >
                    <Bot size={11} />
                    AI Troubleshoot
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Equipment Detailed Drawer / Modal */}
      {selectedEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-1 border border-hairline rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
            <div className="flex items-start justify-between pb-4 border-b border-hairline mb-4">
              <div>
                <span className="text-2xs font-mono text-primary uppercase tracking-wider">
                  {selectedEquipment.type}
                </span>
                <h3 className="text-base font-bold text-ink">{selectedEquipment.name}</h3>
                <p className="text-xs text-ink-subtle">
                  {selectedEquipment.location} · SN: {selectedEquipment.serialNumber}
                </p>
              </div>
              <button onClick={() => setSelectedEquipment(null)} className="btn-icon p-1">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Detailed Specs */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                  <span className="text-2xs text-ink-tertiary">Manufacturer & Model</span>
                  <p className="font-medium text-ink mt-0.5">
                    {selectedEquipment.manufacturer} - {selectedEquipment.model}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                  <span className="text-2xs text-ink-tertiary">Operating Hours</span>
                  <p className="font-mono font-medium text-ink mt-0.5">
                    {selectedEquipment.runtimeHours != null
                      ? `${selectedEquipment.runtimeHours.toLocaleString()} hrs`
                      : "Not recorded"}
                  </p>
                </div>
              </div>

              {/* Honest Telemetry Status */}
              <div className="p-3.5 rounded-lg bg-surface-2 border border-hairline">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-semibold text-ink-subtle uppercase">
                    Machine Telemetry & Diagnostic Stream
                  </span>
                  <span className="badge-muted text-2xs">
                    {selectedEquipment.telemetryConnected ? "Live OPC-UA" : "Not connected"}
                  </span>
                </div>
                {selectedEquipment.telemetryConnected && (selectedEquipment.temperature != null || selectedEquipment.vibrationRms != null) ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-surface-3">
                      <span className="text-2xs text-ink-tertiary">Bearing Temp</span>
                      <p className="text-sm font-mono font-bold text-ink mt-0.5">
                        {selectedEquipment.temperature != null ? `${selectedEquipment.temperature}°C` : "Not recorded"}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-surface-3">
                      <span className="text-2xs text-ink-tertiary">Vibration RMS</span>
                      <p className="text-sm font-mono font-bold text-ink mt-0.5">
                        {selectedEquipment.vibrationRms != null ? `${selectedEquipment.vibrationRms} mm/s` : "Not recorded"}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-surface-3">
                      <span className="text-2xs text-ink-tertiary">System Health</span>
                      <p className="text-sm font-mono font-bold text-success mt-0.5">
                        {selectedEquipment.healthScore != null ? `${selectedEquipment.healthScore}%` : "Not evaluated"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded bg-surface-3/50 text-center text-xs text-ink-subtle space-y-1">
                    <p className="font-medium text-ink">Industrial Telemetry Stream Not Connected</p>
                    <p className="text-2xs text-ink-tertiary">
                      No live telemetry available. To display real-time sensor measurements (temperature, vibration, pressure), configure an active industrial gateway.
                    </p>
                  </div>
                )}
              </div>

              {/* Linked Manuals */}
              <div>
                <h4 className="text-2xs font-semibold text-ink-tertiary uppercase tracking-wider mb-2">
                  Linked Documentation & SOPs
                </h4>
                {selectedEquipment.documentIds.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedEquipment.documentIds.map((docItem: any, idx: number) => {
                      const docId = typeof docItem === "string" ? docItem : docItem?.id || docItem?._id || `doc-${idx}`;
                      const docTitle = typeof docItem === "object" && docItem?.title ? docItem.title : `Linked Technical Manual (${docId.slice(-6)})`;
                      return (
                        <Link
                          key={docId}
                          to="/knowledge"
                          className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2 border border-hairline hover:border-primary/40 transition-colors text-xs text-ink group"
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen size={13} className="text-primary" />
                            <span>{docTitle}</span>
                          </div>
                          <ChevronRight size={13} className="text-ink-tertiary group-hover:text-primary transition-colors" />
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-surface-2 border border-hairline text-center text-xs text-ink-tertiary">
                    No linked manuals
                  </div>
                )}
              </div>

              {/* Drawer Actions */}
              <div className="pt-3 border-t border-hairline flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete equipment record "${selectedEquipment.name}" from database?`)) {
                      deleteMutation.mutate(selectedEquipment.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="btn-danger text-xs flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  Delete Machine
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEquipment(null)}
                    className="btn-secondary text-xs"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleTroubleshoot(selectedEquipment);
                    }}
                    className="btn-primary text-xs flex items-center gap-1.5 shadow-glow-primary"
                  >
                    <Bot size={13} />
                    Launch Copilot Troubleshooting
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-1 border border-hairline rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-hairline mb-4">
              <div className="flex items-center gap-2">
                <Cpu size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-ink">Register New Machine</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="btn-icon p-1">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAddEquipment} className="space-y-3 text-xs">
              <div>
                <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                  Machine / Asset Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Centrifugal Slurry Pump P-105"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                    Equipment Class
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="Centrifugal Pump">Centrifugal Pump</option>
                    <option value="Air Compressor">Air Compressor</option>
                    <option value="Hydraulic Press">Hydraulic Press</option>
                    <option value="CNC Machine">CNC Machine</option>
                    <option value="Turbine">Turbine / Generator</option>
                    <option value="Conveyor Cell">Conveyor Cell</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                    Model Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SP-400"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                    Manufacturer / OEM
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Flowserve"
                    value={formManufacturer}
                    onChange={(e) => setFormManufacturer(e.target.value)}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FS-2024-001"
                    value={formSerial}
                    onChange={(e) => setFormSerial(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                  Facility Zone / Line Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Line 1 - Slurry Preparation"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="input text-xs"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  {createMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                  Save Equipment to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
