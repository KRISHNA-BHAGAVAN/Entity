import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, RotateCcw, X, Brain, Sparkles, Database } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { useAgentStream } from "../hooks/useAgentStream";
import AssistantResponse from "../components/agent/AssistantResponse";

const AgentChat = () => {
  const [events, setEvents] = useState([]);
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [eventQuery, setEventQuery] = useState("");
  const [activeEventIndex, setActiveEventIndex] = useState(0);

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

        const allEvents = data || [];
        if (allEvents.length === 0) {
          setEvents([]);
          return;
        }

        // Fetch events that have at least one document
        const eventIds = allEvents.map((e) => e.id);
        const { data: templatesData, error: templatesError } = await supabase
          .from("templates")
          .select("event_id")
          .in("event_id", eventIds);

        if (templatesError) {
          setEvents([]);
          return;
        }

        // Build set of event IDs that have documents
        const eventIdsWithDocs = new Set(templatesData?.map((t) => t.event_id) || []);

        // Filter events to only those with documents
        const eventsWithDocs = allEvents.filter((event) => eventIdsWithDocs.has(event.id));
        setEvents(eventsWithDocs);
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
                {message.role === "assistant" ? (
                  <AssistantResponse
                    message={message}
                    isStreaming={isLoading && !error && streamingAssistantId === message.id}
                    onRegenerate={regenerateMessage}
                  />
                ) : (
                  <div className="break-words font-medium">
                    {message.eventIds?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {message.eventIds.map((eventId) => {
                          const event = events.find((entry) => entry.id === eventId);
                          if (!event) return null;
                          return (
                            <span
                              key={eventId}
                              className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-bold uppercase tracking-wide"
                            >
                              {event.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {message.content}
                  </div>
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
