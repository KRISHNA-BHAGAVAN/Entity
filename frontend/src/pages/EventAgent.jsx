import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Send, RotateCcw, Zap } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { useAgentStream } from "../hooks/useAgentStream";
import AssistantResponse from "../components/agent/AssistantResponse";

const EventAgent = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("eventId");

  const [eventName, setEventName] = useState("");
  const [prompt, setPrompt] = useState("");

  // Lock the agent to this single event
  const eventIds = eventId ? [eventId] : [];

  const {
    messages,
    isLoading,
    error,
    streamingAssistantId,
    canSend,
    sendMessage,
    regenerateMessage,
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
                {message.role === "assistant" ? (
                  <AssistantResponse
                    message={message}
                    isStreaming={isLoading && !error && streamingAssistantId === message.id}
                    onRegenerate={regenerateMessage}
                  />
                ) : (
                  <div className="break-words font-medium">{message.content}</div>
                )}
              </div>
            </div>
          )})}

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
