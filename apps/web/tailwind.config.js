/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── MAN-U-AI design tokens (Linear-inspired, industrial dark) ──
        canvas: "#010102",
        "surface-1": "#0f1011",
        "surface-2": "#141516",
        "surface-3": "#18191a",
        "surface-4": "#1e1f21",
        "hairline": "#23252a",
        "hairline-strong": "#34343a",
        "hairline-tertiary": "#3e3e44",
        // Primary violet accent
        primary: {
          DEFAULT: "#5e6ad2",
          hover: "#828fff",
          focus: "#5e69d1",
          muted: "#3d4499",
          subtle: "#1e2154",
        },
        // Text hierarchy
        ink: {
          DEFAULT: "#f7f8f8",
          muted: "#d0d6e0",
          subtle: "#8a8f98",
          tertiary: "#62666d",
        },
        // Semantic colors
        success: "#27a644",
        warning: "#f59e0b",   // amber — caution
        danger: "#ef4444",    // red — critical
        info: "#3b82f6",
        // Brand-specific
        "brand-secure": "#7a7fad",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "1.4" }],
        xs: ["12px", { lineHeight: "1.4" }],
        sm: ["13px", { lineHeight: "1.5" }],
        base: ["14px", { lineHeight: "1.5" }],
        md: ["15px", { lineHeight: "1.5" }],
        lg: ["16px", { lineHeight: "1.5" }],
        xl: ["18px", { lineHeight: "1.4" }],
        "2xl": ["20px", { lineHeight: "1.35" }],
        "3xl": ["24px", { lineHeight: "1.3" }],
        "4xl": ["28px", { lineHeight: "1.25" }],
        "5xl": ["32px", { lineHeight: "1.2" }],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.03em",
        tight: "-0.02em",
        snug: "-0.01em",
        normal: "0",
        wide: "0.02em",
        wider: "0.04em",
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        "3xl": "24px",
        full: "9999px",
      },
      spacing: {
        4.5: "18px",
        13: "52px",
        15: "60px",
        17: "68px",
        18: "72px",
        sidebar: "240px",
        "sidebar-collapsed": "56px",
        "right-panel": "320px",
      },
      boxShadow: {
        "card": "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        "elevated": "0 4px 16px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4)",
        "panel": "inset 0 1px 0 rgba(255,255,255,0.04)",
        "glow-primary": "0 0 20px rgba(94,106,210,0.25)",
        "glow-danger": "0 0 20px rgba(239,68,68,0.25)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        "slide-right": "slideRight 0.2s ease-out",
        "pulse-subtle": "pulseSubtle 2s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
        "shimmer": "shimmer 1.8s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      transitionDuration: {
        fast: "100ms",
        base: "150ms",
        slow: "250ms",
      },
      zIndex: {
        sidebar: "40",
        overlay: "50",
        modal: "60",
        tooltip: "70",
        toast: "80",
      },
    },
  },
  plugins: [],
};
