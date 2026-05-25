import path from "path";
import { WorkspaceConfiguration, WorkspaceFolder, workspace } from "vscode";

export const CONTINUE_WORKSPACE_KEY = "continue";
export const CONTINUE_DATA_PATH_KEY = "dataPath";

export function getContinueWorkspaceConfig() {
  return workspace.getConfiguration(CONTINUE_WORKSPACE_KEY);
}

export function resolveContinueDataPath(
  config: WorkspaceConfiguration = getContinueWorkspaceConfig(),
  workspaceFolders:
    | readonly WorkspaceFolder[]
    | undefined = workspace.workspaceFolders,
): string | undefined {
  const configuredPath = config.get<string>(CONTINUE_DATA_PATH_KEY)?.trim();
  if (!configuredPath) {
    return undefined;
  }

  if (path.isAbsolute(configuredPath)) {
    return path.resolve(configuredPath);
  }

  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return undefined;
  }

  return path.resolve(workspaceRoot, configuredPath);
}
