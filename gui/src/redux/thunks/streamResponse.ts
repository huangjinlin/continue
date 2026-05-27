import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import { ChatMessage, InputModifiers } from "core";
import {
  getVisualBridgeMessageMetadata,
  withVisualBridgeMessageMetadata,
} from "core/llm/visualBridge";
import posthog from "posthog-js";
import { v4 as uuidv4 } from "uuid";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor/utils/resolveEditorContent";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  resetNextCodeBlockToApplyIndex,
  submitEditorAndInitAtIndex,
  updateHistoryItemAtIndex,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { streamNormalInput } from "./streamNormalInput";
import { streamThunkWrapper } from "./streamThunkWrapper";
import { updateFileSymbolsFromFiles } from "./updateFileSymbols";

function getImageUrls(content: ChatMessage["content"]): string[] {
  if (!Array.isArray(content)) {
    return [];
  }

  return content.flatMap((part) =>
    part.type === "imageUrl" ? [part.imageUrl.url] : [],
  );
}

function getRetainedVisualBridgeMetadata(
  existingMessage: ChatMessage | undefined,
  nextContent: ChatMessage["content"],
) {
  if (!existingMessage) {
    return undefined;
  }

  const existingMetadata = getVisualBridgeMessageMetadata(existingMessage);
  if (!existingMetadata) {
    return undefined;
  }

  const previousImageUrls = getImageUrls(existingMessage.content);
  const nextImageUrls = getImageUrls(nextContent);

  if (
    previousImageUrls.length === 0 ||
    previousImageUrls.length !== nextImageUrls.length
  ) {
    return undefined;
  }

  return previousImageUrls.every((url, index) => url === nextImageUrls[index])
    ? existingMetadata
    : undefined;
}

export const streamResponseThunk = createAsyncThunk<
  void,
  {
    editorState: JSONContent;
    modifiers: InputModifiers;
    index?: number;
  },
  ThunkApiType
>(
  "chat/streamResponse",
  async ({ editorState, modifiers, index }, { dispatch, extra, getState }) => {
    await dispatch(
      streamThunkWrapper(async () => {
        const state = getState();
        const selectedChatModel = selectSelectedChatModel(state);
        const inputIndex = index ?? state.session.history.length; // Either given index or concat to end

        if (!selectedChatModel) {
          throw new Error("No chat model selected");
        }
        dispatch(
          submitEditorAndInitAtIndex({ index: inputIndex, editorState }),
        );

        dispatch(resetNextCodeBlockToApplyIndex());

        const defaultContextProviders =
          state.config.config.experimental?.defaultContext ?? [];

        // Resolve context providers and construct new history
        const {
          selectedContextItems,
          selectedCode,
          content,
          legacyCommandWithInput,
        } = await resolveEditorContent({
          editorState,
          modifiers,
          ideMessenger: extra.ideMessenger,
          defaultContextProviders,
          availableSlashCommands: state.config.config.slashCommands,
          dispatch,
          getState,
        });

        // symbols for both context items AND selected codeblocks
        const filesForSymbols = [
          ...selectedContextItems
            .filter((item) => item.uri?.type === "file" && item?.uri?.value)
            .map((item) => item.uri!.value),
          ...selectedCode.map((rif) => rif.filepath),
        ];
        void dispatch(updateFileSymbolsFromFiles(filesForSymbols));

        const retainedVisualBridgeMetadata = getRetainedVisualBridgeMetadata(
          state.session.history[inputIndex]?.message,
          content,
        );

        const nextUserMessage = retainedVisualBridgeMetadata
          ? withVisualBridgeMessageMetadata(
              {
                role: "user",
                content,
                id: uuidv4(),
              },
              retainedVisualBridgeMetadata,
            )
          : {
              role: "user" as const,
              content,
              id: uuidv4(),
            };

        dispatch(
          updateHistoryItemAtIndex({
            index: inputIndex,
            updates: {
              message: nextUserMessage,
              contextItems: selectedContextItems,
            },
          }),
        );

        posthog.capture("step run", {
          step_name: "User Input",
          params: {},
        });
        posthog.capture("userInput", {});

        if (legacyCommandWithInput) {
          posthog.capture("step run", {
            step_name: legacyCommandWithInput.command.name,
            params: {},
          });
        }

        unwrapResult(
          await dispatch(
            streamNormalInput({
              legacySlashCommandData: legacyCommandWithInput
                ? {
                    command: legacyCommandWithInput.command,
                    contextItems: selectedContextItems,
                    historyIndex: inputIndex,
                    input: legacyCommandWithInput.input,
                    selectedCode,
                  }
                : undefined,
            }),
          ),
        );
      }),
    );
  },
);
