import { useContext } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { PendingReviewItem } from "../../../../redux/selectors/selectToolCalls";
import {
  FilePendingReviewActionButtons,
  PendingReviewActionButtons,
} from "../../../PendingReviewActionButtons";
import { PendingReviewToolbar } from "./PendingReviewToolbar";

interface PendingReviewItemsToolbarProps {
  pendingReviewItems: PendingReviewItem[];
}

export function PendingReviewItemsToolbar({
  pendingReviewItems,
}: PendingReviewItemsToolbarProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <PendingReviewToolbar
      pendingReviewItems={pendingReviewItems}
      renderGlobalActions={(items) => (
        <PendingReviewActionButtons pendingReviewItems={items} />
      )}
      canOpenFile={(entry) =>
        entry.items.every((item) => item.kind === "apply")
      }
      onOpenFile={(entry) => {
        if (!entry.filepath) {
          return;
        }

        ideMessenger.post("showFile", {
          filepath: entry.filepath,
        });
      }}
      renderFileActions={(entry) => (
        <FilePendingReviewActionButtons pendingReviewItems={entry.items} />
      )}
    />
  );
}
