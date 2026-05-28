import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ApplyState } from "core";
import {
  AcceptOrRejectOutcome,
  useApplyStateActions,
} from "../hooks/useApplyStateActions";
import { ToolTip } from "./gui/Tooltip";

interface FileAcceptRejectDiffButtonsProps {
  applyStates: ApplyState[];
  onAcceptOrReject?: (outcome: AcceptOrRejectOutcome) => void;
}

export default function FileAcceptRejectDiffButtons({
  applyStates,
  onAcceptOrReject,
}: FileAcceptRejectDiffButtonsProps) {
  const { handleAcceptOrReject } = useApplyStateActions(applyStates);

  async function onClick(outcome: AcceptOrRejectOutcome) {
    await handleAcceptOrReject(outcome);
    onAcceptOrReject?.(outcome);
  }

  return (
    <div
      className="flex flex-shrink-0 items-center gap-2"
      data-testid="pending-apply-file-actions"
    >
      <ToolTip content="Reject this file">
        <button
          type="button"
          aria-label="Reject this file"
          className="text-foreground flex h-6 w-6 cursor-pointer items-center justify-center border-none bg-transparent p-0 opacity-80 hover:opacity-100 hover:brightness-125"
          onClick={() => onClick("rejectDiff")}
          data-testid="pending-apply-file-reject-button"
        >
          <XMarkIcon className="text-error h-4 w-4" />
        </button>
      </ToolTip>

      <ToolTip content="Accept this file">
        <button
          type="button"
          aria-label="Accept this file"
          className="text-foreground flex h-6 w-6 cursor-pointer items-center justify-center border-none bg-transparent p-0 opacity-80 hover:opacity-100 hover:brightness-125"
          onClick={() => onClick("acceptDiff")}
          data-testid="pending-apply-file-accept-button"
        >
          <CheckIcon className="text-success h-4 w-4" />
        </button>
      </ToolTip>
    </div>
  );
}
