import { createAsyncThunk } from "@reduxjs/toolkit";
import { ApplyState, ApplyToFilePayload } from "core";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
import { shouldDeferEditToolReview } from "../../util/deferredEditToolReview";
import { logAgentModeEditOutcome } from "../../util/editOutcomeLogger";
import {
  selectApplyStateByToolCallId,
  selectToolCallById,
} from "../selectors/selectToolCalls";
import { updateEditStateApplyState } from "../slices/editState";
import {
  acceptToolCall,
  errorToolCall,
  updateApplyState,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { AppThunkDispatch, ThunkApiType } from "../store";
import { findToolCallById, logToolUsage } from "../util";
import { exitEdit } from "./edit";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

function dispatchPendingReviewToolCallOutput(
  dispatch: AppThunkDispatch,
  toolCallId: string,
  filepath?: string,
) {
  dispatch(
    updateToolCallOutput({
      toolCallId,
      contextItems: [
        {
          name: "Edit Pending Review",
          content: `Generated pending edits for ${filepath ?? "the requested file"}. The diff is waiting for user review before final confirmation.`,
          description: "",
          hidden: true,
        },
      ],
    }),
  );
}

function dispatchFinalToolCallOutput(
  dispatch: AppThunkDispatch,
  toolCallId: string,
  applyState: ApplyState,
) {
  if (applyState.autoFormattingDiff) {
    dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems: [
          {
            icon: "info",
            name: "Auto-formatting Applied",
            description: "Editor auto-formatting changes",
            content: `Along with your edits, the editor applied the following auto-formatting:\n\n${applyState.autoFormattingDiff}\n\n(Note: Pay close attention to changes such as single quotes being converted to double quotes, semicolons being removed or added, long lines being broken into multiple lines, adjusting indentation style, adding/removing trailing commas, etc. This will help you ensure future SEARCH/REPLACE operations to this file are accurate.)`,
            hidden: false,
          },
        ],
      }),
    );
  } else {
    dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems: [
          {
            name: "Edit Success",
            content: `Successfully edited ${applyState.filepath}`,
            description: "",
            hidden: true,
          },
        ],
      }),
    );
  }
}

export const handleApplyStateUpdate = createAsyncThunk<
  void,
  ApplyState,
  ThunkApiType
>(
  "apply/handleStateUpdate",
  async (applyState, { dispatch, getState, extra }) => {
    if (applyState.streamId === EDIT_MODE_STREAM_ID) {
      dispatch(updateEditStateApplyState(applyState));

      if (applyState.status === "closed") {
        const toolCallState = findToolCallById(
          getState().session.history,
          applyState.toolCallId!,
        );
        if (toolCallState) {
          logToolUsage(toolCallState, true, true, extra.ideMessenger);
        }
        void dispatch(exitEdit({}));
      }
    } else {
      // chat or agent
      dispatch(updateApplyState(applyState));

      const currentApplyState =
        getState().session.codeBlockApplyStates?.states.find(
          (state) => state.streamId === applyState.streamId,
        );
      const effectiveToolCallId =
        applyState.toolCallId ?? currentApplyState?.toolCallId;

      // Handle apply status updates - use toolCallId from event payload
      if (effectiveToolCallId) {
        const toolCallState = findToolCallById(
          getState().session.history,
          effectiveToolCallId,
        );
        const deferEditToolReview = shouldDeferEditToolReview(
          toolCallState?.toolCall.function.name,
        );

        if (
          applyState.status === "done" &&
          toolCallState?.toolCall.function.name
        ) {
          if (deferEditToolReview) {
            if (toolCallState.status === "calling") {
              dispatch(
                acceptToolCall({
                  toolCallId: effectiveToolCallId,
                }),
              );
              dispatchPendingReviewToolCallOutput(
                dispatch,
                effectiveToolCallId,
                applyState.filepath,
              );
              void dispatch(
                streamResponseAfterToolCall({
                  toolCallId: effectiveToolCallId,
                }),
              );
            }
          } else if (
            getState().ui.toolSettings[toolCallState.toolCall.function.name] ===
            "allowedWithoutPermission"
          ) {
            extra.ideMessenger.post("acceptDiff", {
              streamId: applyState.streamId,
              filepath: applyState.filepath,
            });
          }
        }

        if (applyState.status === "closed") {
          if (toolCallState) {
            const accepted =
              applyState.accepted ?? toolCallState.status !== "canceled";
            const didContinueDuringDone =
              deferEditToolReview && toolCallState.status === "done";

            logToolUsage(toolCallState, accepted, true, extra.ideMessenger);

            // Log edit outcome for Agent Mode
            const newApplyState =
              getState().session.codeBlockApplyStates.states.find(
                (s) => s.streamId === applyState.streamId,
              );
            const newState = getState();
            if (newApplyState) {
              void logAgentModeEditOutcome(
                newState.session.history,
                newState.config.config,
                toolCallState,
                newApplyState,
                accepted,
                extra.ideMessenger,
              );
            }

            if (accepted) {
              if (toolCallState.status !== "errored") {
                if (!didContinueDuringDone) {
                  dispatch(
                    acceptToolCall({
                      toolCallId: effectiveToolCallId,
                    }),
                  );
                }
                dispatchFinalToolCallOutput(
                  dispatch,
                  effectiveToolCallId,
                  applyState,
                );
              } else {
                dispatch(
                  updateToolCallOutput({
                    toolCallId: effectiveToolCallId,
                    contextItems: [
                      {
                        name: "Edit Failed",
                        content: `Failed to edit ${applyState.filepath}. To continue working with the file, read it again to see the most up-to-date contents`,
                        description: "",
                        hidden: true,
                      },
                    ],
                  }),
                );
              }

              if (!didContinueDuringDone) {
                void dispatch(
                  streamResponseAfterToolCall({
                    toolCallId: effectiveToolCallId,
                  }),
                );
              }
            }
          }
        }
      }
    }
  },
);

export const applyForEditTool = createAsyncThunk<
  void,
  ApplyToFilePayload & { toolCallId: string },
  ThunkApiType
>("apply/editTool", async (payload, { dispatch, getState, extra }) => {
  const { toolCallId, streamId } = payload;
  dispatch(
    updateApplyState({
      streamId,
      toolCallId,
      status: "not-started",
    }),
  );

  let didError = false;
  try {
    const response = await extra.ideMessenger.request("applyToFile", payload);
    if (response.status === "error") {
      didError = true;
    }
  } catch (e) {
    didError = true;
  }
  if (didError) {
    const state = getState();

    const toolCallState = selectToolCallById(state, toolCallId);
    const applyState = selectApplyStateByToolCallId(state, toolCallId);
    if (
      toolCallState &&
      applyState &&
      applyState.status !== "closed" &&
      toolCallState.status === "calling"
    ) {
      dispatch(
        errorToolCall({
          toolCallId,
        }),
      );
      dispatch(
        updateToolCallOutput({
          toolCallId,
          contextItems: [
            {
              icon: "problems",
              name: "Apply Error",
              description: "Failed to apply changes",
              content: `Error editing file: failed to apply changes to file.\n\nPlease try again with correct args or notify the user and request further instructions.`,
              hidden: false,
            },
          ],
        }),
      );
      void dispatch(
        handleApplyStateUpdate({
          status: "closed",
          streamId: applyState.streamId,
          toolCallId,
        }),
      );
    }
  }
});
