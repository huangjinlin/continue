import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  env: {
    language: "en",
  },
}));

import { isSimplifiedChineseLocale, localize } from "./localization";

describe("localization", () => {
  it("detects simplified Chinese locales", () => {
    expect(isSimplifiedChineseLocale("zh")).toBe(true);
    expect(isSimplifiedChineseLocale("zh-CN")).toBe(true);
    expect(isSimplifiedChineseLocale("zh-Hans")).toBe(true);
    expect(isSimplifiedChineseLocale("zh-SG")).toBe(true);
  });

  it("does not treat other locales as simplified Chinese", () => {
    expect(isSimplifiedChineseLocale("en")).toBe(false);
    expect(isSimplifiedChineseLocale("ja")).toBe(false);
    expect(isSimplifiedChineseLocale("zh-TW")).toBe(false);
  });

  it("returns translated text only for simplified Chinese locales", () => {
    expect(localize("Open settings", "打开设置", "zh-CN")).toBe("打开设置");
    expect(localize("Open settings", "打开设置", "en-US")).toBe(
      "Open settings",
    );
  });
});
