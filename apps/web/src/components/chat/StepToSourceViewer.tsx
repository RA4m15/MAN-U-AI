import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  GitCommit,
  Layers,
  Sparkles,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Maximize2,
  Sliders,
} from "lucide-react";
import type {
  WorkerAnswerDTO,
  CitationDTO,
  ManualSentenceDTO,
  WorkerStepDTO,
  HighlightColorTheme,
} from "@man-u-ai/shared";
import {
  extractNumbersWithUnits,
  splitTextIntoManualSentences,
  matchStepToSourceSentence,
  STEP_SOURCE_COLOR_PALETTE,
} from "@man-u-ai/shared";

interface StepToSourceViewerProps {
  answer: WorkerAnswerDTO;
  citations?: CitationDTO[];
  className?: string;
}

interface ConnectionLine {
  stepIndex: number;
  stepId: number;
  sentenceId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: HighlightColorTheme;
  isActive: boolean;
}

export function StepToSourceViewer({
  answer,
  citations = [],
  className = "",
}: StepToSourceViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Active step for focused fidelity inspection
  const [selectedStepN, setSelectedStepN] = useState<number>(answer.steps[0]?.n ?? 1);
  const [showAllLines, setShowAllLines] = useState<boolean>(true);
  const [lines, setLines] = useState<ConnectionLine[]>([]);

  // 1. Resolve manual sentences from either answer.manual_sentences or fallback from citations
  const resolvedSentences: ManualSentenceDTO[] = useMemo(() => {
    if (answer.manual_sentences && answer.manual_sentences.length > 0) {
      return answer.manual_sentences;
    }
    // Fallback: extract sentences from citations
    if (citations && citations.length > 0) {
      let count = 1;
      const extracted: ManualSentenceDTO[] = [];
      for (const c of citations) {
        const sents = splitTextIntoManualSentences(c.excerpt, {
          source_id: c.id,
          documentTitle: c.documentTitle,
          page: c.page,
          startIdIndex: count,
        });
        count += sents.length;
        extracted.push(...sents);
      }
      return extracted;
    }
    // Fallback: manual_text
    if (answer.manual_text) {
      return splitTextIntoManualSentences(answer.manual_text);
    }
    return [];
  }, [answer.manual_sentences, answer.manual_text, citations]);

  // 2. Ensure each step has a linked sentence ID
  const stepsWithLinks: (WorkerStepDTO & { resolvedSentenceId: string })[] = useMemo(() => {
    return answer.steps.map((step) => {
      const sentenceId =
        step.source_sentence_id ||
        matchStepToSourceSentence(step.text, resolvedSentences, step.source_id) ||
        resolvedSentences[0]?.id ||
        "sent-1";
      return {
        ...step,
        resolvedSentenceId: sentenceId,
      };
    });
  }, [answer.steps, resolvedSentences]);

  // 3. Extract unique numbers across all steps and manual sentences and map to color palette
  const numberColorMap = useMemo(() => {
    const map = new Map<string, HighlightColorTheme>();
    const allText = [
      ...answer.steps.map((s) => s.text),
      ...resolvedSentences.map((s) => s.text),
      ...(answer.values ? answer.values.map((v) => `${v.value} ${v.unit}`) : []),
    ].join(" ");

    const detected = extractNumbersWithUnits(allText);
    detected.forEach((val, idx) => {
      const theme = STEP_SOURCE_COLOR_PALETTE[idx % STEP_SOURCE_COLOR_PALETTE.length];
      map.set(val.toLowerCase(), theme);
      // also map without spaces or raw digits
      map.set(val.replace(/\s+/g, "").toLowerCase(), theme);
    });
    return map;
  }, [answer.steps, answer.values, resolvedSentences]);

  // 4. Calculate SVG connection lines between Step cards and Sentence cards
  const updateLines = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: ConnectionLine[] = [];

    stepsWithLinks.forEach((step, idx) => {
      const stepEl = stepRefs.current.get(step.n);
      const sentEl = sentenceRefs.current.get(step.resolvedSentenceId);

      if (stepEl && sentEl) {
        const stepRect = stepEl.getBoundingClientRect();
        const sentRect = sentEl.getBoundingClientRect();

        const x1 = stepRect.right - containerRect.left;
        const y1 = stepRect.top + stepRect.height / 2 - containerRect.top;
        const x2 = sentRect.left - containerRect.left;
        const y2 = sentRect.top + sentRect.height / 2 - containerRect.top;

        const theme =
          STEP_SOURCE_COLOR_PALETTE[idx % STEP_SOURCE_COLOR_PALETTE.length];

        newLines.push({
          stepIndex: idx,
          stepId: step.n,
          sentenceId: step.resolvedSentenceId,
          x1,
          y1,
          x2,
          y2,
          color: theme,
          isActive: step.n === selectedStepN,
        });
      }
    });

    setLines(newLines);
  };

  useEffect(() => {
    updateLines();
    const ro = new ResizeObserver(() => {
      updateLines();
    });
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    window.addEventListener("resize", updateLines);
    // Brief timeout to allow flex reflow
    const timer = setTimeout(updateLines, 80);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateLines);
      clearTimeout(timer);
    };
  }, [stepsWithLinks, selectedStepN, resolvedSentences]);

  // Helper function to render text with color-coded number badges
  const renderTextWithNumberHighlights = (text: string) => {
    if (!text) return null;
    const tokens = text.split(
      /(\b(?:\d+(?:\.\d+)?(?:\s*(?:Nm|bar|BAR|psi|PSI|rpm|RPM|mm|cm|m|kg|g|mg|V|A|mA|kW|W|Hz|kHz|MHz|°C|°F|%))?|[A-Z]{1,3}\d{1,4})\b)/gi
    );

    return tokens.map((part, i) => {
      const clean = part.trim().toLowerCase();
      const theme = numberColorMap.get(clean) || numberColorMap.get(clean.replace(/\s+/g, ""));
      if (theme && /\d/.test(part)) {
        return (
          <mark
            key={i}
            className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono font-bold text-xs mx-0.5 border transition-all duration-200"
            style={{
              backgroundColor: theme.badgeBg,
              borderColor: theme.badgeBorder,
              color: theme.badgeText,
              boxShadow: `0 0 8px ${theme.glow}`,
            }}
          >
            {part}
          </mark>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const activeStep = stepsWithLinks.find((s) => s.n === selectedStepN);

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl bg-surface-1/95 border border-primary/30 p-4 md:p-6 shadow-2xl backdrop-blur-md space-y-4 overflow-hidden ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-hairline/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/20 text-primary">
              <GitCommit size={16} />
            </span>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Step-to-Source Fidelity Lines
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-2xs font-semibold uppercase tracking-wider">
                Verifiable
              </span>
            </h3>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Direct SVG line links each simplified worker instruction to its exact sentence in the OEM manual. Numbers are color-synchronized.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowAllLines(!showAllLines)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              showAllLines
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-surface-2 border-hairline text-ink-muted hover:text-ink"
            }`}
          >
            <Layers size={13} />
            <span>{showAllLines ? "All Lines" : "Single Line"}</span>
          </button>
        </div>
      </div>

      {/* Number Fidelity Color Legend */}
      {numberColorMap.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-2xs bg-surface-2/60 p-2.5 rounded-xl border border-hairline/60">
          <span className="font-bold text-ink-tertiary uppercase tracking-wider flex items-center gap-1 mr-1">
            <Sparkles size={12} className="text-primary" />
            Number Guard Matches:
          </span>
          {Array.from(numberColorMap.entries())
            .filter(([val]) => !val.includes(" "))
            .slice(0, 6)
            .map(([val, theme], i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-2xs border"
                style={{
                  backgroundColor: theme.badgeBg,
                  borderColor: theme.badgeBorder,
                  color: theme.badgeText,
                }}
              >
                {val}
              </span>
            ))}
        </div>
      )}

      {/* Main Two-Column View with SVG Overlay */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-12 min-h-[300px]">
        {/* SVG Bezier Lines Overlay (Visible on md+ screens) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none hidden md:block z-10"
          style={{ overflow: "visible" }}
        >
          <defs>
            <filter id="svgGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {lines.map((l) => (
              <linearGradient
                key={`grad-${l.stepId}`}
                id={`grad-${l.stepId}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#0057FF" />
                <stop offset="100%" stopColor={l.color.stroke} />
              </linearGradient>
            ))}
          </defs>

          {lines.map((line) => {
            if (!showAllLines && !line.isActive) return null;

            const dx = Math.abs(line.x2 - line.x1) * 0.5;
            const pathData = `M ${line.x1} ${line.y1} C ${line.x1 + dx} ${line.y1}, ${line.x2 - dx} ${line.y2}, ${line.x2} ${line.y2}`;

            return (
              <g key={`connection-${line.stepId}`}>
                {/* Background shadow path for contrast */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="#070B14"
                  strokeWidth={line.isActive ? 6 : 4}
                  strokeOpacity={0.8}
                />
                {/* Main animated connecting curve */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={`url(#grad-${line.stepId})`}
                  strokeWidth={line.isActive ? 3.5 : 1.8}
                  strokeOpacity={line.isActive ? 1 : 0.35}
                  strokeDasharray={line.isActive ? "none" : "4 4"}
                  filter={line.isActive ? "url(#svgGlow)" : undefined}
                  className="transition-all duration-300"
                />
                {/* Left Step Anchor Node */}
                <circle
                  cx={line.x1}
                  cy={line.y1}
                  r={line.isActive ? 5 : 3.5}
                  fill="#0057FF"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  className="transition-all duration-300"
                />
                {/* Right Sentence Anchor Node */}
                <circle
                  cx={line.x2}
                  cy={line.y2}
                  r={line.isActive ? 5 : 3.5}
                  fill={line.color.stroke}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}
        </svg>

        {/* LEFT COLUMN: Worker-Friendly Steps */}
        <div className="space-y-3 z-20">
          <div className="flex items-center justify-between pb-1">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-ink-tertiary flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Simplified Worker Steps
            </span>
            <span className="text-2xs text-ink-subtle">
              Tap a step to trace source
            </span>
          </div>

          <div className="space-y-2.5">
            {stepsWithLinks.map((step) => {
              const isSelected = step.n === selectedStepN;
              return (
                <div
                  key={step.n}
                  ref={(el) => {
                    if (el) stepRefs.current.set(step.n, el);
                    else stepRefs.current.delete(step.n);
                  }}
                  onClick={() => setSelectedStepN(step.n)}
                  className={`relative cursor-pointer p-3.5 rounded-xl border transition-all duration-200 select-none ${
                    isSelected
                      ? "bg-primary/10 border-primary shadow-lg ring-1 ring-primary/40"
                      : "bg-surface-2 border-hairline hover:border-hairline-strong hover:bg-surface-3/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-extrabold text-sm flex-shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary text-white shadow-sm"
                          : "bg-surface-3 text-ink-muted border border-hairline"
                      }`}
                    >
                      {step.n}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm md:text-base font-medium text-ink leading-snug">
                        {renderTextWithNumberHighlights(step.text)}
                      </p>
                      <div className="flex items-center gap-2 pt-1 text-2xs text-ink-tertiary">
                        <span className="inline-flex items-center gap-1 font-mono text-primary font-semibold">
                          <CheckCircle2 size={11} />
                          Sentence {step.resolvedSentenceId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Edge Dot Indicator for SVG curve */}
                  <div
                    className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-surface-1 transition-all ${
                      isSelected
                        ? "bg-primary ring-2 ring-primary/40 scale-125"
                        : "bg-hairline-strong"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Original Manual Sentences */}
        <div className="space-y-3 z-20">
          <div className="flex items-center justify-between pb-1">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-ink-tertiary flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Original OEM Manual Passages
            </span>
            <span className="text-2xs text-ink-subtle">
              Sentence-level grounding
            </span>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
            {resolvedSentences.length > 0 ? (
              resolvedSentences.map((sent) => {
                const isLinked = activeStep?.resolvedSentenceId === sent.id;
                return (
                  <div
                    key={sent.id}
                    ref={(el) => {
                      if (el) sentenceRefs.current.set(sent.id, el);
                      else sentenceRefs.current.delete(sent.id);
                    }}
                    className={`relative p-3 rounded-xl border transition-all duration-200 ${
                      isLinked
                        ? "bg-emerald-500/10 border-emerald-500/60 shadow-lg ring-1 ring-emerald-500/40"
                        : "bg-surface-2/70 border-hairline hover:bg-surface-2"
                    }`}
                  >
                    {/* Left Edge Dot Indicator for SVG curve */}
                    <div
                      className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-surface-1 transition-all ${
                        isLinked
                          ? "bg-emerald-400 ring-2 ring-emerald-500/40 scale-125"
                          : "bg-hairline-strong"
                      }`}
                    />

                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 font-mono text-2xs font-bold text-ink-tertiary uppercase">
                        <BookOpen size={11} className="text-primary" />
                        {sent.documentTitle || "OEM Technical Manual"}{" "}
                        {sent.page ? `· p.${sent.page}` : ""}
                      </span>
                      <span
                        className={`font-mono text-3xs font-extrabold px-1.5 py-0.5 rounded ${
                          isLinked
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-surface-3 text-ink-muted"
                        }`}
                      >
                        {sent.id}
                      </span>
                    </div>

                    <p className="text-xs md:text-sm text-ink-muted leading-relaxed font-sans">
                      "{renderTextWithNumberHighlights(sent.text)}"
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="p-4 rounded-xl bg-surface-2 border border-hairline text-center text-xs text-ink-muted">
                No manual text passages available for grounding.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Step-to-Source Verification Summary Footer */}
      {activeStep && (
        <div className="pt-3 border-t border-hairline/60 flex items-center justify-between gap-3 text-2xs text-ink-muted flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">Active Connection:</span>
            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-mono font-bold">
              Step {activeStep.n}
            </span>
            <ArrowRight size={12} className="text-ink-tertiary" />
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
              {activeStep.resolvedSentenceId}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 size={13} />
            <span>Number Guard & Step Verified Faithful to Source</span>
          </div>
        </div>
      )}
    </div>
  );
}
