import { ApplyState } from "core";
import { useContext, useMemo } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppDispatch } from "../redux/hooks";
import { cancelToolCall } from "../redux/slices/sessionSlice";

export type AcceptOrRejectOutcome = "acceptDiff" | "rejectDiff";

export function useApplyStateActions(applyStates: ApplyState[]) {
  const pendingApplyStates = useMemo(
    () => applyStates.filter((state) => state.status === "done"),
    [applyStates],
  );
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();

  async function handleAcceptOrReject(status: AcceptOrRejectOutcome) {
    if (status === "rejectDiff") {
      for (const applyState of pendingApplyStates) {
        if (applyState.toolCallId) {
          dispatch(
            cancelToolCall({
              toolCallId: applyState.toolCallId,
            }),
          );
        }
      }
    }

    for (const { filepath = "", streamId } of pendingApplyStates) {
      ideMessenger.post(status, {
        filepath,
        streamId,
      });
    }
  }

  return {
    pendingApplyStates,
    handleAcceptOrReject,
  };
}
