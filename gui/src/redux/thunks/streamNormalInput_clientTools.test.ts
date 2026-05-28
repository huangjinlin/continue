import type { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../util/getBaseSystemMessage", () => ({
  getBaseSystemMessage: vi.fn(() => "You are a helpful assistant."),
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

vi.mock("./callToolById", () => ({
  callToolById: vi.fn((args) => args),
}));

import { callToolById } from "./callToolById";
import { executeAutoApprovedToolCalls } from "./streamNormalInput";

function makeGeneratedToolCall(
  toolCallId: string,
  toolName: BuiltInToolNames,
): ToolCallState {
  return {
    toolCallId,
    status: "generated",
    parsedArgs: {},
    toolCall: {
      id: toolCallId,
      type: "function",
      function: {
        name: toolName,
        arguments: "{}",
      },
    },
  };
}

describe("executeAutoApprovedToolCalls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serializes client edit tool calls", async () => {
    const generatedCalls = [
      makeGeneratedToolCall("tool-1", BuiltInToolNames.EditExistingFile),
      makeGeneratedToolCall("tool-2", BuiltInToolNames.MultiEdit),
    ];

    let resolveFirstDispatch:
      | ((value: {
          type: string;
          payload: undefined;
          meta: { requestStatus: "fulfilled" };
        }) => void)
      | undefined;

    const dispatch = vi
      .fn()
      .mockImplementation((action: { toolCallId: string }) => {
        if (action.toolCallId === "tool-1") {
          return new Promise((resolve) => {
            resolveFirstDispatch = resolve;
          });
        }

        return Promise.resolve({
          type: "test/fulfilled",
          payload: undefined,
          meta: { requestStatus: "fulfilled" as const },
        });
      });

    const executionPromise = executeAutoApprovedToolCalls(
      generatedCalls,
      dispatch as any,
      0,
    );

    await Promise.resolve();

    expect(callToolById).toHaveBeenCalledTimes(1);
    expect(callToolById).toHaveBeenCalledWith({
      toolCallId: "tool-1",
      isAutoApproved: true,
      depth: 1,
    });

    resolveFirstDispatch?.({
      type: "test/fulfilled",
      payload: undefined,
      meta: { requestStatus: "fulfilled" },
    });

    await executionPromise;

    expect(callToolById).toHaveBeenCalledTimes(2);
    expect(callToolById).toHaveBeenNthCalledWith(2, {
      toolCallId: "tool-2",
      isAutoApproved: true,
      depth: 1,
    });
  });
});
