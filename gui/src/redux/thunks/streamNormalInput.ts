import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import {
  ChatHistoryItem,
  ChatMessage,
  LLMFullCompletionOptions,
  ModelDescription,
  VisualBridgeMessageMetadata,
} from "core";
import { modelSupportsImages } from "core/llm/autodetect";
import { getRuleId } from "core/llm/rules/getSystemMessageWithRules";
import {
  getVisualBridgeMessageMetadata,
  messageContainsImages,
  withVisualBridgeMessageMetadata,
} from "core/llm/visualBridge";
import { ToCoreProtocol } from "core/protocol";
import { BUILT_IN_GROUP_NAME } from "core/tools/builtIn";
import { selectActiveTools } from "../selectors/selectActiveTools";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  abortStream,
  addPromptCompletionPair,
  errorToolCall,
  setActive,
  setAppliedRulesAtIndex,
  setContextPercentage,
  setInactive,
  setInlineErrorMessage,
  setIsPruned,
  setToolGenerated,
  streamUpdate,
  updateHistoryItemAtIndex,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { constructMessages } from "../util/constructMessages";

import { modelSupportsNativeTools } from "core/llm/toolSupport";
import { applyToolOverrides } from "core/tools/applyToolOverrides";
import { addSystemMessageToolsToSystemMessage } from "core/tools/systemMessageTools/buildToolsSystemMessage";
import { interceptSystemToolCalls } from "core/tools/systemMessageTools/interceptSystemToolCalls";
import { SystemMessageToolCodeblocksFramework } from "core/tools/systemMessageTools/toolCodeblocks";
import posthog from "posthog-js";
import {
  selectCurrentToolCalls,
  selectPendingToolCalls,
} from "../selectors/selectToolCalls";
import { getBaseSystemMessage } from "../util/getBaseSystemMessage";
import { callToolById } from "./callToolById";
import { evaluateToolPolicies } from "./evaluateToolPolicies";
import { preprocessToolCalls } from "./preprocessToolCallArgs";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

/**
 * Builds completion options with reasoning configuration based on session state and model capabilities.
 *
 * @param baseOptions - Base completion options to extend
 * @param hasReasoningEnabled - Whether reasoning is enabled in the session
 * @param model - The selected model with provider and completion options
 * @returns Completion options with reasoning configuration
 */
function buildReasoningCompletionOptions(
  baseOptions: LLMFullCompletionOptions,
  hasReasoningEnabled: boolean | undefined,
  model: ModelDescription,
): LLMFullCompletionOptions {
  if (hasReasoningEnabled === undefined) {
    return baseOptions;
  }

  const reasoningOptions: LLMFullCompletionOptions = {
    ...baseOptions,
    reasoning: !!hasReasoningEnabled,
  };

  // Add reasoning budget tokens if reasoning is enabled and provider supports it
  if (hasReasoningEnabled && model.underlyingProviderName !== "ollama") {
    // Ollama doesn't support limiting reasoning tokens at this point
    reasoningOptions.reasoningBudgetTokens =
      model.completionOptions?.reasoningBudgetTokens ?? 2048;
  }

  return reasoningOptions;
}

function getLastUserMessageIndex(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "user") {
      return index;
    }
  }

  return -1;
}

function getLastUserHistoryItemIndex(history: ChatHistoryItem[]): number {
  for (let index = history.length - 1; index >= 0; index--) {
    if (history[index].message.role === "user") {
      return index;
    }
  }

  return -1;
}

function formatVisualBridgeSummary(options: {
  bridgeModelTitle: string;
  summary: string;
}): string {
  return [
    "",
    "以下是视觉桥接模型对截图的结构化分析，请将其作为当前用户这轮请求的补充上下文。",
    `桥接模型: ${options.bridgeModelTitle}`,
    options.summary,
  ].join("\n\n");
}

function injectVisualBridgeSummary(
  messages: ChatMessage[],
  summaryText: string,
): ChatMessage[] {
  const lastUserMessageIndex = getLastUserMessageIndex(messages);

  if (lastUserMessageIndex === -1) {
    return messages;
  }

  return messages.map((message, index) => {
    if (index !== lastUserMessageIndex || message.role !== "user") {
      return message;
    }

    if (typeof message.content === "string") {
      return {
        ...message,
        content: message.content
          ? `${message.content}${summaryText}`
          : summaryText.trim(),
      };
    }

    return {
      ...message,
      content: [
        ...message.content,
        {
          type: "text",
          text: summaryText,
        },
      ],
    };
  });
}

async function maybeInjectVisualBridgeSummary(options: {
  messages: ChatMessage[];
  selectedChatModel: ModelDescription;
  legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
  ideMessenger: ThunkApiType["extra"]["ideMessenger"];
  failOnBridgeError: boolean;
}): Promise<{
  messages: ChatMessage[];
  metadataToCache?: VisualBridgeMessageMetadata;
}> {
  const {
    messages,
    selectedChatModel,
    legacySlashCommandData,
    ideMessenger,
    failOnBridgeError,
  } = options;

  if (legacySlashCommandData) {
    return { messages };
  }

  if (
    modelSupportsImages(
      selectedChatModel.provider,
      selectedChatModel.model,
      selectedChatModel.title,
      selectedChatModel.capabilities,
    )
  ) {
    return { messages };
  }

  const lastUserMessageIndex = getLastUserMessageIndex(messages);
  if (lastUserMessageIndex === -1) {
    return { messages };
  }

  const lastUserMessage = messages[lastUserMessageIndex];
  if (!messageContainsImages(lastUserMessage)) {
    return { messages };
  }

  const cachedMetadata = getVisualBridgeMessageMetadata(lastUserMessage);
  if (cachedMetadata) {
    return {
      messages: injectVisualBridgeSummary(
        messages,
        formatVisualBridgeSummary(cachedMetadata),
      ),
      metadataToCache: cachedMetadata,
    };
  }

  const bridgeRes = await ideMessenger.request("llm/bridgeVisualContext", {
    message: lastUserMessage,
  });

  if (bridgeRes.status === "error") {
    if (failOnBridgeError) {
      throw new Error(bridgeRes.error);
    }

    console.warn("Visual bridge failed, continuing without bridge context", {
      error: bridgeRes.error,
    });
    return { messages };
  }

  const metadataToCache: VisualBridgeMessageMetadata = {
    ...bridgeRes.content,
    cachedAt: new Date().toISOString(),
  };

  return {
    messages: injectVisualBridgeSummary(
      messages,
      formatVisualBridgeSummary(metadataToCache),
    ),
    metadataToCache,
  };
}

export const streamNormalInput = createAsyncThunk<
  void,
  {
    legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
    depth?: number;
  },
  ThunkApiType
>(
  "chat/streamNormalInput",
  async (
    { legacySlashCommandData, depth = 0 },
    { dispatch, extra, getState },
  ) => {
    if (process.env.NODE_ENV === "test" && depth > 50) {
      const message = `Max stream depth of ${50} reached in test`;
      console.error(message, JSON.stringify(getState(), null, 2));
      throw new Error(message);
    }
    const state = getState();
    const selectedChatModel = selectSelectedChatModel(state);

    if (!selectedChatModel) {
      throw new Error("No chat model selected");
    }

    // Get tools and apply model-level overrides (disabled, description, etc.)
    let activeTools = selectActiveTools(state);
    if (selectedChatModel.toolOverrides?.length) {
      const { tools: overriddenTools, errors } = applyToolOverrides(
        activeTools,
        selectedChatModel.toolOverrides,
      );
      activeTools = overriddenTools;
      for (const error of errors) {
        if (!error.fatal) {
          console.warn(`Tool override warning: ${error.message}`);
        }
      }
    }

    // Use the centralized selector to determine if system message tools should be used
    const useNativeTools = state.config.config.experimental
      ?.onlyUseSystemMessageTools
      ? false
      : modelSupportsNativeTools(selectedChatModel);
    const systemToolsFramework = !useNativeTools
      ? new SystemMessageToolCodeblocksFramework()
      : undefined;

    // Construct completion options
    let completionOptions: LLMFullCompletionOptions = {};
    if (useNativeTools && activeTools.length > 0) {
      completionOptions = {
        tools: activeTools,
      };
    }

    completionOptions = buildReasoningCompletionOptions(
      completionOptions,
      state.session.hasReasoningEnabled,
      selectedChatModel,
    );

    // Construct messages (excluding system message)
    const baseSystemMessage = getBaseSystemMessage(
      state.session.mode,
      selectedChatModel,
      activeTools,
    );

    const systemMessage = systemToolsFramework
      ? addSystemMessageToolsToSystemMessage(
          systemToolsFramework,
          baseSystemMessage,
          activeTools,
        )
      : baseSystemMessage;

    const withoutMessageIds = state.session.history.map((item) => {
      const { id, ...messageWithoutId } = item.message;
      return { ...item, message: messageWithoutId };
    });

    const { messages, appliedRules, appliedRuleIndex } = constructMessages(
      withoutMessageIds,
      systemMessage,
      state.config.config.rules,
      state.ui.ruleSettings,
      systemToolsFramework,
    );

    // TODO parallel tool calls will cause issues with this
    // because there will be multiple tool messages, so which one should have applied rules?
    dispatch(
      setAppliedRulesAtIndex({
        index: appliedRuleIndex,
        appliedRules: appliedRules,
      }),
    );

    const visualBridgeResult = state.config.config.experimental?.visualBridge
      ?.enabled
      ? await maybeInjectVisualBridgeSummary({
          messages,
          selectedChatModel,
          legacySlashCommandData,
          ideMessenger: extra.ideMessenger,
          failOnBridgeError:
            state.config.config.experimental.visualBridge?.failOnBridgeError ??
            true,
        })
      : { messages };

    const messagesWithVisualBridge = visualBridgeResult.messages;

    const lastUserHistoryItemIndex = getLastUserHistoryItemIndex(
      state.session.history,
    );
    if (
      visualBridgeResult.metadataToCache &&
      lastUserHistoryItemIndex !== -1 &&
      !getVisualBridgeMessageMetadata(
        state.session.history[lastUserHistoryItemIndex].message,
      )
    ) {
      dispatch(
        updateHistoryItemAtIndex({
          index: lastUserHistoryItemIndex,
          updates: {
            message: withVisualBridgeMessageMetadata(
              state.session.history[lastUserHistoryItemIndex].message,
              visualBridgeResult.metadataToCache,
            ),
          },
        }),
      );
    }

    dispatch(setActive());
    dispatch(setInlineErrorMessage(undefined));

    const precompiledRes = await extra.ideMessenger.request("llm/compileChat", {
      messages: messagesWithVisualBridge,
      options: completionOptions,
    });

    if (precompiledRes.status === "error") {
      if (precompiledRes.error.includes("Not enough context")) {
        dispatch(setInlineErrorMessage("out-of-context"));
        dispatch(setInactive());
        return;
      } else {
        throw new Error(precompiledRes.error);
      }
    }

    const { compiledChatMessages, didPrune, contextPercentage } =
      precompiledRes.content;

    dispatch(setIsPruned(didPrune));
    dispatch(setContextPercentage(contextPercentage));

    const start = Date.now();
    const streamAborter = state.session.streamAborter;
    try {
      let gen = extra.ideMessenger.llmStreamChat(
        {
          completionOptions,
          title: selectedChatModel.title,
          messages: compiledChatMessages,
          legacySlashCommandData,
          messageOptions: { precompiled: true },
        },
        streamAborter.signal,
      );
      if (systemToolsFramework && activeTools.length > 0) {
        gen = interceptSystemToolCalls(
          gen,
          streamAborter,
          systemToolsFramework,
        );
      }

      let next = await gen.next();
      while (!next.done) {
        if (!getState().session.isStreaming) {
          dispatch(abortStream());
          break;
        }

        dispatch(streamUpdate(next.value));
        next = await gen.next();
      }

      // Attach prompt log and end thinking for reasoning models
      if (next.done && next.value) {
        dispatch(addPromptCompletionPair([next.value]));

        try {
          extra.ideMessenger.post("devdata/log", {
            name: "chatInteraction",
            data: {
              prompt: next.value.prompt,
              completion: next.value.completion,
              modelProvider: selectedChatModel.underlyingProviderName,
              modelName: selectedChatModel.title,
              modelTitle: selectedChatModel.title,
              sessionId: state.session.id,
              ...(!!activeTools.length && {
                tools: activeTools.map((tool) => tool.function.name),
              }),
              ...(appliedRules.length > 0 && {
                rules: appliedRules.map((rule) => ({
                  id: getRuleId(rule),
                  slug: rule.slug,
                })),
              }),
            },
          });
        } catch (e) {
          console.error("Failed to send dev data interaction log", e);
        }
      }
    } catch (e) {
      const toolCallsToCancel = selectCurrentToolCalls(getState());
      posthog.capture("stream_premature_close_error", {
        duration: (Date.now() - start) / 1000,
        model: selectedChatModel.model,
        provider: selectedChatModel.underlyingProviderName,
        context: legacySlashCommandData ? "slash_command" : "regular_chat",
        ...(legacySlashCommandData && {
          command: legacySlashCommandData.command.name,
        }),
      });
      if (
        toolCallsToCancel.length > 0 &&
        e instanceof Error &&
        e.message.toLowerCase().includes("premature close")
      ) {
        for (const tc of toolCallsToCancel) {
          dispatch(
            errorToolCall({
              toolCallId: tc.toolCallId,
              output: [
                {
                  name: "Tool Call Error",
                  description: "Premature Close",
                  content: `"Premature Close" error: this tool call was aborted mid-stream because the arguments took too long to stream or there were network issues. Please re-attempt by breaking the operation into smaller chunks or trying something else`,
                  icon: "problems",
                },
              ],
            }),
          );
        }
      } else {
        throw e;
      }
    }

    // Tool call sequence:
    // 1. Mark generating tool calls as generated
    const state1 = getState();
    if (streamAborter.signal.aborted || !state1.session.isStreaming) {
      return;
    }
    const originalToolCalls = selectCurrentToolCalls(state1);
    const generatingCalls = originalToolCalls.filter(
      (tc) => tc.status === "generating",
    );
    for (const { toolCallId } of generatingCalls) {
      dispatch(
        setToolGenerated({
          toolCallId,
          tools: state1.config.config.tools,
        }),
      );
    }

    // 2. Pre-process args to catch invalid args before checking policies
    const state2 = getState();
    if (streamAborter.signal.aborted || !state2.session.isStreaming) {
      return;
    }
    const generatedCalls2 = selectPendingToolCalls(state2);
    await preprocessToolCalls(dispatch, extra.ideMessenger, generatedCalls2);

    // 3. Security check: evaluate updated policies based on args
    const state3 = getState();
    if (streamAborter.signal.aborted || !state3.session.isStreaming) {
      return;
    }
    const generatedCalls3 = selectPendingToolCalls(state3);
    const toolPolicies = state3.ui.toolSettings;
    const policies = await evaluateToolPolicies(
      dispatch,
      extra.ideMessenger,
      activeTools,
      generatedCalls3,
      toolPolicies,
    );
    const autoApprovedPolicies = policies.filter(
      ({ policy }) => policy === "allowedWithoutPermission",
    );
    const needsApprovalPolicies = policies.filter(
      ({ policy }) => policy === "allowedWithPermission",
    );

    // 4. Execute remaining tool calls
    if (originalToolCalls.length === 0) {
      dispatch(setInactive());
    } else if (needsApprovalPolicies.length > 0) {
      const builtInReadonlyAutoApproved = autoApprovedPolicies.filter(
        ({ toolCallState }) =>
          toolCallState.tool?.group === BUILT_IN_GROUP_NAME &&
          toolCallState.tool?.readonly,
      );

      if (builtInReadonlyAutoApproved.length > 0) {
        const state4 = getState();
        if (streamAborter.signal.aborted || !state4.session.isStreaming) {
          return;
        }
        await Promise.all(
          builtInReadonlyAutoApproved.map(async ({ toolCallState }) => {
            unwrapResult(
              await dispatch(
                callToolById({
                  toolCallId: toolCallState.toolCallId,
                  isAutoApproved: true,
                  depth: depth + 1,
                }),
              ),
            );
          }),
        );
      }

      dispatch(setInactive());
    } else {
      // auto stream cases increase thunk depth by 1 for debugging
      const state4 = getState();
      const generatedCalls4 = selectPendingToolCalls(state4);
      if (streamAborter.signal.aborted || !state4.session.isStreaming) {
        return;
      }
      if (generatedCalls4.length > 0) {
        await Promise.all(
          generatedCalls4.map(async ({ toolCallId }) => {
            unwrapResult(
              await dispatch(
                callToolById({
                  toolCallId,
                  isAutoApproved: true,
                  depth: depth + 1,
                }),
              ),
            );
          }),
        );
      } else {
        for (const { toolCallId } of originalToolCalls) {
          unwrapResult(
            await dispatch(
              streamResponseAfterToolCall({
                toolCallId,
                depth: depth + 1,
              }),
            ),
          );
        }
      }
    }
  },
);
