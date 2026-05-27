import { describe, expect, it, vi } from "vitest";

vi.mock("../util/getBaseSystemMessage", () => ({
  getBaseSystemMessage: vi.fn(() => "You are a helpful assistant."),
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

import { ChatMessage, ModelDescription, PromptLog } from "core";
import {
  VISUAL_BRIDGE_MESSAGE_METADATA_KEY,
  withVisualBridgeMessageMetadata,
} from "core/llm/visualBridge";
import { createMockStore, getEmptyRootState } from "../../util/test/mockStore";
import { streamNormalInput } from "./streamNormalInput";

const mockDeepSeekModel: ModelDescription = {
  title: "DeepSeek Main",
  model: "deepseek-chat",
  provider: "deepseek",
  underlyingProviderName: "deepseek",
};

const imageMessage: ChatMessage = {
  role: "user",
  content: [
    {
      type: "text",
      text: "请根据截图还原页面",
    },
    {
      type: "imageUrl",
      imageUrl: {
        url: "data:image/png;base64,abc",
      },
    },
  ],
};

describe("streamNormalInput visual bridge cache", () => {
  it("reuses cached visual bridge metadata without calling bridge again", async () => {
    const initialState = getEmptyRootState();
    initialState.config.config.selectedModelByRole.chat = mockDeepSeekModel;
    initialState.config.config.experimental = {
      visualBridge: {
        enabled: true,
        modelTitle: "Qwen Vision Test",
      },
    };
    initialState.session.history = [
      {
        message: {
          ...withVisualBridgeMessageMetadata(imageMessage, {
            bridgeModelTitle: "Qwen Vision Test",
            summary: "1. 页面类型\n登录页面",
          }),
          id: "user-1",
        },
        contextItems: [],
      },
    ];

    const mockStore = createMockStore(initialState);
    const requestSpy = vi.spyOn(mockStore.mockIdeMessenger, "request");

    mockStore.mockIdeMessenger.responseHandlers["llm/compileChat"] = async (
      data,
    ) => ({
      compiledChatMessages: data.messages,
      didPrune: false,
      contextPercentage: 0.21,
    });

    async function* mockStreamGenerator(): AsyncGenerator<
      ChatMessage[],
      PromptLog
    > {
      yield [{ role: "assistant", content: "cached answer" }];
      return {
        prompt: "prompt",
        completion: "cached answer",
        modelProvider: "deepseek",
        modelTitle: "DeepSeek Main",
      };
    }

    mockStore.mockIdeMessenger.llmStreamChat = vi
      .fn()
      .mockReturnValue(mockStreamGenerator());

    await mockStore.dispatch(streamNormalInput({}) as any);

    expect(
      requestSpy.mock.calls.some(
        (call) => call[0] === "llm/bridgeVisualContext",
      ),
    ).toBe(false);

    const compileCall = requestSpy.mock.calls.find(
      (call) => call[0] === "llm/compileChat",
    );
    expect(compileCall).toBeDefined();
    expect((compileCall as any)[1].messages.at(-1).content).toEqual([
      ...imageMessage.content,
      {
        type: "text",
        text: expect.stringContaining("桥接模型: Qwen Vision Test"),
      },
    ]);

    const finalState = mockStore.getState() as typeof initialState;
    expect(
      finalState.session.history[0].message.metadata?.[
        VISUAL_BRIDGE_MESSAGE_METADATA_KEY
      ],
    ).toEqual(
      expect.objectContaining({
        bridgeModelTitle: "Qwen Vision Test",
        summary: "1. 页面类型\n登录页面",
      }),
    );
  });
});
