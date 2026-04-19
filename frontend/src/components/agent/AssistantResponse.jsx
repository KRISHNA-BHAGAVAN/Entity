import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Check,
  ChevronDown,
  Copy,
  Loader2,
  RotateCcw,
  TerminalSquare,
} from "lucide-react";

const STATUS_STYLES = {
  running: "border-amber-200 bg-amber-50 text-amber-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
};

const stringifyToolPayload = (value) => {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const ActionButton = ({ title, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
  >
    {children}
  </button>
);

const ToolCallCard = ({ toolCall, expanded, onToggle }) => {
  const statusClassName = STATUS_STYLES[toolCall.status] || "border-slate-200 bg-slate-50 text-slate-600";
  const formattedInput = stringifyToolPayload(toolCall.input);
  const formattedOutput = stringifyToolPayload(toolCall.output);
  const formattedError = stringifyToolPayload(toolCall.error);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            {toolCall.status === "running" ? (
              <Loader2 size={14} className="animate-spin text-amber-500" />
            ) : (
              <TerminalSquare size={14} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Tool Call
            </p>
            <p className="truncate text-sm font-semibold text-slate-800">{toolCall.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClassName}`}>
            {toolCall.status}
          </span>
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 space-y-3">
          {formattedInput && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Arguments</p>
              <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 px-3 py-3 text-[11px] leading-relaxed text-slate-100">
                {formattedInput}
              </pre>
            </div>
          )}

          {formattedOutput && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Result</p>
              <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] leading-relaxed text-slate-700">
                {formattedOutput}
              </pre>
            </div>
          )}

          {formattedError && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400">Error</p>
              <pre className="overflow-x-auto rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-[11px] leading-relaxed text-rose-700">
                {formattedError}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const markdownComponents = {
  table: ({ node: _node, ...props }) => {
    void _node;
    return (
      <div className="my-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-xs" {...props} />
      </div>
    );
  },
  thead: ({ node: _node, ...props }) => {
    void _node;
    return (
      <thead
        className="border-b border-slate-200 bg-[#f8fafc] text-[9px] font-bold uppercase tracking-widest text-slate-600"
        {...props}
      />
    );
  },
  th: ({ node: _node, ...props }) => {
    void _node;
    return <th className="border-r border-slate-100 px-3 py-2 font-bold last:border-r-0" {...props} />;
  },
  td: ({ node: _node, ...props }) => {
    void _node;
    return <td className="border-b border-r border-slate-100 px-3 py-2.5 text-slate-700 last:border-r-0" {...props} />;
  },
  tr: ({ node: _node, ...props }) => {
    void _node;
    return <tr className="last:border-b-0 hover:bg-slate-50/50" {...props} />;
  },
  code: ({ node: _node, inline, className, children, ...props }) => {
    void _node;
    const match = /language-(\w+)/.exec(className || "");

    if (!inline) {
      return (
        <div className="my-3 overflow-hidden rounded-lg border border-slate-200/60 bg-[#1e293b] shadow-sm">
          {match && (
            <div className="flex items-center justify-between border-b border-white/10 bg-[#0f172a] px-3 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{match[1]}</span>
            </div>
          )}
          <div className="overflow-x-auto p-3 gdoc-scrollbar custom-scrollbar">
            <code className="font-mono text-[11px] leading-relaxed text-slate-50" {...props}>
              {children}
            </code>
          </div>
        </div>
      );
    }

    return (
      <code
        className="mx-0.5 rounded border border-slate-200/70 bg-slate-100 px-1.5 py-0.5 align-baseline font-mono text-[11px] text-rose-600"
        {...props}
      >
        {children}
      </code>
    );
  },
  p: ({ node: _node, ...props }) => {
    void _node;
    return <p className="mb-3 text-slate-700 last:mb-0" {...props} />;
  },
  h1: ({ node: _node, ...props }) => {
    void _node;
    return <h1 className="mt-5 mb-3 font-['Bricolage_Grotesque',sans-serif] text-lg font-bold text-slate-900" {...props} />;
  },
  h2: ({ node: _node, ...props }) => {
    void _node;
    return <h2 className="mt-4 mb-2 font-['Bricolage_Grotesque',sans-serif] text-base font-bold text-slate-800" {...props} />;
  },
  h3: ({ node: _node, ...props }) => {
    void _node;
    return <h3 className="mt-4 mb-2 font-['Bricolage_Grotesque',sans-serif] text-sm font-bold text-slate-800" {...props} />;
  },
  ul: ({ node: _node, ...props }) => {
    void _node;
    return <ul className="mb-3 list-disc space-y-1.5 pl-5 text-slate-700" {...props} />;
  },
  ol: ({ node: _node, ...props }) => {
    void _node;
    return <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-slate-700" {...props} />;
  },
  li: ({ node: _node, ...props }) => {
    void _node;
    return <li className="pl-1 marker:text-slate-400" {...props} />;
  },
  a: ({ node: _node, ...props }) => {
    void _node;
    return (
      <a
        className="font-bold text-blue-600 underline decoration-blue-200 underline-offset-4 transition-colors hover:text-blue-800"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    );
  },
  blockquote: ({ node: _node, ...props }) => {
    void _node;
    return <blockquote className="mb-3 rounded-r-lg border-l-4 border-slate-200 bg-slate-50/50 py-1 pl-4 italic text-slate-500" {...props} />;
  },
  hr: ({ node: _node, ...props }) => {
    void _node;
    return <hr className="my-4 border-slate-100" {...props} />;
  },
};

const AssistantResponse = ({ message, isStreaming, onRegenerate }) => {
  const [expandedToolCalls, setExpandedToolCalls] = useState({});
  const [copied, setCopied] = useState(false);

  const toolCalls = message.toolCalls || [];

  const toggleToolCall = (toolCallId) => {
    setExpandedToolCalls((current) => ({
      ...current,
      [toolCallId]: !current[toolCallId],
    }));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      {toolCalls.length > 0 && (
        <div className="space-y-2.5">
          {toolCalls.map((toolCall) => (
            <ToolCallCard
              key={toolCall.id}
              toolCall={toolCall}
              expanded={!!expandedToolCalls[toolCall.id]}
              onToggle={() => toggleToolCall(toolCall.id)}
            />
          ))}
        </div>
      )}

      {message.content ? (
        <div className="prose-sm max-w-none break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>
      ) : isStreaming && toolCalls.length === 0 ? (
        <div className="flex h-4 items-center gap-1.5">
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: "0ms" }} />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: "300ms" }} />
        </div>
      ) : null}

      {message.content && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <ActionButton title="Copy markdown response" onClick={handleCopy}>
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          </ActionButton>
          <ActionButton title="Regenerate response" onClick={() => onRegenerate?.(message.id)}>
            <RotateCcw size={14} />
          </ActionButton>
        </div>
      )}
    </div>
  );
};

export default AssistantResponse;
