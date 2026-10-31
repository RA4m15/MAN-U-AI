import React from "react";

export function IndustrialCompressorSchematic({ className = "" }: { className?: string }) {
  return (
    <div className={`relative w-full rounded-lg border border-[#1E293B] bg-[#070D1B] overflow-hidden flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 680 370"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto max-h-full select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Industrial Compressor Unit Technical Blueprint"
      >
        <defs>
          {/* Blueprint Grid Pattern */}
          <pattern id="blueprint-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#0F1D36" strokeWidth="0.8" />
          </pattern>
          <pattern id="blueprint-grid-major" width="96" height="96" patternUnits="userSpaceOnUse">
            <rect width="96" height="96" fill="none" stroke="#16294C" strokeWidth="1.2" />
          </pattern>

          {/* Tank Gradient */}
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

        {/* Ground Support Bed Rail */}
        <rect x="130" y="318" width="480" height="7" rx="2" fill="#0A162D" stroke="#1E3A8A" strokeWidth="1.2" />

        {/* Vibration Isolator Footings */}
        <rect x="175" y="310" width="46" height="8" rx="2" fill="#1E293B" stroke="#3B82F6" strokeWidth="1" />
        <circle cx="198" cy="314" r="2.5" fill="#FFFFFF" />

        <rect x="525" y="310" width="46" height="8" rx="2" fill="#1E293B" stroke="#3B82F6" strokeWidth="1" />
        <circle cx="548" cy="314" r="2.5" fill="#FFFFFF" />

        {/* Horizontal Air Receiver Tank */}
        <rect
          x="150"
          y="226"
          width="440"
          height="84"
          rx="42"
          fill="url(#tank-body-grad)"
          stroke="#3B82F6"
          strokeWidth="2"
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

        {/* Electric Motor Housing (Middle) */}
        <rect x="230" y="156" width="130" height="70" rx="5" fill="#0B1A36" stroke="#2563EB" strokeWidth="1.5" />
        {/* Motor Ribbed Cooling Fins */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} x={244 + i * 14} y="145" width="7" height="81" rx="2" fill="#1D4ED8" stroke="#60A5FA" strokeWidth="0.8" opacity="0.9" />
        ))}
        {/* Motor Terminal Box */}
        <rect x="270" y="132" width="40" height="13" rx="2" fill="#1E3A8A" stroke="#3B82F6" strokeWidth="1" />

        {/* Compressor Cylinder Head (Right) */}
        <rect x="424" y="122" width="86" height="104" rx="5" fill="#09152C" stroke="#3B82F6" strokeWidth="1.5" />
        {/* Horizontal Stepped Cooling Fins */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect key={i} x={415} y={130 + i * 11} width="104" height="5" rx="1.5" fill="#2563EB" stroke="#93C5FD" strokeWidth="0.8" />
        ))}
        {/* Compressor Crankcase */}
        <rect x="408" y="186" width="118" height="40" rx="4" fill="#0F244C" stroke="#3B82F6" strokeWidth="1.5" />
        <circle cx="467" cy="206" r="14" fill="#060C18" stroke="#60A5FA" strokeWidth="1.5" />
        <circle cx="467" cy="206" r="5" fill="#FFFFFF" />

        {/* High-Pressure Discharge Pipe */}
        <path
          d="M 467 122 L 467 102 Q 467 92 477 92 L 536 92 Q 546 92 546 102 L 546 226"
          fill="none"
          stroke="#3B82F6"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 467 122 L 467 102 Q 467 92 477 92 L 536 92 Q 546 92 546 102 L 546 226"
          fill="none"
          stroke="#93C5FD"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Pressure Gauge Dial (Right Side) */}
        <g transform="translate(565, 168)">
          <line x1="-19" y1="0" x2="0" y2="0" stroke="#3B82F6" strokeWidth="4" />
          <circle cx="0" cy="0" r="18" fill="#0B162C" stroke="#60A5FA" strokeWidth="2" />
          <circle cx="0" cy="0" r="14" fill="#060C18" />
          {/* Dial Ticks */}
          <line x1="-10" y1="0" x2="-6" y2="0" stroke="#94A3B8" strokeWidth="1" />
          <line x1="0" y1="-10" x2="0" y2="-6" stroke="#94A3B8" strokeWidth="1" />
          <line x1="10" y1="0" x2="6" y2="0" stroke="#94A3B8" strokeWidth="1" />
          <line x1="-7" y1="-7" x2="-4" y2="-4" stroke="#94A3B8" strokeWidth="1" />
          <line x1="7" y1="-7" x2="4" y2="-4" stroke="#94A3B8" strokeWidth="1" />
          {/* Needle */}
          <line x1="0" y1="0" x2="7" y2="-8" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="0" cy="0" r="2.5" fill="#FFFFFF" />
        </g>

        {/* Left Drive Belt */}
        <path
          d="M 180 140 L 305 170 M 180 264 L 305 204"
          stroke="#1E3A8A"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M 180 140 L 305 170 M 180 264 L 305 204"
          stroke="#3B82F6"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Large Drive Pulley Wheel (Left) */}
        <circle cx="180" cy="202" r="66" fill="#060E1F" stroke="#3B82F6" strokeWidth="3" filter="url(#cobalt-glow)" />
        <circle cx="180" cy="202" r="52" fill="#0B1733" stroke="#1D4ED8" strokeWidth="2" />

        {/* Curved Fan Blades / Spokes */}
        <path d="M 180 202 Q 150 162 145 142 Q 170 147 180 202 Z" fill="#3B82F6" opacity="0.85" />
        <path d="M 180 202 Q 220 172 240 167 Q 235 192 180 202 Z" fill="#60A5FA" opacity="0.85" />
        <path d="M 180 202 Q 210 242 215 262 Q 190 257 180 202 Z" fill="#3B82F6" opacity="0.85" />
        <path d="M 180 202 Q 140 232 120 237 Q 125 212 180 202 Z" fill="#60A5FA" opacity="0.85" />

        {/* Pulley Center Hub */}
        <circle cx="180" cy="202" r="17" fill="#0057FF" stroke="#FFFFFF" strokeWidth="2" />
        <circle cx="180" cy="202" r="6" fill="#FFFFFF" />

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

        {/* Technical Callout: FIG. 01 / COMPRESSOR UNIT */}
        <text
          x="640"
          y="342"
          textAnchor="end"
          fill="#64748B"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
          letterSpacing="0.12em"
        >
          FIG. 01 / COMPRESSOR UNIT
        </text>
      </svg>
    </div>
  );
}

