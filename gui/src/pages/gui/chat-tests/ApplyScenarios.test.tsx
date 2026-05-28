import { act, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../../../util/test/render";
import {
  getElementByTestId,
  verifyNotPresentByTestId,
  verifyNotPresentByText,
} from "../../../util/test/utils";
import { Chat } from "../Chat";

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
