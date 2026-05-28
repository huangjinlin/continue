import { act, waitFor, within } from "@testing-library/react";
import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { updateHistoryItemAtIndex } from "../../../redux/slices/sessionSlice";
import { callToolById } from "../../../redux/thunks/callToolById";
import { cancelToolCallThunk } from "../../../redux/thunks/cancelToolCall";
import { renderWithProviders } from "../../../util/test/render";
import {
  getElementByTestId,
  verifyNotPresentByTestId,
  verifyNotPresentByText,
} from "../../../util/test/utils";
import { Chat } from "../Chat";

vi.mock("../../../redux/thunks/callToolById", () => ({
  callToolById: vi.fn((payload: { toolCallId: string }) => ({
    type: "chat/callTool",
    payload,
  })),
}));

vi.mock("../../../redux/thunks/cancelToolCall", () => ({
  cancelToolCallThunk: vi.fn((payload: { toolCallId: string }) => ({
    type: "chat/cancelToolCall",
    payload,
  })),
}));

function createPendingCreateFileToolCall(
  toolCallId: string,
  filepath: string,
): ToolCallState {
  return {
    toolCallId,
    status: "generated",
    parsedArgs: {
      filepath,
      contents: `// ${filepath}`,
    },
    toolCall: {
      id: toolCallId,
      type: "function",
      function: {
        name: BuiltInToolNames.CreateNewFile,
        arguments: JSON.stringify({
          filepath,
          contents: `// ${filepath}`,
        }),
      },
    },
  } as ToolCallState;
}

function createPendingEditToolCall(
  toolCallId: string,
  filepath: string,
): ToolCallState {
  return {
    toolCallId,
    status: "generated",
    parsedArgs: {
      filepath,
      changes: "// edit",
    },
    toolCall: {
      id: toolCallId,
      type: "function",
      function: {
        name: BuiltInToolNames.EditExistingFile,
        arguments: JSON.stringify({
          filepath,
          changes: "// edit",
        }),
      },
    },
  } as ToolCallState;
}

async function seedPendingCreateFileToolCalls(
  store: { dispatch: (action: unknown) => unknown },
  toolCallStates: ToolCallState[],
) {
  await act(async () => {
    store.dispatch(
      updateHistoryItemAtIndex({
        index: 0,
        updates: {
          message: {
            id: "assistant-pending-create-files",
            role: "assistant",
            content: "",
            toolCalls: toolCallStates.map(
              (toolCallState) => toolCallState.toolCall,
            ),
          },
          contextItems: [],
          toolCallStates,
        },
      }),
    );
  });
}

async function getPendingFileRowByName(fileBasename: string) {
  await waitFor(() => {
    expect(
      document.querySelectorAll('[data-testid="pending-apply-file"]'),
    ).not.toHaveLength(0);
  });

  const fileRows = Array.from(
    document.querySelectorAll('[data-testid="pending-apply-file"]'),
  );
  const matchingRow = fileRows.find((row) =>
    row.textContent?.includes(fileBasename),
  );

  expect(matchingRow).toBeDefined();
  return matchingRow as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("Chat apply scenarios: handle apply updates and display the accept / reject all buttons", async () => {
  const { ideMessenger } = await renderWithProviders(<Chat />);

  // Use queryByText which returns null when element isn't found
  await verifyNotPresentByText("Accept All");
  await verifyNotPresentByText("Reject All");

  for (let i = 0; i < 5; i++) {
    ideMessenger.mockMessageToWebview("updateApplyState", {
      status: "streaming",
      streamId: `12345`,
    });
  }

  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "done",
    streamId: "12345",
  });

  // Wait for the buttons to appear
  await getElementByTestId("accept-reject-all-buttons");

  // IDE sends back message that it is done
  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "closed",
    streamId: "12345",
  });

  // Wait for the buttons to disappear
  await verifyNotPresentByTestId("edit-accept-button");
  await verifyNotPresentByTestId("edit-reject-button");
});

test("Chat apply scenarios: show apply cancellation", async () => {
  const { ideMessenger } = await renderWithProviders(<Chat />);

  // Spy on the request method of ideMessenger
  const messengerPostSpy = vi.spyOn(ideMessenger, "post");

  for (let i = 0; i < 5; i++) {
    ideMessenger.mockMessageToWebview("updateApplyState", {
      status: "streaming",
      streamId: `12345`,
    });
  }

  // Wait for applying toolbar to appear
  await getElementByTestId("notch-applying-text");

  await act(async () => {
    const cancelApplyButton = await getElementByTestId(
      "notch-applying-cancel-button",
    );
    cancelApplyButton.click();
  });

  // Verify that rejectDiff message has been posted to ideMessenger
  expect(messengerPostSpy).toHaveBeenCalledWith("rejectDiff", {});

  // Now simulate the IDE sending back a message that the apply state is closed
  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "closed",
    streamId: "12345",
  });

  await verifyNotPresentByTestId("notch-applying-text");
  await verifyNotPresentByTestId("notch-applying-cancel-button");

  // Cleanup spy
  messengerPostSpy.mockRestore();
});

test("Chat apply scenarios: display global accept all for multiple pending files", async () => {
  const { ideMessenger } = await renderWithProviders(<Chat />);

  const messengerPostSpy = vi.spyOn(ideMessenger, "post");

  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "done",
    streamId: "stream-1",
    filepath: "src/one.ts",
  });

  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "done",
    streamId: "stream-2",
    filepath: "src/two.ts",
  });

  const globalActions = await getElementByTestId(
    "pending-apply-global-actions",
  );
  expect(globalActions.textContent).toContain("2 pending files");
  expect(
    document.querySelectorAll('[data-testid="accept-reject-all-buttons"]'),
  ).toHaveLength(1);
  expect(
    document.querySelectorAll('[data-testid="pending-apply-file"]'),
  ).toHaveLength(2);
  const acceptButton = within(globalActions).getByTestId("edit-accept-button");

  await act(async () => {
    acceptButton.click();
  });

  expect(messengerPostSpy).toHaveBeenCalledWith("acceptDiff", {
    filepath: "src/one.ts",
    streamId: "stream-1",
  });
  expect(messengerPostSpy).toHaveBeenCalledWith("acceptDiff", {
    filepath: "src/two.ts",
    streamId: "stream-2",
  });

  messengerPostSpy.mockRestore();
});

test("Chat apply scenarios: display per-file accept and reject actions", async () => {
  const { ideMessenger } = await renderWithProviders(<Chat />);

  const messengerPostSpy = vi.spyOn(ideMessenger, "post");

  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "done",
    streamId: "stream-1",
    filepath: "src/one.ts",
  });

  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "done",
    streamId: "stream-2",
    filepath: "src/two.ts",
  });

  await waitFor(() => {
    expect(
      document.querySelectorAll('[data-testid="pending-apply-file"]'),
    ).toHaveLength(2);
  });
  const fileRows = document.querySelectorAll(
    '[data-testid="pending-apply-file"]',
  );

  await act(async () => {
    within(fileRows[0] as HTMLElement)
      .getByTestId("pending-apply-file-accept-button")
      .click();
  });

  const acceptCalls = messengerPostSpy.mock.calls.filter(
    ([message]) => message === "acceptDiff",
  );
  expect(acceptCalls).toEqual([
    [
      "acceptDiff",
      {
        filepath: "src/one.ts",
        streamId: "stream-1",
      },
    ],
  ]);

  messengerPostSpy.mockRestore();
});

test("Chat apply scenarios: clicking a pending file opens it in the editor", async () => {
  const { ideMessenger } = await renderWithProviders(<Chat />);

  const messengerPostSpy = vi.spyOn(ideMessenger, "post");

  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "done",
    streamId: "stream-1",
    filepath: "src/one.ts",
  });

  const fileRow = await getElementByTestId("pending-apply-file");

  await act(async () => {
    within(fileRow).getByTestId("pending-apply-file-name").click();
  });

  expect(messengerPostSpy).toHaveBeenCalledWith("showFile", {
    filepath: "src/one.ts",
  });

  messengerPostSpy.mockRestore();
});

test("Chat apply scenarios: display global accept all for multiple pending create files", async () => {
  const { store } = await renderWithProviders(<Chat />);

  await seedPendingCreateFileToolCalls(store, [
    createPendingCreateFileToolCall("create-file-1", "src/new-one.ts"),
    createPendingCreateFileToolCall("create-file-2", "src/new-two.ts"),
  ]);

  const globalActions = await getElementByTestId(
    "pending-apply-global-actions",
  );
  expect(globalActions.textContent).toContain("2 pending files");
  expect(
    document.querySelectorAll('[data-testid="accept-reject-all-buttons"]'),
  ).toHaveLength(1);
  expect(
    document.querySelectorAll('[data-testid="pending-apply-file"]'),
  ).toHaveLength(2);

  await act(async () => {
    within(globalActions).getByTestId("edit-accept-button").click();
  });

  expect(callToolById).toHaveBeenNthCalledWith(1, {
    toolCallId: "create-file-1",
  });
  expect(callToolById).toHaveBeenNthCalledWith(2, {
    toolCallId: "create-file-2",
  });
  expect(cancelToolCallThunk).not.toHaveBeenCalled();
});

test("Chat apply scenarios: mixed global reject handles create and apply items together", async () => {
  const { ideMessenger, store } = await renderWithProviders(<Chat />);

  const messengerPostSpy = vi.spyOn(ideMessenger, "post");

  await seedPendingCreateFileToolCalls(store, [
    createPendingCreateFileToolCall("create-file-1", "src/new-one.ts"),
  ]);

  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "done",
    streamId: "apply-stream-1",
    filepath: "src/existing.ts",
  });

  const globalActions = await getElementByTestId(
    "pending-apply-global-actions",
  );
  expect(globalActions.textContent).toContain("2 pending files");
  expect(
    document.querySelectorAll('[data-testid="pending-apply-file"]'),
  ).toHaveLength(2);

  await act(async () => {
    within(globalActions).getByTestId("edit-reject-button").click();
  });

  expect(cancelToolCallThunk).toHaveBeenCalledWith({
    toolCallId: "create-file-1",
  });
  expect(messengerPostSpy).toHaveBeenCalledWith("rejectDiff", {
    filepath: "src/existing.ts",
    streamId: "apply-stream-1",
  });

  messengerPostSpy.mockRestore();
});

test("Chat apply scenarios: mixed per-file actions target only the matching item type", async () => {
  const { ideMessenger, store } = await renderWithProviders(<Chat />);

  const messengerPostSpy = vi.spyOn(ideMessenger, "post");

  await seedPendingCreateFileToolCalls(store, [
    createPendingCreateFileToolCall("create-file-1", "src/new-one.ts"),
  ]);

  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "done",
    streamId: "apply-stream-1",
    filepath: "src/existing.ts",
  });

  const createFileRow = await getPendingFileRowByName("new-one.ts");
  const applyFileRow = await getPendingFileRowByName("existing.ts");

  await act(async () => {
    within(createFileRow)
      .getByTestId("pending-apply-file-accept-button")
      .click();
  });

  expect(callToolById).toHaveBeenCalledWith({
    toolCallId: "create-file-1",
  });
  const acceptDiffCalls = messengerPostSpy.mock.calls.filter(
    ([message]) => message === "acceptDiff",
  );
  expect(acceptDiffCalls).toHaveLength(0);

  await act(async () => {
    within(applyFileRow)
      .getByTestId("pending-apply-file-reject-button")
      .click();
  });

  expect(messengerPostSpy).toHaveBeenCalledWith("rejectDiff", {
    filepath: "src/existing.ts",
    streamId: "apply-stream-1",
  });

  messengerPostSpy.mockRestore();
});

test("Chat apply scenarios: mixed create and edit tool calls use the unified review toolbar first", async () => {
  const { store } = await renderWithProviders(<Chat />);

  await seedPendingCreateFileToolCalls(store, [
    createPendingCreateFileToolCall("create-file-1", "src/new-one.ts"),
    createPendingEditToolCall("edit-tool-1", "src/existing.ts"),
  ]);

  const globalActions = await getElementByTestId(
    "pending-apply-global-actions",
  );

  expect(globalActions.textContent).toContain("2 pending files");
  expect(
    document.querySelectorAll('[data-testid="pending-apply-file"]'),
  ).toHaveLength(2);
  expect(
    document.querySelectorAll('[data-testid^="accept-tool-call-button-"]'),
  ).toHaveLength(0);
  expect(
    document.querySelectorAll('[data-testid^="reject-tool-call-button-"]'),
  ).toHaveLength(0);

  const editFileRow = await getPendingFileRowByName("existing.ts");

  await act(async () => {
    within(editFileRow).getByTestId("pending-apply-file-accept-button").click();
  });

  expect(callToolById).toHaveBeenCalledWith({
    toolCallId: "edit-tool-1",
  });
});
