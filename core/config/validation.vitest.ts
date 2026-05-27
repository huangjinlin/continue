import { describe, expect, it } from "vitest";

import { validateExperimentalConfig } from "./validation";

describe("validateExperimentalConfig", () => {
  it("requires modelTitle when visual bridging is enabled", () => {
    const errors = validateExperimentalConfig({
      experimental: {
        visualBridge: {
          enabled: true,
        },
      },
      models: [],
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].fatal).toBe(true);
    expect(errors[0].message).toContain("modelTitle");
  });

  it("accepts YAML-style bridge models that explicitly enable image_input", () => {
    const errors = validateExperimentalConfig({
      experimental: {
        visualBridge: {
          enabled: true,
          modelTitle: "Qwen Vision Test",
          failOnBridgeError: true,
        },
      },
      models: [
        {
          name: "Qwen Vision Test",
          provider: "openai",
          model: "qwen3.6-plus",
          capabilities: ["image_input"],
        },
      ],
    });

    expect(errors).toHaveLength(0);
  });

  it("rejects bridge models that do not support image input", () => {
    const errors = validateExperimentalConfig({
      experimental: {
        visualBridge: {
          enabled: true,
          modelTitle: "DeepSeek Main",
        },
      },
      models: [
        {
          title: "DeepSeek Main",
          provider: "deepseek",
          model: "deepseek-chat",
        },
      ],
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].fatal).toBe(true);
    expect(errors[0].message).toContain("support image input");
  });
});
