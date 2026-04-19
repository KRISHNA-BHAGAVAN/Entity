import { useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { supabase } from "../services/supabaseClient";
import {
  applyToolCallEvent,
  buildRegenerationPayload,
} from "../utils/agentStreamState";

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

const createUserMessage = (content, messageEventIds) => ({
  id: crypto.randomUUID(),
  role: "user",
  content,
  eventIds: messageEventIds || [],
  createdAt: Date.now(),
});

const createAssistantMessage = (assistantId) => ({
  id: assistantId,
  role: "assistant",
  content: "",
  toolCalls: [],
  thinking: "",
  createdAt: Date.now(),
});

export const useAgentStream = ({ eventIds }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [error, setError] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [streamingAssistantId, setStreamingAssistantId] = useState(null);

  const abortRef = useRef(null);

  const canSend = useMemo(() => !isLoading, [isLoading]);

  const runStream = async ({
    content,
    messageEventIds,
    history = null,
    cutoffIndex = null,
  }) => {
    const trimmedContent = (content || "").trim();
    if (!trimmedContent || isLoading) {
      return;
    }

    setError(null);
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    const assistantMessage = createAssistantMessage(assistantId);

    setMessages((prev) => {
      if (typeof cutoffIndex === "number") {
        return [...prev.slice(0, cutoffIndex + 1), assistantMessage];
      }

      return [...prev, createUserMessage(trimmedContent, messageEventIds), assistantMessage];
    });
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
          message: trimmedContent,
          event_ids: messageEventIds,
          thread_id: history ? null : threadId,
          history,
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
              prev.map((message) =>
                message.id === assistantId
                  ? { ...message, content: `${message.content}${event.content || ""}` }
                  : message
              )
            );
            return;
          }

          if (event.type === "thinking") {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? { ...message, thinking: `${message.thinking || ""}${event.content || ""}` }
                  : message
              )
            );
            return;
          }

          if (event.type === "tool_start" || event.type === "tool_end" || event.type === "tool_error") {
            setActiveTool(
              event.type === "tool_end" ? null : event.tool_call?.name || event.content || "tool"
            );
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      toolCalls: applyToolCallEvent(message.toolCalls || [], event),
                    }
                  : message
              )
            );
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

  const sendMessage = async (text) => {
    await runStream({
      content: text,
      messageEventIds: eventIds || [],
    });
  };

  const regenerateMessage = async (assistantMessageId) => {
    const payload = buildRegenerationPayload(messages, assistantMessageId);
    if (!payload || !payload.message) {
      return;
    }

    await runStream({
      content: payload.message,
      messageEventIds: payload.eventIds,
      history: payload.history,
      cutoffIndex: payload.cutoffIndex,
    });
  };

  const stopStreaming = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
    setStreamingAssistantId(null);
    setActiveTool(null);
  };

  const resetConversation = async () => {
    setMessages([]);
    setError(null);
    setActiveTool(null);
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
    streamingAssistantId,
    canSend,
    sendMessage,
    regenerateMessage,
    stopStreaming,
    resetConversation,
  };
};
