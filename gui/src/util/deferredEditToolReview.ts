import { BuiltInToolNames } from "core/tools/builtIn";

// MVP is now enabled so edit tools can queue multiple pending diffs for unified review.
export const ENABLE_DEFERRED_EDIT_TOOL_REVIEW = true;

const DEFERRED_REVIEW_TOOL_NAMES = new Set<string>([
  BuiltInToolNames.EditExistingFile,
  BuiltInToolNames.SingleFindAndReplace,
  BuiltInToolNames.MultiEdit,
]);

export function shouldDeferEditToolReview(toolName?: string): boolean {
  return (
    ENABLE_DEFERRED_EDIT_TOOL_REVIEW &&
    !!toolName &&
    DEFERRED_REVIEW_TOOL_NAMES.has(toolName)
  );
}
