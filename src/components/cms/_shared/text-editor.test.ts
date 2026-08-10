/**
 * Unit tests for `extractTipTapText`.
 *
 * The helper joins all text leaves across all paragraph blocks in a raw
 * TipTap editor payload (hero / media-text `text` field). All leaves within
 * one block are concatenated directly; blocks are separated by `\n`.
 * An empty payload returns an empty string — no crash, no `undefined`.
 */
import { extractTipTapText } from './text-editor.schema';
import type { TextEditorData } from './text-editor.schema';

const paragraph = (...texts: string[]): TextEditorData['content'][number] => ({
  type: 'paragraph',
  content: texts.map((text) => ({ text })),
});

describe('extractTipTapText', () => {
  it('returns the text of a single leaf in a single paragraph', () => {
    const data: TextEditorData = { content: [paragraph('Hello world.')] };

    expect(extractTipTapText(data)).toBe('Hello world.');
  });

  it('joins multiple leaves within one paragraph directly (no separator)', () => {
    const data: TextEditorData = { content: [paragraph('Hello', ' ', 'world.')] };

    expect(extractTipTapText(data)).toBe('Hello world.');
  });

  it('joins multiple paragraphs with a newline separator', () => {
    const data: TextEditorData = {
      content: [paragraph('First paragraph.'), paragraph('Second paragraph.')],
    };

    expect(extractTipTapText(data)).toBe('First paragraph.\nSecond paragraph.');
  });

  it('skips empty paragraphs (content: []) without emitting blank lines', () => {
    const emptyParagraph: TextEditorData['content'][number] = { type: 'paragraph', content: [] };
    const data: TextEditorData = {
      content: [paragraph('Before.'), emptyParagraph, paragraph('After.')],
    };

    expect(extractTipTapText(data)).toBe('Before.\nAfter.');
  });

  it('returns an empty string for a doc with no paragraphs', () => {
    const data: TextEditorData = { content: [] };

    expect(extractTipTapText(data)).toBe('');
  });

  it('handles a single paragraph with a single leaf — regression for the original [0][0] path', () => {
    const data: TextEditorData = { content: [paragraph('Sub-headline text.')] };

    // The old code read only content[0]?.content[0]?.text — this test pins that the
    // helper still returns the same result for the single-paragraph, single-leaf case.
    expect(extractTipTapText(data)).toBe('Sub-headline text.');
  });
});
