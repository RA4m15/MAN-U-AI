import React, { useState, useEffect } from "react";

export function IndustrialCompressorSchematic({ className = "" }: { className?: string }) {
  const [isRunning, setIsRunning] = useState(true);
  const [speedMode, setSpeedMode] = useState<"normal" | "turbo" | "idle">("normal");
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);
  const [pressure, setPressure] = useState(7.2);
  const [rpm, setRpm] = useState(1450);

  // Dynamic telemetry simulation based on running state
  useEffect(() => {
    if (!isRunning) {
      setRpm(0);
      return;
    }

    const baseRpm = speedMode === "turbo" ? 2200 : speedMode === "idle" ? 750 : 1450;
    const basePressure = speedMode === "turbo" ? 8.4 : speedMode === "idle" ? 5.8 : 7.2;

    const interval = setInterval(() => {
      // Realistic pneumatic micro-fluctuations
      const jitter = (Math.random() - 0.5) * 0.08;
      setPressure(Number((basePressure + jitter).toFixed(2)));
      setRpm(Math.round(baseRpm + (Math.random() - 0.5) * 16));
    }, 400);

    return () => clearInterval(interval);
  }, [isRunning, speedMode]);

  // Animation duration parameters
  const pulleyDuration = !isRunning
    ? "0s"
    : speedMode === "turbo"
    ? "0.9s"
    : speedMode === "idle"
    ? "3.2s"
    : "1.8s";

  const beltDuration = !isRunning
    ? "0s"
    : speedMode === "turbo"
    ? "0.3s"
    : speedMode === "idle"
    ? "1.0s"
    : "0.55s";

  const pistonDuration = !isRunning
    ? "0s"
    : speedMode === "turbo"
    ? "0.45s"
    : speedMode === "idle"
    ? "1.6s"
    : "0.9s";

  const flowDuration = !isRunning
    ? "0s"
    : speedMode === "turbo"
    ? "0.7s"
    : speedMode === "idle"
    ? "2.4s"
    : "1.3s";

  return (
    <div
      className={`relative w-full rounded-xl border border-[#1E293B] bg-[#070D1B] overflow-hidden flex flex-col items-center justify-center group transition-all duration-300 shadow-xl ${
        isRunning ? "shadow-blue-950/40 border-[#2563EB]/40" : "border-slate-800"
      } ${className}`}
    >
      {/* CSS Keyframes for High-Performance Mechanical Animations */}
      <style>{`
        @keyframes rotate-pulley {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes belt-flow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -28; }
        }
        @keyframes air-flow-pipe {
          from { stroke-dashoffset: 60; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes piston-reciprocate {
          0% { transform: translateY(0px); }
          50% { transform: translateY(12px); }
          100% { transform: translateY(0px); }
        }
        @keyframes gauge-flutter {
          0% { transform: rotate(28deg); }
          50% { transform: rotate(34deg); }
          100% { transform: rotate(28deg); }
        }
        @keyframes pulse-vibe {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-0.8px); }
          100% { transform: translateY(0px); }
        }
        @keyframes pressure-wave {
          0% { r: 12px; opacity: 0.8; stroke-width: 2px; }
          100% { r: 36px; opacity: 0; stroke-width: 0.5px; }
        }
      `}</style>

      {/* Top Interactive HUD Bar */}
      <div className="w-full px-3 py-1.5 bg-[#0A1326]/90 border-b border-[#1E293B] flex items-center justify-between text-[10px] font-mono select-none z-10 backdrop-blur-sm">
        {/* Live Status Indicator & Telemetry */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              isRunning ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34D399]" : "bg-rose-500"
            }`}
          />
          <span className="text-slate-300 font-semibold tracking-wider">
            {isRunning ? (speedMode === "turbo" ? "TURBO COMPRESSION" : speedMode === "idle" ? "IDLE CYCLING" : "ONLINE // ACTIVE") : "STANDBY // OFFLINE"}
          </span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span className="text-[#38BDF8] font-bold hidden sm:inline">{rpm} RPM</span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span className="text-emerald-400 font-bold hidden sm:inline">{pressure} BAR ({(pressure * 14.5038).toFixed(1)} PSI)</span>
        </div>

        {/* Interactive Mode Switches */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (!isRunning) {
                setIsRunning(true);
                setSpeedMode("normal");
              } else if (speedMode === "normal") {
                setSpeedMode("turbo");
              } else if (speedMode === "turbo") {
                setSpeedMode("idle");
              } else {
                setIsRunning(false);
              }
            }}
            className="px-2 py-0.5 rounded text-[9px] font-bold transition-all bg-[#102042] text-[#60A5FA] border border-[#2563EB]/40 hover:bg-[#1E3A8A] hover:text-white"
            title="Click to cycle machine speeds (Normal, Turbo, Idle, Standby)"
          >
            SPEED: {isRunning ? speedMode.toUpperCase() : "STOPPED"}
          </button>
          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
              isRunning
                ? "bg-rose-950/40 text-rose-300 border border-rose-800/50 hover:bg-rose-900/60"
                : "bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/60"
            }`}
            title="Toggle Machine Motor"
          >
            {isRunning ? "PAUSE" : "ENGAGE"}
          </button>
        </div>
      </div>

      {/* Main SVG Blueprint Canvas */}
      <svg
        viewBox="0 0 680 370"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto max-h-full select-none cursor-crosshair"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Interactive Industrial Compressor Unit Technical Blueprint"
      >
        <defs>
          {/* Blueprint Grid Pattern */}
          <pattern id="blueprint-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#0F1D36" strokeWidth="0.8" />
          </pattern>
          <pattern id="blueprint-grid-major" width="96" height="96" patternUnits="userSpaceOnUse">
            <rect width="96" height="96" fill="none" stroke="#16294C" strokeWidth="1.2" />
          </pattern>

          {/* Tank Gradient with Dynamic Glow */}
          <linearGradient id="tank-body-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="25%" stopColor="#2563EB" />
            <stop offset="65%" stopColor="#0057FF" />
            <stop offset="100%" stopColor="#08215E" />
          </linearGradient>

          {/* Specular highlights */}
          <linearGradient id="tank-highlight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#60A5FA" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.1" />
          </linearGradient>

          {/* Flow Particle Gradient */}
          <linearGradient id="air-particle-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#67E8F9" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="cobalt-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Blueprint Grids */}
        <rect width="100%" height="100%" fill="url(#blueprint-grid)" />
        <rect width="100%" height="100%" fill="url(#blueprint-grid-major)" />

        {/* Blueprint Outer Framing Lines */}
        <line x1="16" y1="16" x2="664" y2="16" stroke="#1E293B" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="16" y1="354" x2="664" y2="354" stroke="#1E293B" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="16" y1="16" x2="16" y2="354" stroke="#1E293B" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="664" y1="16" x2="664" y2="354" stroke="#1E293B" strokeWidth="1" strokeDasharray="3,3" />

        {/* Acoustic Vibration Ripples when Active */}
        {isRunning && (
          <g transform="translate(467, 122)">
            <circle cx="0" cy="0" r="14" stroke="#38BDF8" fill="none" opacity="0.6" style={{ animation: `pressure-wave ${pistonDuration} cubic-bezier(0, 0.2, 0.8, 1) infinite` }} />
            <circle cx="0" cy="0" r="14" stroke="#60A5FA" fill="none" opacity="0.4" style={{ animation: `pressure-wave ${pistonDuration} cubic-bezier(0, 0.2, 0.8, 1) infinite`, animationDelay: "0.3s" }} />
          </g>
        )}

        {/* Ground Support Bed Rail */}
        <rect x="130" y="318" width="480" height="7" rx="2" fill="#0A162D" stroke="#1E3A8A" strokeWidth="1.2" />

        {/* Vibration Isolator Footings */}
        <rect x="175" y="310" width="46" height="8" rx="2" fill="#1E293B" stroke="#3B82F6" strokeWidth="1" />
        <circle cx="198" cy="314" r="2.5" fill="#FFFFFF" />

        <rect x="525" y="310" width="46" height="8" rx="2" fill="#1E293B" stroke="#3B82F6" strokeWidth="1" />
        <circle cx="548" cy="314" r="2.5" fill="#FFFFFF" />

        {/* Horizontal Air Receiver Tank */}
        <g
          onMouseEnter={() => setHoveredPart("Receiver Tank: 500L Reservoir • 7.2 Bar / 105 PSI")}
          onMouseLeave={() => setHoveredPart(null)}
          className="transition-opacity duration-200 cursor-pointer"
        >
          <rect
            x="150"
            y="226"
            width="440"
            height="84"
            rx="42"
            fill="url(#tank-body-grad)"
            stroke={hoveredPart?.includes("Receiver") ? "#93C5FD" : "#3B82F6"}
            strokeWidth={hoveredPart?.includes("Receiver") ? "2.5" : "2"}
            filter="url(#cobalt-glow)"
          />
          {/* Tank Upper Specular Beam */}
          <rect x="172" y="233" width="396" height="5" rx="2.5" fill="url(#tank-highlight)" />

          {/* Tank End Cap Weld Seams */}
          <path d="M 194 227 C 184 250 184 286 194 309" stroke="#60A5FA" strokeWidth="1.2" opacity="0.4" fill="none" />
          <path d="M 546 227 C 556 250 556 286 546 309" stroke="#60A5FA" strokeWidth="1.2" opacity="0.4" fill="none" />

          {/* Centered Plaque: MAN-U-AI / C-04 */}
          <rect x="330" y="256" width="96" height="24" rx="4" fill="#060C18" stroke="#3B82F6" strokeWidth="1.5" />
          <text
            x="378"
            y="272"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="10"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="700"
            letterSpacing="0.12em"
          >
            MAN-U-AI / C-04
          </text>
        </g>

        {/* Electric Motor Housing (Middle) */}
        <g
          onMouseEnter={() => setHoveredPart("Electric Motor: 7.5 kW 3-Phase Induction • 58.4°C")}
          onMouseLeave={() => setHoveredPart(null)}
          className="cursor-pointer"
          style={isRunning ? { animation: `pulse-vibe ${pistonDuration} ease-in-out infinite` } : undefined}
        >
          <rect x="230" y="156" width="130" height="70" rx="5" fill="#0B1A36" stroke="#2563EB" strokeWidth="1.5" />
          {/* Motor Ribbed Cooling Fins */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect key={i} x={244 + i * 14} y="145" width="7" height="81" rx="2" fill="#1D4ED8" stroke="#60A5FA" strokeWidth="0.8" opacity="0.9" />
          ))}
          {/* Motor Terminal Box */}
          <rect x="270" y="132" width="40" height="13" rx="2" fill="#1E3A8A" stroke="#3B82F6" strokeWidth="1" />
        </g>

        {/* Compressor Cylinder Head & Crankcase (Right) */}
        <g
          onMouseEnter={() => setHoveredPart("Reciprocating Cylinder Head: Stage II • Dual Valves")}
          onMouseLeave={() => setHoveredPart(null)}
          className="cursor-pointer"
          style={isRunning ? { animation: `pulse-vibe ${pistonDuration} ease-in-out infinite` } : undefined}
        >
          <rect x="424" y="122" width="86" height="104" rx="5" fill="#09152C" stroke="#3B82F6" strokeWidth="1.5" />
          {/* Horizontal Stepped Cooling Fins */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x={415} y={130 + i * 11} width="104" height="5" rx="1.5" fill="#2563EB" stroke="#93C5FD" strokeWidth="0.8" />
          ))}

          {/* Internal Reciprocating Piston Animation (Visible inside cylinder window) */}
          <rect x="442" y="140" width="50" height="38" rx="2" fill="#030712" stroke="#1E293B" strokeWidth="1" />
          <rect
            x="446"
            y="144"
            width="42"
            height="10"
            rx="2"
            fill="#38BDF8"
            stroke="#FFFFFF"
            strokeWidth="0.8"
            style={isRunning ? { animation: `piston-reciprocate ${pistonDuration} ease-in-out infinite` } : undefined}
          />
          {/* Piston Connecting Rod */}
          <line
            x1="467"
            y1="154"
            x2="467"
            y2="195"
            stroke="#93C5FD"
            strokeWidth="3.5"
            strokeLinecap="round"
            style={isRunning ? { animation: `piston-reciprocate ${pistonDuration} ease-in-out infinite` } : undefined}
          />

          {/* Compressor Crankcase */}
          <rect x="408" y="186" width="118" height="40" rx="4" fill="#0F244C" stroke="#3B82F6" strokeWidth="1.5" />
          <circle cx="467" cy="206" r="14" fill="#060C18" stroke="#60A5FA" strokeWidth="1.5" />
          {/* Rotating Crankshaft Hub */}
          <g style={{ transformOrigin: "467px 206px", animation: isRunning ? `rotate-pulley ${pistonDuration} linear infinite` : "none" }}>
            <circle cx="467" cy="206" r="10" fill="#1D4ED8" stroke="#38BDF8" strokeWidth="1" />
            <circle cx="473" cy="206" r="3.5" fill="#FFFFFF" />
          </g>
        </g>

        {/* High-Pressure Discharge Pipe */}
        <g
          onMouseEnter={() => setHoveredPart("Discharge Piping: High-pressure braided conduit")}
          onMouseLeave={() => setHoveredPart(null)}
          className="cursor-pointer"
        >
          {/* Outer Pipe */}
          <path
            d="M 467 122 L 467 102 Q 467 92 477 92 L 536 92 Q 546 92 546 102 L 546 226"
            fill="none"
            stroke="#1E3A8A"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 467 122 L 467 102 Q 467 92 477 92 L 536 92 Q 546 92 546 102 L 546 226"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Animated Internal Air Flow Stream */}
          {isRunning && (
            <path
              d="M 467 122 L 467 102 Q 467 92 477 92 L 536 92 Q 546 92 546 102 L 546 226"
              fill="none"
              stroke="#67E8F9"
              strokeWidth="2"
              strokeDasharray="6 8"
              strokeLinecap="round"
              style={{ animation: `air-flow-pipe ${flowDuration} linear infinite` }}
            />
          )}
        </g>

        {/* Pressure Gauge Dial (Right Side) */}
        <g
          transform="translate(565, 168)"
          onMouseEnter={() => setHoveredPart("Pressure Transducer: Dual-scale Bourdon tube")}
          onMouseLeave={() => setHoveredPart(null)}
          className="cursor-pointer"
        >
          <line x1="-19" y1="0" x2="0" y2="0" stroke="#3B82F6" strokeWidth="4" />
          <circle cx="0" cy="0" r="18" fill="#0B162C" stroke="#60A5FA" strokeWidth="2" />
          <circle cx="0" cy="0" r="14" fill="#060C18" />
          {/* Dial Ticks */}
          <line x1="-10" y1="0" x2="-6" y2="0" stroke="#94A3B8" strokeWidth="1" />
          <line x1="0" y1="-10" x2="0" y2="-6" stroke="#94A3B8" strokeWidth="1" />
          <line x1="10" y1="0" x2="6" y2="0" stroke="#94A3B8" strokeWidth="1" />
          <line x1="-7" y1="-7" x2="-4" y2="-4" stroke="#94A3B8" strokeWidth="1" />
          <line x1="7" y1="-7" x2="4" y2="-4" stroke="#94A3B8" strokeWidth="1" />

          {/* Animated Oscillating Pressure Needle */}
          <g
            style={{
              transformOrigin: "0px 0px",
              transform: !isRunning ? "rotate(-35deg)" : undefined,
              animation: isRunning ? `gauge-flutter ${pistonDuration} ease-in-out infinite` : "none",
            }}
          >
            <line x1="0" y1="0" x2="7" y2="-8" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
            <circle cx="0" cy="0" r="2.5" fill="#FFFFFF" />
          </g>
        </g>

        {/* Left Drive Belt with Motion Dash Travelling */}
        <g
          onMouseEnter={() => setHoveredPart("Drive Belt: Reinforced Cogged V-Belt • Friction Link")}
          onMouseLeave={() => setHoveredPart(null)}
          className="cursor-pointer"
        >
          <path
            d="M 180 140 L 305 170 M 180 264 L 305 204"
            stroke="#1E3A8A"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M 180 140 L 305 170 M 180 264 L 305 204"
            stroke="#3B82F6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Animated Belt Travelling Ribs */}
          {isRunning && (
            <path
              d="M 180 140 L 305 170 M 180 264 L 305 204"
              stroke="#93C5FD"
              strokeWidth="1.5"
              strokeDasharray="4 6"
              strokeLinecap="round"
              style={{ animation: `belt-flow ${beltDuration} linear infinite` }}
            />
          )}
        </g>

        {/* Large Drive Pulley Wheel & Rotating Blades (Left) */}
        <g
          onMouseEnter={() => setHoveredPart("Drive Pulley: 1,450 RPM • Aerodynamic Cooling Blades")}
          onMouseLeave={() => setHoveredPart(null)}
          className="cursor-pointer"
        >
          {/* Fixed Pulley Outer Casing & Track */}
          <circle cx="180" cy="202" r="66" fill="#060E1F" stroke="#3B82F6" strokeWidth="3" filter="url(#cobalt-glow)" />
          <circle cx="180" cy="202" r="52" fill="#0B1733" stroke="#1D4ED8" strokeWidth="2" />

          {/* Continuous Smoothly Rotating Fan Blades & Spoke Assembly */}
          <g
            style={{
              transformOrigin: "180px 202px",
              animation: isRunning ? `rotate-pulley ${pulleyDuration} linear infinite` : "none",
            }}
          >
            {/* 4 Curved Fan Spokes */}
            <path d="M 180 202 Q 150 162 145 142 Q 170 147 180 202 Z" fill="#3B82F6" opacity="0.9" />
            <path d="M 180 202 Q 220 172 240 167 Q 235 192 180 202 Z" fill="#60A5FA" opacity="0.9" />
            <path d="M 180 202 Q 210 242 215 262 Q 190 257 180 202 Z" fill="#3B82F6" opacity="0.9" />
            <path d="M 180 202 Q 140 232 120 237 Q 125 212 180 202 Z" fill="#60A5FA" opacity="0.9" />

            {/* Supplementary High-Speed Spoke Blades */}
            <path d="M 180 202 Q 185 152 200 140 Q 190 165 180 202 Z" fill="#93C5FD" opacity="0.6" />
            <path d="M 180 202 Q 230 200 245 215 Q 218 212 180 202 Z" fill="#93C5FD" opacity="0.6" />
            <path d="M 180 202 Q 175 252 160 264 Q 170 239 180 202 Z" fill="#93C5FD" opacity="0.6" />
            <path d="M 180 202 Q 130 204 115 189 Q 142 192 180 202 Z" fill="#93C5FD" opacity="0.6" />

            {/* Inner Hub Ring */}
            <circle cx="180" cy="202" r="22" fill="#081E48" stroke="#38BDF8" strokeWidth="1.5" />
          </g>

          {/* Pulley Center Hub Bearing */}
          <circle cx="180" cy="202" r="17" fill="#0057FF" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="180" cy="202" r="6" fill="#FFFFFF" />
        </g>

        {/* Technical Callout: DRIVE ASSEMBLY */}
        <line x1="85" y1="250" x2="135" y2="250" stroke="#3B82F6" strokeWidth="1" />
        <line x1="135" y1="250" x2="160" y2="235" stroke="#3B82F6" strokeWidth="1" />
        <circle cx="160" cy="235" r="2" fill="#3B82F6" />
        <rect x="30" y="240" width="88" height="20" fill="#060C18" stroke="#1E293B" strokeWidth="1" rx="2" />
        <text
          x="74"
          y="253"
          textAnchor="middle"
          fill="#94A3B8"
          fontSize="8"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
          letterSpacing="0.1em"
        >
          DRIVE ASSEMBLY
        </text>

        {/* Interactive Hover HUD Display inside Blueprint Canvas */}
        {hoveredPart ? (
          <g transform="translate(340, 48)">
            <rect x="-140" y="-12" width="280" height="24" rx="4" fill="#060C18" stroke="#38BDF8" strokeWidth="1" opacity="0.95" />
            <text x="0" y="4" textAnchor="middle" fill="#E2E8F0" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fontWeight="600">
              {hoveredPart}
            </text>
          </g>
        ) : (
          <text
            x="640"
            y="342"
            textAnchor="end"
            fill="#64748B"
            fontSize="9"
            fontFamily="JetBrains Mono, monospace"
            letterSpacing="0.12em"
          >
            FIG. 01 / COMPRESSOR UNIT [ACTIVE]
          </text>
        )}
      </svg>

      {/* Interactive Floor Control / Instruction Footnote */}
      <div className="w-full px-3 py-1 bg-[#050A14] border-t border-[#131E33] flex items-center justify-between text-[9px] font-mono text-slate-500">
        <span>Click machine or buttons to toggle RPM & speed</span>
        <span className="text-[#38BDF8] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0057FF] inline-block animate-ping" />
          INTERACTIVE SIMULATION ACTIVE
        </span>
      </div>
    </div>
  );
}
