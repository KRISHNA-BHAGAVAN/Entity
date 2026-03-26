import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, RotateCcw } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { useAgentStream } from "../hooks/useAgentStream";

const AgentChat = () => {
  const [events, setEvents] = useState([]);
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  const {
    messages,
    isLoading,
    error,
    activeTool,
    canSend,
    sendMessage,
    stopStreaming,
    resetConversation,
  } = useAgentStream({ eventIds: selectedEventIds });

  const endRef = useRef(null);

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
    if (!selectedEventIds.length) return "All accessible events";
    return `${selectedEventIds.length} event(s) selected`;
  }, [selectedEventIds]);

  const toggleEvent = (eventId) => {
    setSelectedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    setPrompt("");
    await sendMessage(text);
  };

  return (
    <div className="h-full min-h-0 flex flex-col p-6 gap-4 overflow-hidden">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shrink-0">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h1 className="text-lg font-semibold text-slate-800">Agent Chat</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetConversation}
              className="px-3 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            {isLoading && (
              <button
                type="button"
                onClick={stopStreaming}
                className="px-3 py-1.5 text-xs rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-3">
          Ask questions about your events and uploaded document markdown. Responses stream token-by-token.
        </p>

        <div className="text-xs font-medium text-slate-600 mb-2">Scope: {selectedLabel}</div>

        <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-md p-2 grid sm:grid-cols-2 gap-2">
          {isLoadingEvents ? (
            <div className="text-sm text-slate-500 inline-flex items-center gap-2">
              <Loader2 className="animate-spin" size={14} /> Loading events...
            </div>
          ) : events.length ? (
            events.map((event) => (
              <label
                key={event.id}
                className="text-xs text-slate-700 inline-flex items-center gap-2 p-1 rounded hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedEventIds.includes(event.id)}
                  onChange={() => toggleEvent(event.id)}
                />
                <span className="truncate">
                  {event.name}
                  {event.event_date ? ` • ${event.event_date}` : ""}
                </span>
              </label>
            ))
          ) : (
            <div className="text-sm text-slate-500">No events found.</div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!messages.length && (
            <div className="text-sm text-slate-500">
              Start by asking something like: "Which documents mention project deadlines?"
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-blue-50 text-blue-900 ml-auto"
                  : "bg-slate-50 text-slate-800"
              }`}
            >
              {message.content || (message.role === "assistant" ? "..." : "")}
            </div>
          ))}

          {isLoading && activeTool && (
            <div className="text-xs text-slate-500 inline-flex items-center gap-1">
              <Loader2 className="animate-spin" size={12} /> Using tool: {activeTool}
            </div>
          )}

          {error && <div className="text-xs text-rose-600">{error}</div>}
          <div ref={endRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-slate-100 p-3 flex items-end gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask about events, document fields, summaries, or tables..."
            className="flex-1 resize-none rounded-md border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            rows={2}
          />
          <button
            type="submit"
            disabled={!prompt.trim() || !canSend}
            className="h-10 px-3 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50 inline-flex items-center gap-1"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default AgentChat;
