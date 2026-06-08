import { z } from 'zod';

/**
 * Shared rich-text editor payload used by multiple CMS components (hero,
 * media-text). The editor serialises content as a nested `content[]` tree of
 * blocks, each holding text leaves.
 */
const TextLeafSchema = z.object({
  text: z.string(),
});

const TextEditorBlockSchema = z.object({
  type: z.string(),
  content: z.array(TextLeafSchema),
});

export const TextEditorDataSchema = z.object({
  content: z.array(TextEditorBlockSchema),
});

export type TextEditorData = z.infer<typeof TextEditorDataSchema>;

/**
 * Joins all text leaves across every paragraph block into a single string.
 * Leaves within one block are concatenated directly; blocks are separated
 * by `\n`. Empty blocks are omitted. Returns `''` for an empty payload.
 *
 * Use this instead of `data.content[0]?.content[0]?.text` so that
 * multi-paragraph / multi-leaf hero and media-text bodies are not silently
 * truncated to the first leaf.
 */
export function extractTipTapText(data: TextEditorData): string {
  return data.content
    .map((block) => block.content.map((leaf) => leaf.text).join(''))
    .filter(Boolean)
    .join('\n');
}
