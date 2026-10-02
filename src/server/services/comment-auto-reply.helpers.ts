export function buildCommentAutoReplyBody(message: string, url: string): string {
  return `${message.trim()} ${url.trim()}`.trim();
}

export function commentContainsKeyword(commentText: string, keyword: string): boolean {
  const haystack = commentText.trim().toLowerCase();
  const needle = keyword.trim().toLowerCase();
  if (!haystack || !needle) return false;
  return haystack.includes(needle);
}

export const DEFAULT_PUBLIC_REPLY_MESSAGE = "Just sent you a DM with the link ✨";
export const DEFAULT_DM_REPLY_MESSAGE = "Enjoy ✨😊";
