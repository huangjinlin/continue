import { ApplyState } from "core";
import { getUriPathBasename } from "core/util/uri";
import AcceptRejectDiffButtons from "../../../AcceptRejectDiffButtons";
import FileIcon from "../../../FileIcon";

interface PendingApplyStatesToolbarProps {
  pendingApplyStates: ApplyState[];
}

export function PendingApplyStatesToolbar({
  pendingApplyStates,
}: PendingApplyStatesToolbarProps) {
  const applyStatesByFilepath = pendingApplyStates.reduce(
    (acc, state) => {
      const filepath = state.filepath || ""; // Use empty string as fallback
      if (!acc[filepath]) {
        acc[filepath] = [];
      }
      acc[filepath].push(state);
      return acc;
    },
    {} as Record<string, ApplyState[]>,
  );
  const pendingFileEntries = Object.entries(applyStatesByFilepath);
  const pendingFileCount =
    pendingFileEntries.length || pendingApplyStates.length;
  const pendingFilesLabel =
    pendingFileCount === 1
      ? "1 pending file"
      : `${pendingFileCount} pending files`;

  return (
    <div className="flex flex-col gap-2">
      <div
        data-testid="pending-apply-global-actions"
        className="bg-badge flex items-center justify-between gap-3 rounded px-2 py-1"
      >
        <span className="text-xs">{pendingFilesLabel}</span>
        <AcceptRejectDiffButtons
          applyStates={pendingApplyStates}
          onAcceptOrReject={async () => {}}
        />
      </div>
      {pendingFileEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingFileEntries.map(([filepath, states]) => (
            <span
              key={filepath}
              data-testid="pending-apply-file"
              className="bg-badge flex min-w-0 max-w-full items-center gap-1 rounded pr-1 text-xs"
            >
              <FileIcon filename={filepath} height="18px" width="18px" />
              <span className="truncate">{getUriPathBasename(filepath)}</span>
              {states.length > 1 && (
                <span className="text-lightgray px-1 text-[10px]">
                  x{states.length}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
