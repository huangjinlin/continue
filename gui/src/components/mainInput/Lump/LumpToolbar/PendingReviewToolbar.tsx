import { getUriPathBasename } from "core/util/uri";
import { ReactNode } from "react";
import { PendingReviewItem } from "../../../../redux/selectors/selectToolCalls";
import FileIcon from "../../../FileIcon";

export interface PendingReviewFileEntry {
  key: string;
  filepath: string;
  items: PendingReviewItem[];
}

interface PendingReviewToolbarProps {
  pendingReviewItems: PendingReviewItem[];
  renderGlobalActions?: (pendingReviewItems: PendingReviewItem[]) => ReactNode;
  renderFileActions?: (entry: PendingReviewFileEntry) => ReactNode;
  canOpenFile?: (entry: PendingReviewFileEntry) => boolean;
  onOpenFile?: (entry: PendingReviewFileEntry) => void;
}

export function PendingReviewToolbar({
  pendingReviewItems,
  renderGlobalActions,
  renderFileActions,
  canOpenFile,
  onOpenFile,
}: PendingReviewToolbarProps) {
  const pendingReviewFilesByFilepath = pendingReviewItems.reduce(
    (acc, item) => {
      const filepath = item.filepath || "";
      if (!acc[filepath]) {
        acc[filepath] = [];
      }
      acc[filepath].push(item);
      return acc;
    },
    {} as Record<string, PendingReviewItem[]>,
  );

  const pendingFileEntries = Object.entries(pendingReviewFilesByFilepath).map(
    ([filepath, items]) => ({
      key: filepath || items.map((item) => item.key).join("|") || "__unknown__",
      filepath,
      items,
    }),
  );

  const pendingFileCount =
    pendingFileEntries.length || pendingReviewItems.length;
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
        {renderGlobalActions?.(pendingReviewItems)}
      </div>

      {pendingFileEntries.length > 0 && (
        <div className="flex flex-col gap-1">
          {pendingFileEntries.map((entry) => {
            const displayName = entry.filepath
              ? getUriPathBasename(entry.filepath)
              : "Unknown file";
            const isFileOpenable =
              !!entry.filepath && (canOpenFile ? canOpenFile(entry) : true);

            return (
              <div
                key={entry.key}
                data-testid="pending-apply-file"
                className="bg-badge flex items-center justify-between gap-3 rounded px-2 py-1"
              >
                <button
                  type="button"
                  data-testid="pending-apply-file-name"
                  className="text-foreground flex min-w-0 flex-1 cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left text-xs hover:brightness-125 disabled:cursor-default disabled:hover:brightness-100"
                  disabled={!isFileOpenable}
                  onClick={() => onOpenFile?.(entry)}
                >
                  <FileIcon
                    filename={entry.filepath || displayName}
                    height="18px"
                    width="18px"
                  />
                  <span className="truncate">{displayName}</span>
                  {entry.items.length > 1 && (
                    <span className="text-lightgray px-1 text-[10px]">
                      x{entry.items.length}
                    </span>
                  )}
                </button>
                {renderFileActions?.(entry)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
