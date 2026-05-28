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
  // Group apply states by filepath
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
  const shouldShowGlobalActions = pendingFileEntries.length > 1;

  return (
    <div className="flex flex-col gap-2">
      {shouldShowGlobalActions && (
        <div
          data-testid="pending-apply-global-actions"
          className="bg-badge flex items-center justify-between gap-3 rounded px-2 py-1"
        >
          <span className="text-xs">All pending changes</span>
          <AcceptRejectDiffButtons
            applyStates={pendingApplyStates}
            onAcceptOrReject={async () => {}}
          />
        </div>
      )}
      {pendingFileEntries.map(([filepath, states]) => (
        <div key={filepath} className="flex justify-between gap-3">
          {filepath && (
            <span className="bg-badge flex min-w-0 max-w-[75%] items-center gap-1 truncate rounded pr-1 text-xs">
              <FileIcon filename={filepath} height="18px" width="18px" />
              <span className="truncate">{getUriPathBasename(filepath)}</span>
            </span>
          )}
          <AcceptRejectDiffButtons
            applyStates={states}
            onAcceptOrReject={async () => {}}
          />
        </div>
      ))}
    </div>
  );
}
