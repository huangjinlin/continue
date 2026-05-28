import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { AcceptOrRejectOutcome } from "../hooks/useApplyStateActions";
import { usePendingReviewActions } from "../hooks/usePendingReviewActions";
import { PendingReviewItem } from "../redux/selectors/selectToolCalls";
import { getMetaKeyLabel } from "../util";
import { ToolTip } from "./gui/Tooltip";

interface PendingReviewActionButtonsProps {
  pendingReviewItems: PendingReviewItem[];
  onAcceptOrReject?: (outcome: AcceptOrRejectOutcome) => void;
}

export function PendingReviewActionButtons({
  pendingReviewItems,
  onAcceptOrReject,
}: PendingReviewActionButtonsProps) {
  const { handleAcceptOrReject: runAcceptOrReject } =
    usePendingReviewActions(pendingReviewItems);

  async function handleAcceptOrReject(outcome: AcceptOrRejectOutcome) {
    await runAcceptOrReject(outcome);
    onAcceptOrReject?.(outcome);
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

interface FilePendingReviewActionButtonsProps {
  pendingReviewItems: PendingReviewItem[];
  onAcceptOrReject?: (outcome: AcceptOrRejectOutcome) => void;
}

export function FilePendingReviewActionButtons({
  pendingReviewItems,
  onAcceptOrReject,
}: FilePendingReviewActionButtonsProps) {
  const { handleAcceptOrReject } = usePendingReviewActions(pendingReviewItems);

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
