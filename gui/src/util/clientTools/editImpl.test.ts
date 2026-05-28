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

  it("does not wait for applyForEditTool dispatch before resolving", async () => {
    mockResolveRelativePathInDir.mockResolvedValue("file:///dir/test/file.txt");

    mockExtras.dispatch = vi.fn().mockImplementation(
      () =>
        new Promise<void>(() => {
          // Keep pending to ensure editToolImpl resolves independently.
        }),
    ) as any;

    const result = await editToolImpl(
      {
        filepath: "file.txt",
        changes: "updated contents",
      },
      "tool-call-id",
      mockExtras,
    );

    expect(mockApplyForEditTool).toHaveBeenCalledWith({
      streamId: "test-uuid",
      text: "updated contents",
      toolCallId: "tool-call-id",
      filepath: "file:///dir/test/file.txt",
    });
    expect(mockExtras.dispatch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      respondImmediately: false,
      output: undefined,
    });
  });
});
