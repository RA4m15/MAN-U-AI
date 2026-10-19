import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Paperclip,
  Mic,
  MicOff,
  Bot,
  User,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  BookOpen,
  Loader2,
  Zap,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  Copy,
  RotateCcw,
} from "lucide-react";
import { chatApi, conversationsApi, feedbackApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CitationDTO } from "@man-u-ai/shared";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: CitationDTO[];
  warningLevel?: "none" | "caution" | "critical";
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  {
    icon: <BookOpen size={14} />,
    title: "Pump Seal Replacement",
    prompt: "What are the step-by-step procedures and torque ratings for replacing the mechanical seal on Slurry Pump P-102?",
    category: "SOP",
  },
  {
    icon: <AlertTriangle size={14} />,
    title: "Fault Code Diagnosis",
    prompt: "Our compressor is showing fault code E-0247. What does this mean and how do I clear it?",
    category: "Troubleshooting",
  },
  {
    icon: <ShieldAlert size={14} />,
    title: "Lockout/Tagout (LOTO)",
    prompt: "Show me the required LOTO energy isolation procedure for Hydraulic Press HP-400 before accumulator servicing.",
    category: "Safety",
  },
  {
    icon: <CheckCircle2 size={14} />,
    title: "Maintenance Specs",
    prompt: "What are the permissible shaft runout tolerances and recommended O-ring lubricants for centrifugal pumps?",
    category: "Specifications",
  },
];

export function AssistantPage() {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Fetch real conversation messages from backend
  const { data: serverMessages = [], isLoading: isLoadingHistory } = useQuery<Message[]>({
    queryKey: ["messages", conversationId],
    queryFn: async (): Promise<Message[]> => {
      if (!conversationId) return [];
      try {
        const res = await conversationsApi.messages(conversationId);
        return (res.data?.data || []).map((m: any) => ({
          id: m.id || m._id,
          role: m.role,
          content: m.content,
          citations: m.citations,
          warningLevel: m.content?.toLowerCase().includes("critical") ? "critical" : m.citations?.length ? "caution" : "none",
          timestamp: new Date(m.createdAt || Date.now()),
        }));
      } catch {
        return [];
      }
    },
    enabled: Boolean(conversationId),
  });


  // Sync messages
  const activeMessages = conversationId ? serverMessages : localMessages;
  const isNewChat = activeMessages.length === 0;

  // Pre-fill query param from navigation if provided
  useEffect(() => {
    const q = searchParams.get("query");
    if (q && !input) {
      setInput(q);
    }
  }, [searchParams]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, isLoading]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, []);

  useEffect(() => {
    adjustTextarea();
  }, [input, adjustTextarea]);

  const handleSend = useCallback(async (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content || isLoading) return;

    setErrorMessage(null);
    setInput("");
    setIsLoading(true);

    let activeConvId = conversationId;

    try {
      // 1. If starting a new conversation, create record in MongoDB
      if (!activeConvId) {
        const convTitle = content.length > 40 ? content.slice(0, 40) + "..." : content;
        const convRes = await conversationsApi.create(convTitle);
        if (convRes.data?.success && convRes.data.data?.id) {
          activeConvId = convRes.data.data.id;
        }
      }

      // 2. Add optimistic user message to local state
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };
      setLocalMessages((prev) => [...prev, userMsg]);

      // 3. Send to real backend RAG pipeline (/api/v1/chat)
      const res = await chatApi.ask(activeConvId || "default-session", content);

      if (res.data?.success && res.data.data) {
        const assistantMsg: Message = {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: res.data.data.answer,
          citations: res.data.data.citations || [],
          warningLevel: res.data.data.warningLevel || "none",
          timestamp: new Date(),
        };

        if (activeConvId && activeConvId !== conversationId) {
          // Navigate to new conversation URL and invalidate conversation lists
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          navigate(`/chat/${activeConvId}`, { replace: true });
        } else if (conversationId) {
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        } else {
          setLocalMessages((prev) => [...prev, assistantMsg]);
        }
      } else {
        throw new Error(res.data?.error?.message || "Failed to receive grounded response from copilot");
      }
    } catch (err: any) {
      console.error("[Assistant Error]:", err);
      const errData = err.response?.data?.error;
      const msg = errData
        ? (errData.details ? `${errData.message} (${errData.details})` : errData.message)
        : (err.message || "Communication failure with RAG gateway.");
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, conversationId, navigate, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Voice speech-to-text
  const toggleListening = () => {
    const win = window as any;
    if (!win.webkitSpeechRecognition && !win.SpeechRecognition) {
      alert("Speech recognition is not available in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      if (transcript) {
        setInput(transcript);
        setTranscript("");
      }
      return;
    }

    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      const t = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setTranscript(t);
      setInput(t);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  // Text-to-speech (read aloud)
  const speakMessage = (text: string) => {
    if (!window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const cleanText = text.replace(/[*#`_]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleFeedback = async (messageId: string, rating: "up" | "down") => {
    try {
      await feedbackApi.submit(messageId, rating);
      alert("Thank you! Feedback recorded for model alignment.");
    } catch {
      // Ignored
    }
  };

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* ── Messages Area ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 md:px-8 py-6">
        {isNewChat ? (
          <WelcomeScreen onPromptSelect={(p) => handleSend(p)} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {activeMessages.map((message: Message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onSpeak={speakMessage}
                isSpeaking={isSpeaking}
                onFeedback={handleFeedback}
              />
            ))}


            {isLoading && (
              <div className="flex gap-3 animate-slide-up">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-surface-2 border border-hairline flex items-center justify-center">
                  <Bot size={13} className="text-primary animate-pulse" />
                </div>
                <div className="p-4 rounded-xl bg-surface-1 border border-hairline flex items-center gap-2.5 text-xs text-ink-subtle">
                  <Loader2 size={13} className="animate-spin text-primary" />
                  <span>Retrieving verified document passages & synthesizing answer with Gemini...</span>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 flex items-center gap-2 text-xs text-danger">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Message Composer ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 md:px-8 pb-6">
        <div className="max-w-3xl mx-auto">
          {/* Listening indicator */}
          {isListening && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-md bg-danger/10 border border-danger/20 text-xs text-danger animate-fade-in">
              <span className="status-dot-danger" />
              Recording microphone input... speak technical query clearly
            </div>
          )}

          <div className="relative flex flex-col rounded-xl border border-hairline bg-surface-2 shadow-elevated focus-within:border-primary/60 transition-colors">
            {/* Text area */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about equipment manuals, SOPs, fault codes, torque ratings or LOTO procedures..."
              rows={1}
              className="w-full bg-transparent px-4 pt-3.5 pb-2 text-sm text-ink placeholder:text-ink-tertiary
                resize-none focus:outline-none scrollbar-none"
              style={{ maxHeight: "180px" }}
            />

            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 pb-3 pt-1">
              <button
                type="button"
                className={cn("btn-icon", isListening && "text-danger bg-danger/10")}
                onClick={toggleListening}
                title={isListening ? "Stop voice recording" : "Record voice question"}
              >
                {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>

              <div className="flex-1" />

              <span className="text-2xs text-ink-tertiary mr-2 hidden sm:block">
                Enter to send · Shift+Enter for newline
              </span>

              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all shadow-sm",
                  input.trim() && !isLoading
                    ? "bg-primary text-white hover:bg-primary-hover shadow-glow-primary"
                    : "bg-surface-3 text-ink-tertiary cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                <span>{isLoading ? "Grounding..." : "Send"}</span>
              </button>
            </div>
          </div>

          <p className="text-center text-2xs text-ink-tertiary mt-2">
            MAN-U-AI grounds technical responses in authorized plant documentation. Always follow approved facility LOTO protocols before servicing machinery.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Welcome Screen ────────────────────────────────────────────────────────
function WelcomeScreen({ onPromptSelect }: { onPromptSelect: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-8 md:py-12 animate-fade-in">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 mb-5 shadow-glow-primary">
        <Zap size={24} className="text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-ink mb-2">
        Industrial Multimodal Copilot
      </h1>
      <p className="text-xs md:text-sm text-ink-subtle text-center max-w-md mb-8 leading-relaxed">
        Ask technical troubleshooting questions regarding pumps, compressors, hydraulic presses, and automated cells.
        Every procedural answer is grounded with verifiable page citations.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {SUGGESTED_PROMPTS.map((item, i) => (
          <button
            key={i}
            onClick={() => onPromptSelect(item.prompt)}
            className="flex items-start gap-3 p-4 rounded-xl bg-surface-1 border border-hairline
              hover:bg-surface-2 hover:border-hairline-strong text-left transition-all
              group animate-slide-up"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-2 border border-hairline flex-shrink-0 mt-0.5 text-primary">
              {item.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                  {item.title}
                </span>
                <span className="badge-muted text-2xs">{item.category}</span>
              </div>
              <p className="text-xs text-ink-subtle group-hover:text-ink-muted transition-colors line-clamp-2">
                {item.prompt}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────
function MessageBubble({
  message,
  onSpeak,
  isSpeaking,
  onFeedback,
}: {
  message: Message;
  onSpeak: (text: string) => void;
  isSpeaking: boolean;
  onFeedback: (id: string, rating: "up" | "down") => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 animate-slide-up", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary/20 border border-primary/30"
            : "bg-surface-2 border border-hairline"
        )}
      >
        {isUser ? (
          <User size={13} className="text-primary" />
        ) : (
          <Bot size={13} className="text-ink-subtle" />
        )}
      </div>

      <div className={cn("flex flex-col gap-2 max-w-[85%]", isUser && "items-end")}>
        {/* Warning Banner */}
        {!isUser && message.warningLevel === "critical" && (
          <div className="notice-danger w-full">
            <ShieldAlert size={14} className="text-danger flex-shrink-0 mt-0.5" />
            <div className="text-xs text-danger">
              <strong>Critical Safety & Energy Isolation Alert:</strong>
              <p className="mt-0.5">High hazard task detected. Strict Lockout/Tagout (LOTO) verification and residual energy dissipation must be confirmed before proceeding.</p>
            </div>
          </div>
        )}

        {!isUser && message.warningLevel === "caution" && (
          <div className="notice-warning w-full">
            <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
            <div className="text-xs text-warning">
              <strong>Caution:</strong> Verify mechanical tolerances and torques against current manual revision before performing service.
            </div>
          </div>
        )}

        {/* Content */}
        <div className={cn(isUser ? "message-user" : "message-assistant")}>
          <MarkdownContent content={message.content} />
        </div>

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="w-full space-y-1.5 pt-1">
            <p className="text-2xs text-ink-tertiary font-medium uppercase tracking-wider">
              Verified Source Citations ({message.citations.length})
            </p>
            <div className="space-y-1.5">
              {message.citations.map((citation, idx) => (
                <div
                  key={citation.id || idx}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-surface-2 border border-hairline hover:border-primary/40 transition-colors"
                >
                  <BookOpen size={12} className="text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-ink">{citation.documentTitle}</span>
                      <span className="text-2xs text-ink-tertiary font-mono">{citation.revision}</span>
                      <span className="citation">Page {citation.page}</span>
                    </div>
                    {citation.section && (
                      <p className="text-2xs text-ink-subtle mt-0.5">{citation.section}</p>
                    )}
                    {citation.excerpt && (
                      <p className="text-2xs text-ink-tertiary mt-1 italic line-clamp-2">"{citation.excerpt}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message Actions */}
        {!isUser && message.content && (
          <div className="flex items-center gap-1 text-ink-tertiary pt-0.5">
            <button
              onClick={() => navigator.clipboard.writeText(message.content)}
              className="btn-icon p-1"
              title="Copy answer"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={() => onSpeak(message.content)}
              className={cn("btn-icon p-1", isSpeaking && "text-primary")}
              title={isSpeaking ? "Stop speech" : "Read aloud"}
            >
              {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
            <div className="w-px h-3 bg-hairline mx-0.5" />
            <button
              onClick={() => onFeedback(message.id, "up")}
              className="btn-icon p-1 hover:text-success"
              title="Helpful technical answer"
            >
              <ThumbsUp size={12} />
            </button>
            <button
              onClick={() => onFeedback(message.id, "down")}
              className="btn-icon p-1 hover:text-danger"
              title="Incorrect or ungrounded"
            >
              <ThumbsDown size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Markdown Parser ───────────────────────────────────────────────────────
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="text-sm text-ink space-y-2 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return <h4 key={i} className="text-sm font-bold text-ink mt-2.5 mb-1">{line.slice(4)}</h4>;
        }
        if (line.startsWith("## ")) {
          return <h3 key={i} className="text-base font-bold text-ink mt-3 mb-1">{line.slice(3)}</h3>;
        }
        if (line.startsWith("# ")) {
          return <h2 key={i} className="text-lg font-bold text-ink mt-3 mb-1">{line.slice(2)}</h2>;
        }
        if (/^\d+\.\s/.test(line)) {
          const [num, ...rest] = line.split(/\.\s(.+)/);
          return (
            <div key={i} className="flex gap-2.5 items-start">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center mt-0.5 font-mono">
                {num}
              </span>
              <p className="flex-1 text-ink-muted" dangerouslySetInnerHTML={{ __html: formatInline(rest.join(". ")) }} />
            </div>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 items-start ml-1">
              <span className="text-primary mt-1 text-xs">•</span>
              <p className="text-ink-muted" dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-0.5" />;
        return (
          <p key={i} className="text-ink-muted" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        );
      })}
    </div>
  );
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-ink font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded text-xs bg-surface-3 text-primary font-mono">$1</code>');
}
