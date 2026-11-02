import { useState } from "react";
import { StepToSourceViewer } from "./StepToSourceViewer";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  GitCommit,
} from "lucide-react";
import type { WorkerResponseDTO, CitationDTO } from "@man-u-ai/shared";

interface WorkerAnswerCardProps {
  answer: WorkerResponseDTO;
  citations?: CitationDTO[];
  onAskSimpler?: () => void;
  onFeedback?: (rating: "up" | "down") => void;
}

export function WorkerAnswerCard({
  answer,
  citations = [],
  onAskSimpler,
  onFeedback,
}: WorkerAnswerCardProps) {
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [showManualText, setShowManualText] = useState(false);
  const [showStepToSource, setShowStepToSource] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);

  if (answer.status === "cannot_verify") {
    return (
      <div className="w-full rounded-2xl bg-surface-1 border border-hairline-strong p-5 shadow-lg space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 text-warning">
          <AlertTriangle size={24} className="flex-shrink-0" />
          <h3 className="text-xl font-bold tracking-tight text-ink">{answer.message}</h3>
        </div>
        {answer.closest_sources && answer.closest_sources.length > 0 && (
          <div className="pt-2 border-t border-hairline/60">
            <span className="text-2xs font-semibold text-ink-tertiary uppercase tracking-wider block mb-2">
              Closest Available Sources:
            </span>
            <div className="flex flex-wrap gap-2">
              {answer.closest_sources.map((src, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-hairline text-xs font-mono text-ink-muted"
                >
                  <BookOpen size={12} className="text-primary" />
                  {src.document} · p.{src.page}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Text-To-Speech according to Section 8 requirement
  const handleReadAloud = () => {
    if (!window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const langCode = answer.language === "hi" ? "hi-IN" : "en-IN";
    const parts: string[] = [];

    // Order: Headline, warnings, steps, values
    parts.push(answer.headline);
    if (answer.warnings.length > 0) {
      parts.push("Warning: " + answer.warnings.map((w) => w.text).join(". "));
    }
    answer.steps.forEach((s) => {
      parts.push(`Step ${s.n}: ${s.text}`);
    });
    if (answer.values.length > 0) {
      parts.push(
        "Values: " + answer.values.map((v) => `${v.label}: ${v.value} ${v.unit}`).join(". ")
      );
    }

    const fullText = parts.join(". ");
    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = langCode;
    utterance.rate = 0.95; // comfortable factory worker listening speed
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleFeedbackClick = (rating: "up" | "down") => {
    setFeedbackGiven(rating);
    if (onFeedback) onFeedback(rating);
  };

  const visibleSteps = showAllSteps && answer.all_steps ? answer.all_steps : answer.steps;

  return (
    <div className="w-full rounded-2xl bg-surface-1 border border-hairline-strong p-5 shadow-xl space-y-5 animate-fade-in text-ink">
      {/* 1. Yellow Warning Banner First */}
      {answer.warnings.length > 0 && (
        <div className="rounded-xl bg-amber-500/15 border-2 border-amber-500/50 p-4 space-y-2">
          {answer.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-3 text-amber-200">
              <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm md:text-base font-bold leading-snug">{w.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* 2. Headline (>= 20px, bold) */}
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-tight">
          {answer.headline}
        </h2>
        {answer.simpler_applied && (
          <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 text-2xs font-semibold uppercase tracking-wider">
            Simpler
          </span>
        )}
      </div>

      {/* 4. Values as Highlighted Chips */}
      {answer.values.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {answer.values.map((v, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary/10 border border-primary/40 text-primary shadow-sm"
            >
              <span className="text-2xs font-bold uppercase tracking-wider opacity-80">{v.label}:</span>
              <span className="text-base font-extrabold font-mono tracking-tight">
                {v.value} {v.unit}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 3. Numbered Steps (>= 18px, generous spacing, one step per row) */}
      <div className="space-y-3 pt-1">
        {visibleSteps.map((step) => (
          <div
            key={step.n}
            className="flex items-start gap-3.5 p-3.5 rounded-xl bg-surface-2 border border-hairline hover:border-hairline-strong transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-extrabold text-base flex-shrink-0 shadow-sm font-mono">
              {step.n}
            </div>
            <p className="text-base md:text-lg font-medium text-ink leading-snug pt-0.5 flex-1">
              {step.text}
            </p>
          </div>
        ))}
      </div>

      {/* 6a. Show all steps Expander */}
      {answer.has_more_steps && (
        <button
          onClick={() => setShowAllSteps(!showAllSteps)}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-surface-2 border border-hairline text-xs font-semibold text-primary hover:bg-surface-3 transition-colors"
        >
          <span>{showAllSteps ? "Hide Extra Steps" : "Show All Steps"}</span>
          {showAllSteps ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      )}

      {/* 6. Step-to-Source Fidelity Verification & SVG Connecting Lines */}
      <div className="pt-2">
        <button
          onClick={() => setShowStepToSource(!showStepToSource)}
          className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all ${
            showStepToSource
              ? "bg-primary/15 border-primary text-primary shadow-sm"
              : "bg-surface-2 border-hairline text-ink hover:border-hairline-strong hover:bg-surface-3/50"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <GitCommit size={15} />
            </div>
            <span className="font-bold text-sm tracking-tight text-white">Step-to-Source Fidelity Lines</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-3xs font-extrabold uppercase tracking-wider border border-emerald-500/30">
              Fidelity Guaranteed
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-ink-muted">
            <span className="text-2xs font-medium">
              {showStepToSource ? "Hide Lines" : "View Step-to-Source"}
            </span>
            {showStepToSource ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {showStepToSource && (
          <div className="mt-3 animate-fade-in">
            <StepToSourceViewer answer={answer} citations={citations} />
          </div>
        )}
      </div>

      {/* 6b. Show manual text Expander */}
      {citations.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowManualText(!showManualText)}
            className="flex items-center gap-1.5 text-xs text-ink-subtle hover:text-ink font-medium transition-colors"
          >
            <BookOpen size={14} className="text-primary" />
            <span>{showManualText ? "Hide Manual Reference Text" : "Show Manual Text"}</span>
            {showManualText ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showManualText && (
            <div className="mt-3 p-4 rounded-xl bg-surface-2/80 border border-hairline space-y-2 text-xs text-ink-muted">
              {citations.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="font-semibold text-ink">
                    {c.documentTitle} · Page {c.page} {c.section ? `(${c.section})` : ""}
                  </div>
                  <p className="italic text-ink-tertiary">"{c.excerpt}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Sources Row */}
      {answer.sources && answer.sources.length > 0 && (
        <div className="pt-2 border-t border-hairline/60 flex items-center gap-2 flex-wrap text-2xs text-ink-tertiary">
          <span className="font-semibold uppercase tracking-wider">Sources:</span>
          {answer.sources.map((src, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-2 border border-hairline font-mono text-ink-muted"
            >
              {src.document} · {src.version || "v1"} · p.{src.page}
            </span>
          ))}
        </div>
      )}

      {/* Action Toolbar: Read Aloud, Simpler, Easy to understand? 👍 👎 */}
      <div className="pt-3 border-t border-hairline/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Read Aloud Button */}
          <button
            onClick={handleReadAloud}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              isSpeaking
                ? "bg-primary text-white border-primary animate-pulse"
                : "bg-surface-2 border-hairline text-ink hover:bg-surface-3"
            }`}
            title="Read aloud"
          >
            {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <span>{isSpeaking ? "Stop" : "Read Aloud"}</span>
          </button>

          {/* Simpler Button */}
          {onAskSimpler && (
            <button
              onClick={onAskSimpler}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-hairline text-xs font-semibold text-ink hover:bg-surface-3 transition-colors"
              title="Request simpler wording"
            >
              <Sparkles size={14} className="text-amber-400" />
              <span>Simpler</span>
            </button>
          )}
        </div>

        {/* Feedback Buttons: Easy to understand? 👍 👎 */}
        <div className="flex items-center gap-2 text-xs text-ink-subtle">
          <span className="text-2xs font-medium uppercase tracking-wider">Easy to understand?</span>
          <button
            onClick={() => handleFeedbackClick("up")}
            className={`p-1.5 rounded-md border transition-colors ${
              feedbackGiven === "up"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : "bg-surface-2 border-hairline text-ink-tertiary hover:text-emerald-400"
            }`}
            title="Yes, easy to understand"
          >
            <ThumbsUp size={14} />
          </button>
          <button
            onClick={() => handleFeedbackClick("down")}
            className={`p-1.5 rounded-md border transition-colors ${
              feedbackGiven === "down"
                ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                : "bg-surface-2 border-hairline text-ink-tertiary hover:text-rose-400"
            }`}
            title="No, hard to understand"
          >
            <ThumbsDown size={14} />
          </button>
          {feedbackGiven && (
            <span className="text-2xs text-emerald-400 flex items-center gap-1">
              <CheckCircle size={12} />
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

