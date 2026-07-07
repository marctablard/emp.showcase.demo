/**
 * Removes <mark> and </mark> tags from a string while preserving all other content.
 * @param value The string that may contain <mark> tags
 * @returns The string with <mark> and </mark> tags removed
 */
export function clearMarkHighlights(value: string | undefined | null): string {
  if (value == null) {
    return '';
  }
  return String(value).replace(/<\/?mark>/g, '');
}
