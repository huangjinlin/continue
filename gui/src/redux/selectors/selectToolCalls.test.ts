import { ApplyState, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it } from "vitest";
import { RootState } from "../store";
import {
  selectPendingCreateFileToolCalls,
  selectPendingDeferredEditToolCalls,
  selectPendingReviewItems,
} from "./selectToolCalls";

function createToolCallState(overrides: Partial<ToolCallState>): ToolCallState {
  return {
    toolCallId: "tool-call-id",
    status: "generated",
    parsedArgs: {},
    toolCall: {
      id: "tool-call-id",
      type: "function",
      function: {
        name: BuiltInToolNames.CreateNewFile,
        arguments: "{}",
      },
    },
    ...overrides,
  } as ToolCallState;
}

function createApplyState(overrides: Partial<ApplyState>): ApplyState {
  return {
    streamId: "stream-id",
    status: "done",
    filepath: "file:///workspace/src/example.ts",
    ...overrides,
  };
}

function createState({
  toolCallStates = [],
  applyStates = [],
}: {
  toolCallStates?: ToolCallState[];
  applyStates?: ApplyState[];
}): RootState {
  return {
    session: {
      history: [
        {
          message: {
            role: "assistant",
            content: "",
          },
          contextItems: [],
          toolCallStates,
        },
      ],
      codeBlockApplyStates: {
        states: applyStates,
      },
    },
  } as RootState;
}

describe("selectPendingReviewItems", () => {
  it("aggregates done apply states with pending review tool calls", () => {
    const doneApplyState = createApplyState({
      streamId: "apply-stream",
      filepath: "file:///workspace/src/existing.ts",
    });
    const createFileToolCall = createToolCallState({
      toolCallId: "create-file-call",
      parsedArgs: {
        filepath: "src/new-file.ts",
      },
      toolCall: {
        id: "create-file-call",
        type: "function",
        function: {
          name: BuiltInToolNames.CreateNewFile,
          arguments: '{"filepath":"src/new-file.ts"}',
        },
      },
    });
    const runTerminalToolCall = createToolCallState({
      toolCallId: "terminal-call",
      toolCall: {
        id: "terminal-call",
        type: "function",
        function: {
          name: BuiltInToolNames.RunTerminalCommand,
          arguments: '{"command":"echo hi"}',
        },
      },
    });
    const editToolCall = createToolCallState({
      toolCallId: "edit-tool-call",
      parsedArgs: {
        filepath: "src/edited.ts",
      },
      toolCall: {
        id: "edit-tool-call",
        type: "function",
        function: {
          name: BuiltInToolNames.EditExistingFile,
          arguments: '{"filepath":"src/edited.ts","changes":"..."}',
        },
      },
    });

    const state = createState({
      toolCallStates: [createFileToolCall, editToolCall, runTerminalToolCall],
      applyStates: [
        doneApplyState,
        createApplyState({
          streamId: "streaming-apply",
          status: "streaming",
          filepath: "file:///workspace/src/ignored.ts",
        }),
      ],
    });

    expect(selectPendingCreateFileToolCalls(state)).toEqual([
      createFileToolCall,
    ]);
    expect(selectPendingDeferredEditToolCalls(state)).toEqual([editToolCall]);
    expect(selectPendingReviewItems(state)).toEqual([
      {
        key: "apply:apply-stream",
        kind: "apply",
        filepath: "file:///workspace/src/existing.ts",
        applyState: doneApplyState,
      },
      {
        key: "create-file:create-file-call",
        kind: "create-file",
        filepath: "src/new-file.ts",
        toolCallState: createFileToolCall,
      },
      {
        key: "edit-tool:edit-tool-call",
        kind: "edit-tool",
        filepath: "src/edited.ts",
        toolCallState: editToolCall,
      },
    ]);
  });

  it("falls back to an empty filepath when a create file tool call has no parsed filepath", () => {
    const createFileToolCall = createToolCallState({
      toolCallId: "create-without-path",
      parsedArgs: {},
      toolCall: {
        id: "create-without-path",
        type: "function",
        function: {
          name: BuiltInToolNames.CreateNewFile,
          arguments: "{}",
        },
      },
    });

    const state = createState({
      toolCallStates: [createFileToolCall],
    });

    expect(selectPendingReviewItems(state)).toEqual([
      {
        key: "create-file:create-without-path",
        kind: "create-file",
        filepath: "",
        toolCallState: createFileToolCall,
      },
    ]);
  });
});
