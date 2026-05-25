import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getConfiguration = vi.fn();
const workspaceState = {
  getConfiguration,
  workspaceFolders: undefined as any,
};

vi.mock("vscode", () => ({
  workspace: workspaceState,
}));

describe("resolveContinueDataPath", () => {
  beforeEach(() => {
    vi.resetModules();
    getConfiguration.mockReset();
    workspaceState.workspaceFolders = undefined;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("resolves relative paths from the first workspace folder", async () => {
    const workspaceRoot = path.join("workspace", "project");
    const configuredPath = path.join(".continue", "state");

    getConfiguration.mockReturnValue({
      get: vi.fn().mockReturnValue(configuredPath),
    } as any);
    workspaceState.workspaceFolders = [
      { uri: { fsPath: workspaceRoot } },
    ] as any;

    const { resolveContinueDataPath } = await import("./workspaceConfig");

    expect(resolveContinueDataPath()).toBe(
      path.resolve(workspaceRoot, configuredPath),
    );
  });

  it("returns absolute paths unchanged", async () => {
    const absolutePath = path.resolve(path.join("custom", "continue-data"));

    getConfiguration.mockReturnValue({
      get: vi.fn().mockReturnValue(absolutePath),
    } as any);

    const { resolveContinueDataPath } = await import("./workspaceConfig");

    expect(resolveContinueDataPath()).toBe(absolutePath);
  });

  it("returns undefined for relative paths without a workspace", async () => {
    getConfiguration.mockReturnValue({
      get: vi.fn().mockReturnValue(path.join(".continue", "state")),
    } as any);

    const { resolveContinueDataPath } = await import("./workspaceConfig");

    expect(resolveContinueDataPath()).toBeUndefined();
  });
});
