import { ApplyState } from "core";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { PendingReviewItem } from "../../../../redux/selectors/selectToolCalls";
import AcceptRejectDiffButtons from "../../../AcceptRejectDiffButtons";
import FileAcceptRejectDiffButtons from "../../../FileAcceptRejectDiffButtons";
import { PendingReviewToolbar } from "./PendingReviewToolbar";

interface PendingApplyStatesToolbarProps {
  pendingApplyStates: ApplyState[];
}

export function PendingApplyStatesToolbar({
  pendingApplyStates,
}: PendingApplyStatesToolbarProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const pendingReviewItems: PendingReviewItem[] = pendingApplyStates.map(
    (applyState) => ({
      key: `apply:${applyState.streamId}`,
      kind: "apply",
      filepath: applyState.filepath ?? "",
      applyState,
    }),
  );

  return (
    <PendingReviewToolbar
      pendingReviewItems={pendingReviewItems}
      renderGlobalActions={() => (
        <AcceptRejectDiffButtons
          applyStates={pendingApplyStates}
          onAcceptOrReject={async () => {}}
        />
      )}
      canOpenFile={() => true}
      onOpenFile={(entry) => {
        if (!entry.filepath) {
          return;
        }

        ideMessenger.post("showFile", {
          filepath: entry.filepath,
        });
      }}
      renderFileActions={(entry) => {
        const applyStates = entry.items.flatMap((item) =>
          item.kind === "apply" ? [item.applyState] : [],
        );

        return <FileAcceptRejectDiffButtons applyStates={applyStates} />;
      }}
    />
  );
}
