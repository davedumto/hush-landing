// Strips HTML tags and control characters from user-submitted text before storage/display.
// This is a second line of defense; React also escapes text content by default.
export function stripHtmlAndControlChars(input: string): string {
  if (!input) return input;
  const withoutTags = input.replace(/<[^>]*>/g, "");
  // Remove control chars except \n (0x0A) and \t (0x09)
  return withoutTags.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}
