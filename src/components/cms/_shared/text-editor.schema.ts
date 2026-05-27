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
