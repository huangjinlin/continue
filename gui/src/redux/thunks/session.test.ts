import { describe, expect, it } from "vitest";
import {
  getDerivedSessionTitle,
  getHistoryBeforeAssistantInteraction,
} from "./session";

describe("getDerivedSessionTitle", () => {
  it("should append the fixed derived suffix to the source title", () => {
    expect(getDerivedSessionTitle("需求讨论")).toBe("需求讨论（派生）");
  });

  it("should not append the suffix twice", () => {
    expect(getDerivedSessionTitle("需求讨论（派生）")).toBe("需求讨论（派生）");
  });
});

describe("getHistoryBeforeAssistantInteraction", () => {
  it("should exclude the current interaction when deriving a conversation", () => {
    const history = [
      {
        message: {
          role: "user" as const,
          content: "Question 1",
          id: "user-1",
        },
        contextItems: [],
      },
      {
        message: {
          role: "assistant" as const,
          content: "Answer 1",
          id: "assistant-1",
        },
        contextItems: [],
      },
      {
        message: {
          role: "user" as const,
          content: "Question 2",
          id: "user-2",
        },
        contextItems: [],
      },
      {
        message: {
          role: "thinking" as const,
          content: "Thinking 2",
          id: "thinking-2",
        },
        contextItems: [],
      },
      {
        message: {
          role: "tool" as const,
          content: "Tool result 2",
          id: "tool-2",
          toolCallId: "tool-call-2",
        },
        contextItems: [],
      },
      {
        message: {
          role: "assistant" as const,
          content: "Answer 2",
          id: "assistant-2",
        },
        contextItems: [],
      },
    ];

    const result = getHistoryBeforeAssistantInteraction(history, 5);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.message.content)).toEqual([
      "Question 1",
      "Answer 1",
    ]);
  });

  it("should return an empty history when there is no prior interaction", () => {
    const history = [
      {
        message: {
          role: "user" as const,
          content: "Question 1",
          id: "user-1",
        },
        contextItems: [],
      },
      {
        message: {
          role: "assistant" as const,
          content: "Answer 1",
          id: "assistant-1",
        },
        contextItems: [],
      },
    ];

    expect(getHistoryBeforeAssistantInteraction(history, 1)).toEqual([]);
  });
});
