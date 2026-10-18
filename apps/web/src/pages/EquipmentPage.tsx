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
  Activity,
  BookOpen,
  Bot,
  ExternalLink,
  ChevronRight,
  Gauge,
  Thermometer,
  Clock,
  Wrench,
  X,
  Layers,
  Radio,
  Loader2,
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
  status: "operational" | "warning" | "critical" | "offline";
  healthScore?: number;
  temperature?: number;
  vibrationRms?: number;
  runtimeHours?: number;
  linkedManualsCount: number;
  activeAlarms: string[];
  telemetryConnected: boolean;
}

const FALLBACK_EQUIPMENT: EquipmentItem[] = [
  {
    id: "eq-01",
    name: "Centrifugal Slurry Pump P-102",
    type: "Centrifugal Pump",
    model: "SP-400 Heavy Duty",
    manufacturer: "Flowserve",
    serialNumber: "FS-2023-9981",
    location: "Line 1 - Slurry Preparation",
    status: "operational",
    linkedManualsCount: 3,
    activeAlarms: [],
    telemetryConnected: false,
  },
  {
    id: "eq-02",
    name: "Rotary Screw Air Compressor AC-300",
    type: "Air Compressor",
    model: "Atlas Copco GA-90+",
    manufacturer: "Atlas Copco",
    serialNumber: "AC-8812-B",
    location: "Utility Room B",
    status: "operational",
    linkedManualsCount: 2,
    activeAlarms: [],
    telemetryConnected: false,
  },
  {
    id: "eq-03",
    name: "Hydraulic Stamping Press HP-400",
    type: "Hydraulic Press",
    model: "Schuler 400-T",
    manufacturer: "Schuler Pressen",
    serialNumber: "SC-400-091",
    location: "Line 3 - Main Fabrication",
    status: "warning",
    linkedManualsCount: 4,
    activeAlarms: ["LOTO Verification Check Pending"],
    telemetryConnected: false,
  },
];

export function EquipmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Equipment Form State
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("Centrifugal Pump");
  const [formModel, setFormModel] = useState("");
  const [formManufacturer, setFormManufacturer] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [formLocation, setFormLocation] = useState("");

  const { data: resp, isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: () => equipmentApi.list(),
  });

  const equipmentList: EquipmentItem[] =
    resp?.data?.data && Array.isArray(resp.data.data) && resp.data.data.length > 0
      ? resp.data.data.map((item: any, idx: number) => ({
          id: item.id || item._id || `eq-${idx}`,
          name: item.name || "Industrial Machine",
          type: item.type || "General Machinery",
          model: item.model || "Standard Model",
          manufacturer: item.manufacturer || "OEM",
          serialNumber: item.serialNumber || "N/A",
          location: item.location || "Facility Floor",
          status: (item.status as any) || "operational",
          linkedManualsCount: item.documentIds ? item.documentIds.length : 1,
          activeAlarms: item.activeAlarms || [],
          telemetryConnected: Boolean(item.telemetryConfig?.connected),
          temperature: item.telemetryConfig?.temperature,
          vibrationRms: item.telemetryConfig?.vibrationRms,
          healthScore: item.telemetryConfig?.healthScore,
          runtimeHours: item.runtimeHours || 1200,
        }))
      : FALLBACK_EQUIPMENT;

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      type: string;
      model: string;
      manufacturer: string;
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
        item.manufacturer.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAddEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    createMutation.mutate({
      name: formName,
      type: formType,
      model: formModel || "Industrial Series",
      manufacturer: formManufacturer || "Plant Facility OEM",
      serialNumber: formSerial || `SN-${Math.floor(Math.random() * 90000) + 10000}`,
      location: formLocation || "Main Plant Floor",
    });
  };

  const handleTroubleshoot = (eq: EquipmentItem) => {
    navigate(
      `/?query=Diagnose+and+troubleshoot+operational+procedures+and+specifications+for+${encodeURIComponent(
        eq.name
      )}+(${encodeURIComponent(eq.model)})+manufactured+by+${encodeURIComponent(
        eq.manufacturer
      )}+located+at+${encodeURIComponent(eq.location)}`
    );
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
            <span className="badge-primary text-2xs">{equipmentList.length} Units</span>
            <span className="badge-muted text-2xs font-mono">Production MongoDB</span>
          </div>
          <p className="text-xs md:text-sm text-ink-subtle">
            Manage monitored machinery, view connected manuals, telemetry status and launch AI troubleshooting.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary self-start sm:self-auto flex items-center gap-2 text-xs"
        >
          <Plus size={14} />
          Register Machine
        </button>
      </div>

      {/* Quick Status KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card bg-surface-1 border border-hairline p-3">
          <span className="text-2xs text-ink-tertiary uppercase tracking-wider">Total Machinery</span>
          <p className="text-xl font-bold text-ink mt-0.5">
            {isLoading ? "..." : equipmentList.length}
          </p>
        </div>
        <div className="card bg-surface-1 border border-hairline p-3">
          <span className="text-2xs text-success uppercase tracking-wider">Operational</span>
          <p className="text-xl font-bold text-success mt-0.5">
            {equipmentList.filter((e) => e.status === "operational").length}
          </p>
        </div>
        <div className="card bg-surface-1 border border-hairline p-3">
          <span className="text-2xs text-warning uppercase tracking-wider">Warning State</span>
          <p className="text-xl font-bold text-warning mt-0.5">
            {equipmentList.filter((e) => e.status === "warning").length}
          </p>
        </div>
        <div className="card bg-surface-1 border border-hairline p-3">
          <span className="text-2xs text-ink-tertiary uppercase tracking-wider">Telemetry Gateway</span>
          <p className="text-xs font-medium text-ink-subtle mt-1.5 flex items-center gap-1.5">
            <Radio size={12} className="text-warning" />
            <span>OPC-UA Standby</span>
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input
            type="text"
            placeholder="Search equipment by name, model, serial, manufacturer or facility zone..."
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

      {/* Equipment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((eq) => (
          <div
            key={eq.id}
            onClick={() => setSelectedEquipment(eq)}
            className="card bg-surface-1 border border-hairline rounded-xl p-4 flex flex-col justify-between hover:border-hairline-strong transition-all cursor-pointer group"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-2xs font-mono uppercase tracking-wider text-ink-tertiary">
                    {eq.type} · {eq.location}
                  </span>
                  <h3 className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                    {eq.name}
                  </h3>
                  <p className="text-2xs text-ink-subtle">
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
              </div>

              {/* Active Alarms if any */}
              {eq.activeAlarms && eq.activeAlarms.length > 0 && (
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
                    {eq.telemetryConnected ? "Live Connected" : "Stream Disconnected"}
                  </span>
                </div>
                <p className="text-2xs text-ink-subtle mt-1.5">
                  {eq.telemetryConnected
                    ? `Temp: ${eq.temperature}°C · Vib: ${eq.vibrationRms} mm/s`
                    : "No live SCADA/PLC hardware stream connected. Sensor data unconfigured."}
                </p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-hairline flex items-center justify-between text-2xs">
              <div className="flex items-center gap-1.5 text-ink-tertiary">
                <BookOpen size={11} />
                <span>{eq.linkedManualsCount} Linked Manuals</span>
              </div>

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
        ))}
      </div>

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
                    {selectedEquipment.runtimeHours ? selectedEquipment.runtimeHours.toLocaleString() : "1,200"} hrs
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
                    {selectedEquipment.telemetryConnected ? "Live OPC-UA" : "Disconnected"}
                  </span>
                </div>
                {selectedEquipment.telemetryConnected ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-surface-3">
                      <span className="text-2xs text-ink-tertiary">Bearing Temp</span>
                      <p className="text-sm font-mono font-bold text-ink mt-0.5">
                        {selectedEquipment.temperature}°C
                      </p>
                    </div>
                    <div className="p-2 rounded bg-surface-3">
                      <span className="text-2xs text-ink-tertiary">Vibration RMS</span>
                      <p className="text-sm font-mono font-bold text-ink mt-0.5">
                        {selectedEquipment.vibrationRms} mm/s
                      </p>
                    </div>
                    <div className="p-2 rounded bg-surface-3">
                      <span className="text-2xs text-ink-tertiary">System Health</span>
                      <p className="text-sm font-mono font-bold text-success mt-0.5">
                        {selectedEquipment.healthScore}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded bg-surface-3/50 text-center text-xs text-ink-subtle space-y-1">
                    <p className="font-medium text-ink">Industrial Telemetry Stream Not Connected</p>
                    <p className="text-2xs text-ink-tertiary">
                      To display real-time sensor measurements (temperature, vibration, pressure), configure the OPC-UA or Modbus TCP gateway under Integrations.
                    </p>
                  </div>
                )}
              </div>

              {/* Linked Manuals */}
              <div>
                <h4 className="text-2xs font-semibold text-ink-tertiary uppercase tracking-wider mb-2">
                  Linked Documentation & SOPs
                </h4>
                <div className="space-y-1.5">
                  <Link
                    to="/knowledge"
                    className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2 border border-hairline hover:border-primary/40 transition-colors text-xs text-ink group"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen size={13} className="text-primary" />
                      <span>Authorized Equipment Maintenance Manual & Rebuild SOP</span>
                    </div>
                    <ChevronRight size={13} className="text-ink-tertiary group-hover:text-primary transition-colors" />
                  </Link>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-hairline flex items-center justify-end gap-2">
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
                  Machine / Asset Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. High Pressure Feed Pump P-105"
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
                    placeholder="e.g. Model X-500"
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
                    placeholder="e.g. Sulzer"
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
                    placeholder="SN-10924"
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
                  placeholder="e.g. Building C - High Bay Line 2"
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
