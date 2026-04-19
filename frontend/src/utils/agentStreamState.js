const toToolCallId = (toolCall = {}) => toolCall.id || toolCall.name || "tool";

export const applyToolCallEvent = (toolCalls = [], event) => {
  const toolCall = event?.tool_call || {};
  const toolCallId = toToolCallId(toolCall);

  if (event?.type === "tool_start") {
    const nextToolCall = {
      id: toolCallId,
      name: toolCall.name || "tool",
      status: "running",
      input: toolCall.input ?? null,
      output: null,
      error: null,
    };

    const existingIndex = toolCalls.findIndex((entry) => entry.id === toolCallId);
    if (existingIndex === -1) {
      return [...toolCalls, nextToolCall];
    }

    return toolCalls.map((entry, index) => (index === existingIndex ? nextToolCall : entry));
  }

  if (event?.type === "tool_end" || event?.type === "tool_error") {
    const status = event.type === "tool_error" ? "failed" : "completed";
    const existingIndex = toolCalls.findIndex((entry) => entry.id === toolCallId);

    if (existingIndex === -1) {
      return [
        ...toolCalls,
        {
          id: toolCallId,
          name: toolCall.name || "tool",
          status,
          input: toolCall.input ?? null,
          output: toolCall.output ?? null,
          error: toolCall.error ?? null,
        },
      ];
    }

    return toolCalls.map((entry, index) => {
      if (index !== existingIndex) {
        return entry;
      }

      return {
        ...entry,
        status,
        output: toolCall.output ?? entry.output ?? null,
        error: toolCall.error ?? null,
      };
    });
  }

  return toolCalls;
};

export const buildRegenerationPayload = (messages = [], assistantMessageId) => {
  const assistantIndex = messages.findIndex(
    (message) => message.id === assistantMessageId && message.role === "assistant"
  );
  if (assistantIndex === -1) {
    return null;
  }

  let userIndex = assistantIndex - 1;
  while (userIndex >= 0 && messages[userIndex]?.role !== "user") {
    userIndex -= 1;
  }

  if (userIndex < 0) {
    return null;
  }

  return {
    history: messages
      .slice(0, userIndex)
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        content: message.content || "",
      })),
    message: messages[userIndex].content || "",
    eventIds: messages[userIndex].eventIds || [],
    cutoffIndex: userIndex,
  };
};
