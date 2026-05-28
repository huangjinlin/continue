import { describe, expect, it, vi } from "vitest";

vi.mock("../extension/EditOutcomeTracker", () => ({
  editOutcomeTracker: {
    recordEditOutcome: vi.fn().mockResolvedValue(undefined),
  },
}));

import { processDiff } from "./processDiff";

describe("processDiff", () => {
  it("does not cancel all applies when rejecting a specific file", async () => {
    const fileUri = "file:///workspace/src/one.ts";
    const sidebar = {
      webviewProtocol: {
        request: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
    const ide = {
      getCurrentFile: vi.fn().mockResolvedValue({ path: fileUri }),
      openFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue("const value = 1;\n"),
      saveFile: vi.fn().mockResolvedValue(undefined),
    } as any;
    const core = {
      invoke: vi.fn().mockResolvedValue(undefined),
    } as any;
    const verticalDiffManager = {
      clearForfileUri: vi.fn(),
      getStreamIdForFile: vi.fn().mockReturnValue("stream-1"),
      getToolCallIdForFile: vi.fn().mockReturnValue("tool-1"),
    } as any;

    await processDiff(
      "reject",
      sidebar,
      ide,
      core,
      verticalDiffManager,
      fileUri,
      "stream-1",
      "tool-1",
    );

    expect(core.invoke).not.toHaveBeenCalledWith("cancelApply", undefined);
    expect(verticalDiffManager.clearForfileUri).toHaveBeenCalledWith(
      fileUri,
      false,
    );
    expect(sidebar.webviewProtocol.request).toHaveBeenCalledWith(
      "updateApplyState",
      expect.objectContaining({
        filepath: fileUri,
        streamId: "stream-1",
        status: "closed",
        accepted: false,
      }),
    );
  });

  it("still cancels the active apply when reject is invoked without a target file", async () => {
    const fileUri = "file:///workspace/src/current.ts";
    const sidebar = {
      webviewProtocol: {
        request: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
    const ide = {
      getCurrentFile: vi.fn().mockResolvedValue({ path: fileUri }),
      openFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue("const value = 1;\n"),
      saveFile: vi.fn().mockResolvedValue(undefined),
    } as any;
    const core = {
      invoke: vi.fn().mockResolvedValue(undefined),
    } as any;
    const verticalDiffManager = {
      clearForfileUri: vi.fn(),
      getStreamIdForFile: vi.fn().mockReturnValue(undefined),
      getToolCallIdForFile: vi.fn().mockReturnValue(undefined),
    } as any;

    await processDiff("reject", sidebar, ide, core, verticalDiffManager);

    expect(core.invoke).toHaveBeenCalledWith("cancelApply", undefined);
  });
});
