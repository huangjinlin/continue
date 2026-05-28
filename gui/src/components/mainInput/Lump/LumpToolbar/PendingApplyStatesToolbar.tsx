import { ApplyState } from "core";
import { getUriPathBasename } from "core/util/uri";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import AcceptRejectDiffButtons from "../../../AcceptRejectDiffButtons";
import FileAcceptRejectDiffButtons from "../../../FileAcceptRejectDiffButtons";
import FileIcon from "../../../FileIcon";

interface PendingApplyStatesToolbarProps {
  pendingApplyStates: ApplyState[];
}

export function PendingApplyStatesToolbar({
  pendingApplyStates,
}: PendingApplyStatesToolbarProps) {
  const ideMessenger = useContext(IdeMessengerContext);
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
        <div className="flex flex-col gap-1">
          {pendingFileEntries.map(([filepath, states]) => {
            const displayName = filepath
              ? getUriPathBasename(filepath)
              : "Unknown file";

            return (
              <div
                key={filepath || "__unknown__"}
                data-testid="pending-apply-file"
                className="bg-badge flex items-center justify-between gap-3 rounded px-2 py-1"
              >
                <button
                  type="button"
                  data-testid="pending-apply-file-name"
                  className="text-foreground flex min-w-0 flex-1 cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left text-xs hover:brightness-125 disabled:cursor-default disabled:hover:brightness-100"
                  disabled={!filepath}
                  onClick={() => {
                    if (!filepath) {
                      return;
                    }
                    ideMessenger.post("showFile", {
                      filepath,
                    });
                  }}
                >
                  <FileIcon filename={filepath} height="18px" width="18px" />
                  <span className="truncate">{displayName}</span>
                  {states.length > 1 && (
                    <span className="text-lightgray px-1 text-[10px]">
                      x{states.length}
                    </span>
                  )}
                </button>
                <FileAcceptRejectDiffButtons applyStates={states} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
