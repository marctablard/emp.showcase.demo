/**
 * TipTap / Storyblok richtext node & mark type constants.
 *
 * `@storyblok/react` v7 (+ `@storyblok/js` v6) no longer re-export
 * `BlockTypes` / `MarkTypes` / `TextTypes` / `StoryblokRichTextNode` from
 * `/rsc`. The wire-format string values are stable TipTap node names; keep
 * them local so the mapper stays SDK-version-independent.
 */

export const BlockTypes = {
  DOCUMENT: 'doc',
  HEADING: 'heading',
  PARAGRAPH: 'paragraph',
  QUOTE: 'blockquote',
  OL_LIST: 'ordered_list',
  UL_LIST: 'bullet_list',
  LIST_ITEM: 'list_item',
  CODE_BLOCK: 'code_block',
  HR: 'horizontal_rule',
  BR: 'hard_break',
  IMAGE: 'image',
  EMOJI: 'emoji',
  COMPONENT: 'blok',
} as const;

export const MarkTypes = {
  BOLD: 'bold',
  STRONG: 'strong',
  STRIKE: 'strike',
  UNDERLINE: 'underline',
  ITALIC: 'italic',
  CODE: 'code',
  LINK: 'link',
  ANCHOR: 'anchor',
  STYLED: 'styled',
  SUPERSCRIPT: 'superscript',
  SUBSCRIPT: 'subscript',
  TEXT_STYLE: 'textStyle',
  HIGHLIGHT: 'highlight',
} as const;

export const TextTypes = {
  TEXT: 'text',
} as const;

export type StoryblokRichTextNodeTypes =
  | (typeof BlockTypes)[keyof typeof BlockTypes]
  | (typeof MarkTypes)[keyof typeof MarkTypes]
  | (typeof TextTypes)[keyof typeof TextTypes];

export interface StoryblokRichTextNode {
  type: string;
  content?: StoryblokRichTextNode[];
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}
