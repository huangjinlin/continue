import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ApplyState } from "core";
import {
  AcceptOrRejectOutcome,
  useApplyStateActions,
} from "../hooks/useApplyStateActions";
import { getMetaKeyLabel } from "../util";
import { ToolTip } from "./gui/Tooltip";

export interface AcceptRejectAllButtonsProps {
  applyStates: ApplyState[];
  onAcceptOrReject?: (outcome: AcceptOrRejectOutcome) => void;
}

export default function AcceptRejectAllButtons({
  applyStates,
  onAcceptOrReject,
}: AcceptRejectAllButtonsProps) {
  const { handleAcceptOrReject: runAcceptOrReject } =
    useApplyStateActions(applyStates);

  async function handleAcceptOrReject(status: AcceptOrRejectOutcome) {
    await runAcceptOrReject(status);

    if (onAcceptOrReject) {
      onAcceptOrReject(status);
    }
  }

  const rejectShortcut = `${getMetaKeyLabel()}⇧⌫`;
  const acceptShortcut = `${getMetaKeyLabel()}⇧⏎`;

  return (
    <div
      className="flex flex-row items-center justify-evenly gap-3 px-3"
      data-testid="accept-reject-all-buttons"
    >
      <ToolTip content={`Reject All (${rejectShortcut})`}>
        <button
          className="text-foreground flex cursor-pointer flex-row flex-wrap justify-center gap-1 border-none bg-transparent p-0 text-xs opacity-80 hover:opacity-100 hover:brightness-125"
          onClick={() => handleAcceptOrReject("rejectDiff")}
          data-testid="edit-reject-button"
        >
          <div className="flex flex-row items-center gap-1">
            <XMarkIcon className="text-error h-4 w-4" />
            <span className="hidden sm:inline">Reject</span>
            <span className="text-lightgray -ml-1.5 hidden scale-75 text-xs md:inline">
              {rejectShortcut}
            </span>
          </div>
        </button>
      </ToolTip>

      <ToolTip content={`Accept All (${acceptShortcut})`}>
        <button
          className="text-foreground flex cursor-pointer flex-row flex-wrap justify-center gap-1 border-none bg-transparent p-0 text-xs opacity-80 hover:opacity-100 hover:brightness-125"
          onClick={() => handleAcceptOrReject("acceptDiff")}
          data-testid="edit-accept-button"
        >
          <div className="flex flex-row items-center gap-1">
            <CheckIcon className="text-success h-4 w-4" />
            <span className="hidden sm:inline">Accept</span>
            <span className="text-lightgray -ml-1.5 hidden scale-75 text-xs md:inline">
              {acceptShortcut}
            </span>
          </div>
        </button>
      </ToolTip>
    </div>
  );
}
