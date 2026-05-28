import * as ideUtils from "core/util/ideUtils";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolExtras } from "./callClientTool";
import { editToolImpl } from "./editImpl";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid"),
}));

vi.mock("core/util/ideUtils", () => ({
  resolveRelativePathInDir: vi.fn(),
}));

vi.mock("../../redux/thunks/handleApplyStateUpdate", () => ({
  applyForEditTool: vi.fn(),
}));

describe("editToolImpl", () => {
  let mockExtras: ClientToolExtras;
  let mockResolveRelativePathInDir: Mock;
  let mockApplyForEditTool: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockResolveRelativePathInDir = vi.mocked(ideUtils.resolveRelativePathInDir);
    mockApplyForEditTool = vi.mocked(applyForEditTool);

    mockExtras = {
      getState: vi.fn(() => ({})) as any,
      dispatch: vi.fn() as any,
      ideMessenger: {
        ide: {
          getOpenFiles: vi.fn().mockResolvedValue([]),
        },
        request: vi.fn(),
      } as any,
    };
  });

  it("waits for applyForEditTool dispatch before resolving", async () => {
    mockResolveRelativePathInDir.mockResolvedValue("file:///dir/test/file.txt");

    let resolveDispatch: (() => void) | undefined;
    mockExtras.dispatch = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDispatch = resolve;
        }),
    ) as any;

    const pendingResult = editToolImpl(
      {
        filepath: "file.txt",
        changes: "updated contents",
      },
      "tool-call-id",
      mockExtras,
    );

    await Promise.resolve();

    expect(mockApplyForEditTool).toHaveBeenCalledWith({
      streamId: "test-uuid",
      text: "updated contents",
      toolCallId: "tool-call-id",
      filepath: "file:///dir/test/file.txt",
    });
    await vi.waitFor(() => {
      expect(mockExtras.dispatch).toHaveBeenCalledTimes(1);
    });

    let hasResolved = false;
    void pendingResult.then(() => {
      hasResolved = true;
    });

    await Promise.resolve();
    expect(hasResolved).toBe(false);

    resolveDispatch?.();

    await expect(pendingResult).resolves.toEqual({
      respondImmediately: false,
      output: undefined,
    });
  });
});
