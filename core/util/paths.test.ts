import fs from "fs";
import path from "path";

import {
  getContinueGlobalPath,
  resetContinueGlobalPathOverride,
  setContinueGlobalPathOverride,
} from "./paths";

describe("Continue global path overrides", () => {
  const defaultContinuePath = process.env.CONTINUE_GLOBAL_DIR!;
  const overridePath = path.join(defaultContinuePath, "workspace-data");

  afterEach(() => {
    resetContinueGlobalPathOverride();
    fs.rmSync(overridePath, { recursive: true, force: true });
  });

  test("uses the override when one is configured", () => {
    setContinueGlobalPathOverride(overridePath);

    expect(getContinueGlobalPath()).toBe(overridePath);
    expect(fs.existsSync(overridePath)).toBe(true);
  });

  test("falls back to the default continue directory after reset", () => {
    setContinueGlobalPathOverride(overridePath);
    resetContinueGlobalPathOverride();

    expect(getContinueGlobalPath()).toBe(defaultContinuePath);
  });
});
