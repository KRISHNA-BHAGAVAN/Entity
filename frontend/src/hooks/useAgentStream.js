import { useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { supabase } from "../services/supabaseClient";

const parseSSEBuffer = (buffer) => {
  const events = [];
  const chunks = buffer.split("\n\n");
  const remainder = chunks.pop() || "";

  for (const rawEvent of chunks) {
    const dataLines = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());

    if (!dataLines.length) continue;

    try {
      events.push(JSON.parse(dataLines.join("\n")));
    } catch {
      continue;
    }
  }

  return { events, remainder };
};

export const useAgentStream = ({ eventIds }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [error, setError] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [activityByMessage, setActivityByMessage] = useState({});
  const [streamingAssistantId, setStreamingAssistantId] = useState(null);

  const abortRef = useRef(null);

  const canSend = useMemo(() => !isLoading, [isLoading]);

  const sendMessage = async (text) => {
    const content = (text || "").trim();
    if (!content || isLoading) return;

    setError(null);
    setIsLoading(true);

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      eventIds: eventIds || [],
      createdAt: Date.now(),
    };

    const assistantId = crypto.randomUUID();
    const assistantMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      thinking: "",
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setActivityByMessage((prev) => ({ ...prev, [assistantId]: [] }));
    setStreamingAssistantId(assistantId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error("Authentication required");
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: content,
          event_ids: eventIds,
          thread_id: threadId,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.detail?.message || errorBody?.detail || "Failed to stream response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let sawToolStart = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSSEBuffer(buffer);
        buffer = parsed.remainder;

        parsed.events.forEach((event) => {
          if (event.type === "meta") {
            if (event.thread_id) setThreadId(event.thread_id);
            return;
          }

          if (event.type === "token") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: `${msg.content}${event.content || ""}` }
                  : msg
              )
            );
            return;
          }

          if (event.type === "thinking") {
            const label = (event.content || "Thinking").trim();
            // Store thinking in message for persistence
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, thinking: `${msg.thinking || ""}${event.content || ""}` }
                  : msg
              )
            );
            // Also track in activity for real-time UI
            setActivityByMessage((prev) => ({
              ...prev,
              [assistantId]: [
                ...(prev[assistantId] || []),
                {
                  id: crypto.randomUUID(),
                  kind: "thinking",
                  label,
                  ts: Date.now(),
                },
              ],
            }));
            return;
          }

          if (event.type === "thinking_done") {
            return;
          }

          if (event.type === "tool_start") {
            if (!sawToolStart) {
              sawToolStart = true;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: "" }
                    : msg
                )
              );
            }
            setActiveTool(event.content || "tool");
            setActivityByMessage((prev) => ({
              ...prev,
              [assistantId]: [
                ...(prev[assistantId] || []),
                {
                  id: crypto.randomUUID(),
                  kind: "tool_start",
                  label: `Calling ${event.content || "tool"}`,
                  ts: Date.now(),
                },
              ],
            }));
            return;
          }

          if (event.type === "tool_end") {
            setActiveTool(null);
            setActivityByMessage((prev) => ({
              ...prev,
              [assistantId]: [
                ...(prev[assistantId] || []).filter((entry) =>
                  !(entry.kind === "tool_start" && entry.label === `Calling ${event.content || "tool"}`)
                ),
              ],
            }));
            return;
          }

          if (event.type === "error") {
            setError(event.message || "Agent failed to respond");
          }
        });
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        setError(err.message || "Streaming error");
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
      setActiveTool(null);
      setStreamingAssistantId(null);
    }
  };

  const stopStreaming = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
    setStreamingAssistantId(null);
  };

  const resetConversation = async () => {
    setMessages([]);
    setError(null);
    setActiveTool(null);
    setActivityByMessage({});
    setStreamingAssistantId(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        setThreadId(null);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/chat/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ thread_id: threadId }),
      });

      const payload = await response.json().catch(() => ({}));
      setThreadId(payload.thread_id || null);
    } catch {
      setThreadId(null);
    }
  };

  return {
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
  };
};
