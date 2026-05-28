import { ToolCallState } from "core";
import { useMemo } from "react";
import { useAppDispatch } from "../redux/hooks";
import { PendingReviewItem } from "../redux/selectors/selectToolCalls";
import { callToolById } from "../redux/thunks/callToolById";
import { cancelToolCallThunk } from "../redux/thunks/cancelToolCall";
import {
  AcceptOrRejectOutcome,
  useApplyStateActions,
} from "./useApplyStateActions";

export function usePendingReviewActions(
  pendingReviewItems: PendingReviewItem[],
) {
  const dispatch = useAppDispatch();
  const applyStates = useMemo(
    () =>
      pendingReviewItems.flatMap((item) =>
        item.kind === "apply" ? [item.applyState] : [],
      ),
    [pendingReviewItems],
  );
  const createFileToolCalls = useMemo(
    () =>
      pendingReviewItems.flatMap((item) =>
        item.kind === "create-file" ? [item.toolCallState] : [],
      ),
    [pendingReviewItems],
  );
  const { handleAcceptOrReject: handleApplyStateAction } =
    useApplyStateActions(applyStates);

  async function handleCreateFileToolCalls(
    createFileToolCallsToHandle: ToolCallState[],
    outcome: AcceptOrRejectOutcome,
  ) {
    for (const toolCallState of createFileToolCallsToHandle) {
      if (outcome === "acceptDiff") {
        await dispatch(
          callToolById({
            toolCallId: toolCallState.toolCallId,
          }),
        );
      } else {
        await dispatch(
          cancelToolCallThunk({
            toolCallId: toolCallState.toolCallId,
          }),
        );
      }
    }
  }

  async function handleAcceptOrReject(outcome: AcceptOrRejectOutcome) {
    await handleApplyStateAction(outcome);
    await handleCreateFileToolCalls(createFileToolCalls, outcome);
  }

  return {
    handleAcceptOrReject,
    applyStates,
    createFileToolCalls,
  };
}
