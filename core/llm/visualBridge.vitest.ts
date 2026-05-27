import { describe, expect, it, vi } from "vitest";

import type { ChatMessage, ContinueConfig, ILLM } from "..";
import {
  bridgeVisualContext,
  messageContainsImages,
  resolveVisualBridgeModel,
} from "./visualBridge";

function createBridgeModel(overrides?: Partial<ILLM>): ILLM {
  return {
    title: "Qwen Vision Test",
    model: "qwen3.6-plus",
    providerName: "openai",
    underlyingProviderName: "openai",
    supportsImages: () => true,
    chat: vi.fn().mockResolvedValue({
      role: "assistant",
      content: "1. 页面类型\n前端页面截图",
    }),
    complete: vi.fn(),
    streamComplete: vi.fn(),
    streamFim: vi.fn(),
    streamChat: vi.fn(),
    compileChatMessages: vi.fn(),
    embed: vi.fn(),
    rerank: vi.fn(),
    countTokens: vi.fn(),
    supportsCompletions: vi.fn(),
    supportsPrefill: vi.fn(),
    supportsFim: vi.fn(),
    listModels: vi.fn(),
    renderPromptTemplate: vi.fn(),
    getConfigurationStatus: vi.fn(),
    ...overrides,
  } as unknown as ILLM;
}

function createConfig(model: ILLM): ContinueConfig {
  return {
    slashCommands: [],
    tools: [],
    mcpServerStatuses: [],
    contextProviders: [],
    rules: [],
    modelsByRole: {
      chat: [model],
      edit: [],
      apply: [],
      embed: [],
      autocomplete: [],
      rerank: [],
      summarize: [],
      subagent: [],
    },
    selectedModelByRole: {
      chat: null,
      edit: null,
      apply: null,
      embed: null,
      autocomplete: null,
      rerank: null,
      summarize: null,
      subagent: null,
    },
    experimental: {
      visualBridge: {
        enabled: true,
        modelTitle: "Qwen Vision Test",
      },
    },
  };
}

function createImageMessage(): ChatMessage {
  return {
    role: "user",
    content: [
      {
        type: "text",
        text: "请根据截图描述页面",
      },
      {
        type: "imageUrl",
        imageUrl: {
          url: "data:image/png;base64,abc",
        },
      },
    ],
  };
}

describe("visualBridge", () => {
  it("detects images in user messages", () => {
    expect(messageContainsImages(createImageMessage())).toBe(true);
    expect(messageContainsImages({ role: "user", content: "plain text" })).toBe(
      false,
    );
  });

  it("resolves the configured bridge model", () => {
    const model = createBridgeModel();
    const resolved = resolveVisualBridgeModel(createConfig(model));

    expect(resolved).toBe(model);
  });

  it("uses the bridge model to return a structured summary", async () => {
    const model = createBridgeModel();
    const config = createConfig(model);
    const message = createImageMessage();

    const result = await bridgeVisualContext({
      config,
      message,
      signal: new AbortController().signal,
    });

    expect(result.bridgeModelTitle).toBe("Qwen Vision Test");
    expect(result.summary).toContain("页面类型");
    expect(model.chat).toHaveBeenCalledOnce();
    expect((model.chat as any).mock.calls[0][0][0]).toMatchObject({
      role: "system",
    });
    expect((model.chat as any).mock.calls[0][0][1]).toEqual(message);
  });

  it("throws when the message has no image", async () => {
    const model = createBridgeModel();

    await expect(
      bridgeVisualContext({
        config: createConfig(model),
        message: { role: "user", content: "plain text" },
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("at least one image");
  });
});
