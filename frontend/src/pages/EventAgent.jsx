import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Send, RotateCcw, ChevronDown, Brain, Wrench, Zap } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { useAgentStream } from "../hooks/useAgentStream";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const EventAgent = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("eventId");

  const [eventName, setEventName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [expandedDetails, setExpandedDetails] = useState({});

  // Lock the agent to this single event
  const eventIds = eventId ? [eventId] : [];

  const {
    messages,
    isLoading,
    error,
    activeTool,
    activityByMessage,
    streamingAssistantId,
    canSend,
    sendMessage,
    stopStreaming,
    resetConversation,
  } = useAgentStream({ eventIds });

  const endRef = useRef(null);
  const inputRef = useRef(null);

  // Load event name
  useEffect(() => {
    if (!eventId) return;
    const loadEvent = async () => {
      const { data } = await supabase
        .from("events")
        .select("name")
        .eq("id", eventId)
        .single();
      if (data) setEventName(data.name);
    };
    loadEvent();
  }, [eventId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const toggleDetails = (messageId) => {
    setExpandedDetails((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    setPrompt("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    await sendMessage(text);
  };

  const handlePromptChange = (e) => {
    const value = e.target.value;
    setPrompt(value);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
    }
  };

  const handlePromptKeyDown = (e) => {
    if (e.key === "Enter" && e.shiftKey) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && canSend) handleSubmit(e);
    }
  };

  const renderActivityIcon = (kind) => {
    if (kind?.startsWith("tool")) return <Wrench size={12} strokeWidth={2.5} className="text-slate-400" />;
    return <Brain size={12} strokeWidth={2.5} className="text-blue-500" />;
  };

  if (!eventId) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-400 font-medium">
        No event selected.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#FCFCFC] font-['Manrope',_sans-serif]">
      {/* Header */}
      <header className="px-5 py-4 flex-none border-b border-black/5 bg-white flex items-center justify-between shadow-[0_2px_12px_rgba(0,0,0,0.01)] relative z-10 w-full">
        <div>
          <h1 className="text-lg font-semibold text-slate-800 tracking-[-0.04em] font-['Bricolage_Grotesque',sans-serif] flex items-center gap-2">
            <Zap className="text-amber-500 mb-0.5" size={16} strokeWidth={2.5} />
            <span>Event Copilot</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest pl-7">
            {eventName || "Loading..."}
          </p>
        </div>

        <div className="flex items-center gap-2">
           {isLoading && (
              <button
                type="button"
                onClick={stopStreaming}
                className="px-3 py-1.5 text-[11px] font-bold rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors uppercase tracking-wider"
              >
                Halt
              </button>
           )}
           <button
              type="button"
              onClick={resetConversation}
              className="p-2 text-slate-400 rounded-md border border-black/5 bg-white hover:text-slate-800 hover:bg-slate-50 transition-all shadow-sm group"
              aria-label="Reset Conversation"
           >
              <RotateCcw size={14} strokeWidth={2} className="group-hover:-rotate-90 transition-transform duration-300" />
           </button>
        </div>
      </header>

      {/* Main chat layout */}
      <div className="flex-1 min-h-0 flex flex-col justify-end w-full max-w-4xl mx-auto relative px-3 sm:px-0">
        <div className="flex-1 overflow-y-auto px-2 py-6 space-y-5 gdoc-scrollbar relative">
          {!messages.length && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-4 animate-fadeIn">
               <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-100 to-orange-50 flex items-center justify-center border border-white shadow-sm shadow-amber-900/5">
                  <Zap size={24} strokeWidth={1.5} className="text-amber-500" />
               </div>
               <div className="space-y-2">
                 <h2 className="text-lg font-medium text-slate-800 font-['Bricolage_Grotesque',sans-serif] tracking-[-0.03em]">What would you like to know?</h2>
                 <p className="text-xs leading-relaxed text-slate-500 max-w-sm mx-auto font-medium">
                   Ask anything about <strong className="text-slate-700">{eventName}</strong> — documents, details, insights, and more.
                 </p>
               </div>
            </div>
          )}

          {messages.map((message) => {
            if (error && message.role === "assistant" && !message.content && streamingAssistantId === message.id) {
              return null;
            }

            return (
            <div key={message.id} className={`flex w-full animate-fadeIn ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`${
                  message.role === "user"
                    ? "max-w-[90%] sm:max-w-[80%] rounded-xl rounded-tr-[4px] px-4 py-3 bg-[#0E121B] text-slate-50 shadow-sm ml-auto"
                    : "w-full py-2"
                } text-sm leading-relaxed relative`}
              >
                {message.content ? (
                   message.role === "assistant" ? (
                     <div className="prose-sm max-w-none break-words">
                       <ReactMarkdown
                         remarkPlugins={[remarkGfm]}
                         components={{
                           table: ({node, ...props}) => <div className="my-4 overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full text-left border-collapse text-xs" {...props} /></div>,
                           thead: ({node, ...props}) => <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 uppercase tracking-widest text-[9px] font-bold" {...props} />,
                           th: ({node, ...props}) => <th className="px-3 py-2 border-r border-slate-100 last:border-r-0 font-bold" {...props} />,
                           td: ({node, ...props}) => <td className="px-3 py-2.5 border-b border-r border-slate-100 last:border-r-0 text-slate-700" {...props} />,
                           tr: ({node, ...props}) => <tr className="last:border-b-0 hover:bg-slate-50/50 transition-colors" {...props} />,
                           code: ({node, inline, className, children, ...props}) => {
                             const match = /language-(\w+)/.exec(className || '')
                             return !inline ? (
                               <div className="my-3 rounded-lg overflow-hidden border border-slate-200/60 bg-[#1e293b] shadow-sm">
                                 {match && (
                                   <div className="flex items-center justify-between px-3 py-1.5 bg-[#0f172a] border-b border-white/10">
                                     <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider hover:text-slate-300">{match[1]}</span>
                                   </div>
                                 )}
                                 <div className="overflow-x-auto p-3 gdoc-scrollbar custom-scrollbar">
                                   <code className="text-[11px] font-mono leading-relaxed text-slate-50" {...props}>{children}</code>
                                 </div>
                               </div>
                             ) : (
                               <code className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-100 border border-slate-200/70 text-rose-600 text-[11px] font-mono align-baseline" {...props}>
                                 {children}
                               </code>
                             )
                           },
                           p: ({node, ...props}) => <p className="mb-3 last:mb-0 text-slate-700 font-medium" {...props} />,
                           h1: ({node, ...props}) => <h1 className="text-lg font-bold text-slate-900 mt-5 mb-3 font-['Bricolage_Grotesque',sans-serif]" {...props} />,
                           h2: ({node, ...props}) => <h2 className="text-base font-bold text-slate-800 mt-4 mb-2 font-['Bricolage_Grotesque',sans-serif]" {...props} />,
                           h3: ({node, ...props}) => <h3 className="text-sm font-bold text-slate-800 mt-4 mb-2 font-['Bricolage_Grotesque',sans-serif]" {...props} />,
                           ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1.5 text-slate-700" {...props} />,
                           ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-slate-700" {...props} />,
                           li: ({node, ...props}) => <li className="pl-1 marker:text-slate-400" {...props} />,
                           a: ({node, ...props}) => <a className="text-blue-600 font-bold hover:text-blue-800 underline decoration-blue-200 underline-offset-4 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
                           blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-slate-200 pl-4 py-1 mb-3 text-slate-500 italic bg-slate-50/50 rounded-r-lg" {...props} />,
                           hr: ({node, ...props}) => <hr className="my-4 border-slate-100" {...props} />
                         }}
                       >
                         {message.content}
                       </ReactMarkdown>
                     </div>
                   ) : (
                     <div className="break-words font-medium">{message.content}</div>
                   )
                ) : (message.role === "assistant" && isLoading && !error ? (
                   <div className="flex items-center gap-1.5 h-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                   </div>
                ) : "")}
                
                {message.role === "assistant" && isLoading && !error && streamingAssistantId === message.id && (activityByMessage[message.id] || []).length > 0 && (
                  <div className="mt-3 border border-amber-100 rounded-lg bg-amber-50/30 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleDetails(message.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-amber-700 hover:bg-amber-50/50 transition-colors"
                    >
                      <span className="font-bold flex items-center gap-1.5 uppercase tracking-wide">
                         <Loader2 size={10} className="animate-spin text-amber-500" />
                         Thinking process
                      </span>
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-300 text-amber-400 ${expandedDetails[message.id] ? "rotate-180" : ""}`}
                      />
                    </button>

                    {expandedDetails[message.id] && (
                       <div className="border-t border-amber-100/50 p-2 bg-white/50 space-y-1.5">
                        {(activityByMessage[message.id] || []).map((entry) => (
                          <div key={entry.id} className="rounded-md border border-black/5 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <div className="flex items-center gap-2 text-[10px] text-slate-600 font-semibold tracking-wide">
                              {renderActivityIcon(entry.kind)}
                              <span>{entry.label}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )})}

          {isLoading && !error && activeTool && (
            <div className="flex justify-center -mb-2 animate-fadeIn">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-black/5 rounded-full shadow-sm text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                <Loader2 size={10} className="animate-spin text-amber-500" />
                Wait, tool in use: <span className="text-slate-800">{activeTool}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="w-full text-center py-2 animate-fadeIn">
              <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-rose-50 text-[10px] text-rose-600 font-bold border border-rose-100 shadow-sm uppercase tracking-wide">
                Error: {error}
              </div>
            </div>
          )}
          <div ref={endRef} className="h-2" />
        </div>

        {/* Input Area */}
        <div className="flex-none pb-5 pt-3 bg-gradient-to-t from-[#FCFCFC] via-[#FCFCFC] to-transparent sticky bottom-0 z-20 px-1 sm:px-0">
           <form onSubmit={handleSubmit} className="flex flex-col gap-0 relative rounded-2xl bg-white border border-black/5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] pb-1.5 pt-1 transition-shadow focus-within:shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
              <div className="flex items-end gap-1.5 px-1.5 pb-0.5 pt-0.5">
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={handlePromptChange}
                  onKeyDown={handlePromptKeyDown}
                  placeholder={`Ask about ${eventName || "this event"}...`}
                  className="flex-1 w-full max-h-32 min-h-[36px] resize-none overflow-y-auto bg-transparent border-none px-3 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 leading-relaxed gdoc-scrollbar custom-scrollbar"
                  rows={1}
                  style={{ height: 'auto' }}
                />
                <button
                  type="submit"
                  disabled={!prompt.trim() || !canSend}
                  className={`h-[32px] w-[32px] mb-1 mr-1 flex-shrink-0 flex items-center justify-center rounded-lg transition-all duration-300 ${
                    prompt.trim() && canSend
                      ? "bg-[#0E121B] text-white shadow-sm hover:bg-black hover:-translate-y-0.5"
                      : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  }`}
                  aria-label="Send message"
                >
                  {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} strokeWidth={2.5} className="ml-0.5" />}
                </button>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
};

export default EventAgent;
