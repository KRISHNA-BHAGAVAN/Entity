import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, RotateCcw, X, ChevronDown, Brain, Wrench, Sparkles, Database } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { useAgentStream } from "../hooks/useAgentStream";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const AgentChat = () => {
  const [events, setEvents] = useState([]);
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [eventQuery, setEventQuery] = useState("");
  const [expandedDetails, setExpandedDetails] = useState({});
  const [activeEventIndex, setActiveEventIndex] = useState(0);

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
  } = useAgentStream({ eventIds: selectedEventIds });

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    const loadEvents = async () => {
      setIsLoadingEvents(true);
      try {
        const { data, error: queryError } = await supabase
          .from("events")
          .select("id, name, event_date, created_at")
          .order("created_at", { ascending: false });

        if (queryError) {
          setEvents([]);
          return;
        }

        setEvents(data || []);
      } finally {
        setIsLoadingEvents(false);
      }
    };

    loadEvents();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const selectedLabel = useMemo(() => {
    if (!selectedEventIds.length) return "All knowledge base";
    return `${selectedEventIds.length} event(s) filtered`;
  }, [selectedEventIds]);

  const selectedEvents = useMemo(
    () => events.filter((event) => selectedEventIds.includes(event.id)),
    [events, selectedEventIds]
  );

  const filteredEvents = useMemo(() => {
    const query = eventQuery.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) => {
      const haystack = `${event.name} ${event.event_date || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [events, eventQuery]);

  const removeEventChip = (eventId) => {
    setSelectedEventIds((prev) => prev.filter((id) => id !== eventId));
  };

  const handleSelectAll = () => {
    setSelectedEventIds(events.map((event) => event.id));
  };

  const handleClearAll = () => {
    setSelectedEventIds([]);
  };

  const closePicker = () => {
    setIsPickerOpen(false);
    setEventQuery("");
    setActiveEventIndex(0);
  };

  const openPickerFromPrompt = (value) => {
    const match = value.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) {
      setIsPickerOpen(false);
      setEventQuery("");
      return;
    }

    setIsPickerOpen(true);
    setEventQuery(match[1] || "");
    setActiveEventIndex(0);
  };

  const applySelectedEventFromPicker = (eventId) => {
    setSelectedEventIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
    setPrompt((prev) => prev.replace(/(?:^|\s)@([^\s@]*)$/, " ").replace(/\s+/g, " ").trimStart());
    closePicker();
    inputRef.current?.focus();
  };

  const toggleDetails = (messageId) => {
    setExpandedDetails((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    closePicker();
    setPrompt("");
    await sendMessage(text);
  };

  const handlePromptChange = (e) => {
    const value = e.target.value;
    setPrompt(value);
    
    // Auto resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
    }

    openPickerFromPrompt(value);
  };

  const handlePromptKeyDown = (e) => {
    if (e.key === "Enter" && e.shiftKey) {
      return;
    }

    if (isPickerOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      if (!filteredEvents.length) return;

      setActiveEventIndex((prev) => {
        if (e.key === "ArrowDown") {
          return (prev + 1) % filteredEvents.length;
        }
        return (prev - 1 + filteredEvents.length) % filteredEvents.length;
      });
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (isPickerOpen && filteredEvents.length) {
        const selected = filteredEvents[activeEventIndex] || filteredEvents[0];
        if (selected) {
          applySelectedEventFromPicker(selected.id);
          return;
        }
      }

      if (prompt.trim() && canSend) {
        handleSubmit(e);
        if (inputRef.current) {
          inputRef.current.style.height = 'auto'; // reset after sending
        }
      }
    }
  };

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!isPickerOpen) return;
      if (pickerRef.current?.contains(event.target)) return;
      if (inputRef.current?.contains(event.target)) return;
      closePicker();
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isPickerOpen]);

  useEffect(() => {
    if (!filteredEvents.length) {
      setActiveEventIndex(0);
      return;
    }

    if (activeEventIndex >= filteredEvents.length) {
      setActiveEventIndex(0);
    }
  }, [filteredEvents, activeEventIndex]);

  const renderActivityIcon = (kind) => {
    if (kind?.startsWith("tool")) return <Wrench size={12} strokeWidth={2.5} className="text-slate-400" />;
    return <Brain size={12} strokeWidth={2.5} className="text-blue-500" />;
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#FCFCFC] font-['Manrope',_sans-serif]">
      {/* Header */}
      <header className="px-5 py-4 flex-none border-b border-black/5 bg-white flex items-center justify-between shadow-[0_2px_12px_rgba(0,0,0,0.01)] relative z-10 w-full">
        <div>
          <h1 className="text-lg font-semibold text-slate-800 tracking-[-0.04em] font-['Bricolage_Grotesque',sans-serif] flex items-center gap-2">
            <Sparkles className="text-blue-600 mb-0.5" size={16} strokeWidth={2.5} />
            <span>Entity Core</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest pl-7">
            Query your events & documentation
          </p>
        </div>

        <div className="flex items-center gap-2">
           <div className="hidden sm:flex items-center px-3 py-1.5 bg-slate-50 border border-black/5 rounded-md text-[10px] font-bold text-slate-500 tracking-wide uppercase">
             <Database size={12} className="mr-1.5 text-slate-400" />
             {selectedLabel}
           </div>
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
               <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-100 to-indigo-50 flex items-center justify-center border border-white shadow-sm shadow-blue-900/5">
                  <Brain size={24} strokeWidth={1.5} className="text-blue-600" />
               </div>
               <div className="space-y-2">
                 <h2 className="text-lg font-medium text-slate-800 font-['Bricolage_Grotesque',sans-serif] tracking-[-0.03em]">How can I assist your research?</h2>
                 <p className="text-xs leading-relaxed text-slate-500 max-w-sm mx-auto font-medium">
                   Ask about specific documents, extract insights from uploaded sources, or type <strong className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-extrabold mx-1 text-xs shadow-sm inline-block translate-y-[1px]">@</strong> to filter by event context.
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
                  <div className="mt-3 border border-blue-100 rounded-lg bg-[#F8FAFC] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleDetails(message.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-blue-700 hover:bg-blue-50/50 transition-colors"
                    >
                      <span className="font-bold flex items-center gap-1.5 uppercase tracking-wide">
                         <Loader2 size={10} className="animate-spin text-blue-500" />
                         Thinking process
                      </span>
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-300 text-blue-400 ${expandedDetails[message.id] ? "rotate-180" : ""}`}
                      />
                    </button>

                    {expandedDetails[message.id] && (
                       <div className="border-t border-blue-100/50 p-2 bg-white/50 space-y-1.5">
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
                <Loader2 size={10} className="animate-spin text-blue-500" />
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
              
              {/* Context chips */}
              {!!selectedEvents.length && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2 pb-0.5">
                  {selectedEvents.map((event) => (
                    <span
                      key={event.id}
                      className="inline-flex items-center gap-1 mt-1 rounded bg-slate-100 border border-slate-200/60 px-2 py-1 text-[10px] font-bold text-slate-700 transition uppercase tracking-wide"
                    >
                      {event.name}
                      <button
                        type="button"
                        onClick={() => removeEventChip(event.id)}
                        className="text-slate-400 hover:text-slate-800 p-0.5 rounded-sm hover:bg-slate-200/50"
                        aria-label={`Remove ${event.name}`}
                      >
                        <X size={10} strokeWidth={3} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Event Picker Dropdown within input area */}
              {isPickerOpen && (
                <div
                  ref={pickerRef}
                  className="absolute bottom-[calc(100%+8px)] left-0 w-72 z-30 rounded-xl border border-black/5 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden animate-fadeIn"
                >
                  <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50/80 border-b border-black/5">
                    <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">Select Event Scope</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={handleSelectAll} className="text-[9px] font-bold text-blue-600 hover:text-blue-800 tracking-wider">
                        ALL
                      </button>
                      <button type="button" onClick={handleClearAll} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 tracking-wider">
                        CLEAR
                      </button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto p-1.5 gdoc-scrollbar custom-scrollbar">
                    {isLoadingEvents ? (
                      <div className="px-3 py-4 text-[10px] text-slate-400 font-bold inline-flex justify-center w-full uppercase tracking-wider items-center gap-1.5">
                        <Loader2 size={12} className="animate-spin" /> Fetching timeline...
                      </div>
                    ) : filteredEvents.length ? (
                      filteredEvents.map((event, index) => {
                        const isSelected = selectedEventIds.includes(event.id);
                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => applySelectedEventFromPicker(event.id)}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                              activeEventIndex === index
                                ? "bg-slate-100 text-slate-900"
                                : isSelected
                                  ? "bg-[#0E121B] text-white"
                                  : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <span className="truncate pr-3 flex flex-col gap-0.5">
                              <span className={isSelected ? "text-white" : ""}>{event.name}</span>
                              {event.event_date && <span className={`text-[9px] font-bold uppercase tracking-widest ${isSelected === true ? "text-slate-300" : "text-slate-400"}`}>{event.event_date}</span>}
                            </span>
                            {isSelected && <span className="text-[8px] uppercase tracking-widest font-extrabold text-[#38bdf8]">Selected</span>}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-4 text-[10px] text-slate-500 font-bold text-center w-full">No results found for query.</div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-end gap-1.5 px-1.5 pb-0.5 pt-0.5">
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={handlePromptChange}
                  onKeyDown={handlePromptKeyDown}
                  placeholder="Ask Entity Core anything... Use @ to reference an event"
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

export default AgentChat;
