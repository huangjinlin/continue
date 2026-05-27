import type {
  ChatMessage,
  ContinueConfig,
  ILLM,
  LLMFullCompletionOptions,
  MessagePart,
  VisualBridgeMessageMetadata,
} from "..";

import { renderChatMessage } from "../util/messageContent";

export const VISUAL_BRIDGE_MESSAGE_METADATA_KEY = "visualBridge";

export interface VisualBridgeContextResult {
  bridgeModelTitle: string;
  summary: string;
}

function isVisualBridgeMessageMetadata(
  value: unknown,
): value is VisualBridgeMessageMetadata {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as VisualBridgeMessageMetadata).bridgeModelTitle ===
      "string" &&
    typeof (value as VisualBridgeMessageMetadata).summary === "string"
  );
}

const VISUAL_BRIDGE_PROMPT = `You are a vision bridge for a text-only coding model.

Analyze the user's screenshot and return a concise, structured Chinese description that another coding model can use to recreate the UI.

Rules:
- Only describe visible facts from the screenshot.
- Do not write code.
- Keep the output plain text.
- If something is unclear, explicitly mark it as uncertain.

Use exactly these sections:
1. 页面类型
2. 布局结构
3. 关键组件
4. 可见文案
5. 样式特征
6. 交互状态
7. 不确定项`;

const VISUAL_BRIDGE_COMPLETION_OPTIONS: LLMFullCompletionOptions = {
  maxTokens: 900,
  temperature: 0,
};

function isImagePart(part: MessagePart): boolean {
  return part.type === "imageUrl";
}

export function messageContainsImages(message: ChatMessage): boolean {
  return Array.isArray(message.content) && message.content.some(isImagePart);
}

export function getVisualBridgeMessageMetadata(
  message: Pick<ChatMessage, "metadata">,
): VisualBridgeMessageMetadata | undefined {
  const value = message.metadata?.[VISUAL_BRIDGE_MESSAGE_METADATA_KEY];
  return isVisualBridgeMessageMetadata(value) ? value : undefined;
}

export function withVisualBridgeMessageMetadata<T extends ChatMessage>(
  message: T,
  metadata: VisualBridgeMessageMetadata,
): T {
  return {
    ...message,
    metadata: {
      ...message.metadata,
      [VISUAL_BRIDGE_MESSAGE_METADATA_KEY]: metadata,
    },
  };
}

export function resolveVisualBridgeModel(config: ContinueConfig): ILLM {
  const visualBridge = config.experimental?.visualBridge;

  if (!visualBridge?.enabled) {
    throw new Error("Visual bridge is not enabled.");
  }

  if (!visualBridge.modelTitle) {
    throw new Error("Visual bridge modelTitle is not configured.");
  }

  const allModels = Object.values(config.modelsByRole)
    .flat()
    .filter((model, index, models) => {
      return (
        models.findIndex((candidate) => candidate.title === model.title) ===
        index
      );
    });

  const bridgeModel = allModels.find(
    (model) => model.title === visualBridge.modelTitle,
  );

  if (!bridgeModel) {
    throw new Error(
      `Visual bridge model "${visualBridge.modelTitle}" was not found in the loaded config.`,
    );
  }

  if (!bridgeModel.supportsImages()) {
    throw new Error(
      `Visual bridge model "${visualBridge.modelTitle}" does not support image input at runtime.`,
    );
  }

  return bridgeModel;
}

export async function bridgeVisualContext(options: {
  config: ContinueConfig;
  message: ChatMessage;
  signal: AbortSignal;
  completionOptions?: LLMFullCompletionOptions;
}): Promise<VisualBridgeContextResult> {
  const { config, message, signal, completionOptions } = options;

  if (message.role !== "user") {
    throw new Error("Visual bridge expects the latest user message.");
  }

  if (!messageContainsImages(message)) {
    throw new Error(
      "Visual bridge expects at least one image in the user message.",
    );
  }

  const bridgeModel = resolveVisualBridgeModel(config);
  const response = await bridgeModel.chat(
    [
      {
        role: "system",
        content: VISUAL_BRIDGE_PROMPT,
      },
      message,
    ],
    signal,
    {
      ...VISUAL_BRIDGE_COMPLETION_OPTIONS,
      ...completionOptions,
    },
  );

  const summary = renderChatMessage(response).trim();

  if (!summary) {
    throw new Error("Visual bridge returned an empty summary.");
  }

  return {
    bridgeModelTitle: bridgeModel.title ?? bridgeModel.model,
    summary,
  };
}
