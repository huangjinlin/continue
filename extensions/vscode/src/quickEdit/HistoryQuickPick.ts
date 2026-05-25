import { ExtensionContext, QuickPickItem, window } from "vscode";

import { localize } from "../util/localization";

const HISTORY_KEY = "quickEditHistory";
const MAX_HISTORY_LENGTH = 50;

export function appendToHistory(
  prompt: string,
  { globalState }: ExtensionContext,
) {
  let history: string[] = globalState.get(HISTORY_KEY, []);

  // Remove duplicate if exists
  if (history[history.length - 1] === prompt) {
    history = history.slice(0, -1);
  }

  // Add new item
  history.push(prompt);

  // Truncate if over max size
  if (history.length > MAX_HISTORY_LENGTH) {
    history = history.slice(-MAX_HISTORY_LENGTH);
  }

  globalState.update(HISTORY_KEY, history);
}

export async function getHistoryQuickPickVal({
  globalState,
}: ExtensionContext): Promise<string | undefined> {
  const historyItems: QuickPickItem[] = globalState
    .get(HISTORY_KEY, [])
    .map((item) => ({ label: item }))
    .reverse();

  const selectedItem = await window.showQuickPick(historyItems, {
    title: localize("History", "历史记录"),
    placeHolder: localize("Select a previous prompt", "选择一条之前的提示词"),
  });

  return selectedItem?.label;
}
