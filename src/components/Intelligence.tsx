import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  BrainCircuit,
  Terminal,
  Sparkles,
  Droplets,
  Zap,
  Copy,
  Check,
  Cpu,
  RefreshCw,
  Info,
} from "lucide-react";
import { useTelemetry } from "../hooks/useTelemetry";

interface Message {
  role: "user" | "assistant";
  content: string;
  source?: string;
  notice?: string;
  timestamp?: string;
}

const QUICK_PROMPTS = [
  "Calculate water recovery for a 100 MW data center running at 85% utilization.",
  "Why is Membrane Distillation (MD) paired with RO instead of standalone RO?",
  "What is the heat flux and recovery potential at a 50°C coolant loop outlet?",
  "Compare power consumption of evaporative cooling towers vs Thermora closed-loop recovery.",
];

export function Intelligence() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      source: "gemini-3.6-flash",
      timestamp: "Ready",
      content: `ANSWER: Thermora Intelligence engine online. Ready to model data center thermal recovery, membrane kinetics, water yields, and compute efficiency.

WHY: Direct-to-chip liquid cooling (50°C outlet) captures up to 70% of waste IT thermal energy, energizing hybrid RO + Membrane Distillation without grid energy penalties.

EVIDENCE: Coupled mass and energy balance equations using Antoine vapor-pressure correlations and Darcy/Knudsen membrane transport equations.

CONFIDENCE: Model-based estimate (deterministic engineering model; not experimentally validated)

ASSUMPTIONS: Ambient 22°C, hot loop 45-55°C, RO reject 60,000 ppm NaCl, 260,000 ppm brine saturation cap.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const { telemetry } = useTelemetry();

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendQuery = async (queryText: string) => {
    if (!queryText.trim() || loading) return;

    const userMessage = queryText.trim();
    setInput("");
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Multi-turn conversation history
    const history = messages
      .filter((m) => m.content && !m.content.startsWith("ERROR:"))
      .slice(-8)
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage, timestamp: timeNow },
    ]);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage,
          history,
          context: {
            currentTelemetry: telemetry,
            systemMode: telemetry?.mode || "SIMULATED",
            itLoadMW: 100,
            coolantTempHotC: telemetry?.hotTemperature || 48.5,
            coolantTempColdC: telemetry?.coldTemperature || 20.2,
          },
        }),
      });

      const data = await response.json();

      if (data.response) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response,
            source: data.source || "gemini-3.6-flash",
            notice: data.notice,
            timestamp: timeNow,
          },
        ]);
      } else if (data.error) {
        const errorMsg = typeof data.error === "object" ? data.error.message || JSON.stringify(data.error) : String(data.error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `ERROR: ${errorMsg}`,
            source: "system-error",
            timestamp: timeNow,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Could not retrieve an engineering analysis. Please try again.",
            source: "system-error",
            timestamp: timeNow,
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `ERROR: Network connection interrupted (${err?.message || "Failed to fetch"}). Please check connectivity.`,
          source: "network-error",
          timestamp: timeNow,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuery(input);
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Top Header Card */}
      <header className="mb-6 bg-[#08242e]/80 border border-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-teal-400/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <BrainCircuit size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-white tracking-wide">
                THERMORA INTELLIGENCE
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Gemini 3.6 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Autonomous Thermodynamic Modeling & Compute-Water Analysis
            </p>
          </div>
        </div>

        {/* Telemetry pill */}
        <div className="flex items-center gap-3 text-xs">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/30 border border-white/5 text-slate-300">
            <Cpu size={14} className="text-cyan-400" />
            <span>IT Load: 100 MW</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/30 border border-white/5 text-slate-300">
            <Droplets size={14} className="text-emerald-400" />
            <span>Heat: {telemetry?.hotTemperature?.toFixed(1) || "48.5"}°C</span>
          </div>
        </div>
      </header>

      {/* Main Console Window */}
      <div className="flex-1 flex flex-col bg-[#05171f]/80 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        {/* Terminal Sub-header */}
        <div className="bg-[#08222c] border-b border-white/5 px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-mono">
            <Terminal size={14} className="text-cyan-400" />
            <span>MODEL: GEMINI-3.8-FLASH // THERMODYNAMIC REASONING</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400/80" />
            Active Session
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-h-[380px]">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3.5 ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600/30 to-teal-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                  <Bot size={16} className="text-cyan-300" />
                </div>
              )}

              <div
                className={`max-w-[92%] sm:max-w-[82%] space-y-2 ${
                  m.role === "user" ? "items-end flex flex-col" : ""
                }`}
              >
                {/* Message Meta */}
                <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
                  <span>{m.role === "user" ? "OPERATOR" : "THERMORA INTELLIGENCE"}</span>
                  {m.source && (
                    <span className="px-1.5 py-0.2 rounded bg-white/5 text-[10px] text-cyan-300 border border-white/5 font-mono">
                      {m.source}
                    </span>
                  )}
                  {m.timestamp && <span className="opacity-60">{m.timestamp}</span>}
                </div>

                {/* Notice pill if any */}
                {m.notice && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    <Info size={14} className="shrink-0" />
                    <span>{m.notice}</span>
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`relative group rounded-2xl p-4 sm:p-5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-cyan-700/60 to-teal-700/60 text-white border border-cyan-400/30 rounded-tr-sm shadow-md"
                      : "bg-[#09222c]/90 border border-white/10 text-slate-200 rounded-tl-sm shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
                  }`}
                >
                  <div className="font-sans text-sm space-y-2">
                    {m.role === "user" ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <StructuredAnalysisView text={m.content} />
                    )}
                  </div>

                  {/* Copy Button */}
                  {m.role === "assistant" && (
                    <button
                      onClick={() => handleCopy(m.content, i)}
                      className="absolute top-3 right-3 p-1.5 rounded-md bg-black/40 hover:bg-black/60 text-slate-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                      title="Copy response"
                    >
                      {copiedIndex === i ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {m.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-1">
                  <span className="text-xs font-semibold text-cyan-300">OP</span>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3.5 items-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600/30 to-teal-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0 mt-1 animate-pulse">
                <Bot size={16} className="text-cyan-300" />
              </div>
              <div className="bg-[#09222c]/90 border border-white/10 rounded-2xl rounded-tl-sm p-4 text-xs text-slate-300 flex items-center gap-3">
                <RefreshCw size={14} className="text-cyan-400 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2.5 bg-[#061e27] border-t border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap flex items-center gap-1">
            <Sparkles size={12} className="text-cyan-400" /> Suggested:
          </span>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => sendQuery(prompt)}
              disabled={loading}
              className="text-[11px] px-3 py-1 rounded-full bg-white/5 hover:bg-cyan-500/10 text-slate-300 hover:text-cyan-300 border border-white/5 hover:border-cyan-500/20 whitespace-nowrap transition-all disabled:opacity-50"
            >
              {prompt.length > 52 ? `${prompt.slice(0, 52)}...` : prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="p-3 sm:p-4 bg-[#08222c] border-t border-white/10"
        >
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask an engineering query (e.g. 150 MW data center at 90% load, or MD flux at 55°C)..."
              className="w-full bg-[#04141b] border border-white/10 text-white placeholder-slate-500 text-sm pl-4 pr-12 py-3.5 rounded-xl focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all font-sans"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/5 text-slate-950 disabled:text-slate-600 transition-all font-medium disabled:cursor-not-allowed"
            >
              <Send size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Formats the structured engineering response sections with elegant cards */
function StructuredAnalysisView({ text }: { text: string }) {
  const lines = text.split("\n");
  const sections: { title?: string; content: string[] }[] = [];
  let currentSection: { title?: string; content: string[] } = { content: [] };

  const knownHeaders = [
    "ANSWER",
    "WHY",
    "EVIDENCE",
    "CALCULATION",
    "CONFIDENCE",
    "ASSUMPTIONS",
    "ERROR",
  ];

  lines.forEach((rawLine) => {
    const trimmed = rawLine.trim();
    if (trimmed === "---") return; // skip divider lines

    // Check if line starts with header (e.g. "**ANSWER:**", "ANSWER:", "### ANSWER:", etc)
    const normalized = trimmed.replace(/^[\s#*_-]+/, "").replace(/[*_]+$/, "");
    const matchedHeader = knownHeaders.find(
      (h) =>
        normalized.toUpperCase().startsWith(`${h}:`) ||
        normalized.toUpperCase().startsWith(`**${h}:`) ||
        normalized.toUpperCase() === h
    );

    if (matchedHeader) {
      if (currentSection.title || currentSection.content.length > 0) {
        sections.push(currentSection);
      }
      // Extract content after the header
      const rawHeaderIndex = rawLine.toUpperCase().indexOf(matchedHeader);
      const afterHeader = rawLine
        .slice(rawHeaderIndex + matchedHeader.length)
        .replace(/^[:*_\s]+/, "")
        .trim();

      currentSection = {
        title: matchedHeader,
        content: afterHeader ? [afterHeader] : [],
      };
    } else {
      currentSection.content.push(rawLine);
    }
  });

  if (currentSection.title || currentSection.content.length > 0) {
    sections.push(currentSection);
  }

  // Helper to format line text (bold, math, bullets)
  const formatText = (str: string) => {
    // Remove raw LaTeX markers like $$ or \text{}
    const cleaned = str
      .replace(/\$\$(.*?)\$\$/g, "$1")
      .replace(/\\text\{([^}]+)\}/g, "$1")
      .replace(/\\approx/g, "≈")
      .replace(/\\times/g, "×")
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)")
      .replace(/\\cdot/g, "·");

    // Split on **bold**
    const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  // If text didn't follow the structured format, render clean paragraphs
  if (sections.length <= 1 && !sections[0]?.title) {
    return (
      <div className="space-y-2 whitespace-pre-wrap leading-relaxed">
        {lines.map((l, i) => (
          <div key={i}>{formatText(l)}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {sections.map((sec, idx) => {
        const textContent = sec.content.join("\n").trim();
        if (!sec.title && !textContent) return null;

        if (sec.title === "ANSWER") {
          return (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/60 to-teal-950/40 border border-cyan-500/25 shadow-sm"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300 uppercase tracking-wider mb-1.5">
                <Zap size={14} className="text-cyan-400" />
                EXECUTIVE ANSWER
              </div>
              <div className="text-slate-100 font-medium text-sm leading-relaxed space-y-1">
                {sec.content.map((cLine, cIdx) => (
                  <div key={cIdx}>{formatText(cLine)}</div>
                ))}
              </div>
            </div>
          );
        }

        if (sec.title === "CALCULATION") {
          return (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-black/50 border border-white/10 font-mono text-xs text-cyan-200"
            >
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Terminal size={12} className="text-cyan-400" />
                CALCULATION PROOF & BALANCES
              </div>
              <div className="space-y-1 leading-relaxed">
                {sec.content.map((cLine, cIdx) => (
                  <div key={cIdx} className="min-h-[1.2em]">
                    {formatText(cLine)}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const badgeColor =
          sec.title === "ERROR"
            ? "text-red-400 bg-red-950/40 border-red-800/40"
            : sec.title === "CONFIDENCE"
            ? "text-emerald-400 bg-emerald-950/40 border-emerald-800/40"
            : sec.title === "WHY"
            ? "text-cyan-300 bg-cyan-950/40 border-cyan-800/40"
            : "text-slate-300 bg-white/5 border-white/10";

        return (
          <div key={idx} className="space-y-1.5">
            {sec.title && (
              <span
                className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${badgeColor}`}
              >
                {sec.title}
              </span>
            )}
            <div className="text-slate-300 text-xs sm:text-sm leading-relaxed space-y-1">
              {sec.content.map((cLine, cIdx) => (
                <div key={cIdx} className="min-h-[1.2em]">
                  {formatText(cLine)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

