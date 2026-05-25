import * as vscode from "vscode";

function normalizeLocale(locale: string): string {
  return locale.trim().toLowerCase();
}

export function isSimplifiedChineseLocale(
  locale: string = vscode.env.language,
): boolean {
  const normalizedLocale = normalizeLocale(locale);

  return (
    normalizedLocale === "zh" ||
    normalizedLocale.startsWith("zh-cn") ||
    normalizedLocale.startsWith("zh-hans") ||
    normalizedLocale.startsWith("zh-sg")
  );
}

export function localize(
  defaultText: string,
  zhCnText: string,
  locale: string = vscode.env.language,
): string {
  return isSimplifiedChineseLocale(locale) ? zhCnText : defaultText;
}
