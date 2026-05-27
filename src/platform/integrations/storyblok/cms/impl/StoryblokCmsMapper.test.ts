/**
 * Acceptance tests for `StoryblokCmsMapper`.
 *
 * Two responsibilities, two test sections:
 *  1. TipTap richtext → semantic AST: every TipTap node kind that the
 *     agnostic `RichtextSchema` can represent must yield an equivalent
 *     `RichtextBlock` / `RichtextInline`. The mapper converts the
 *     Storyblok-native TipTap wire format into the schema the agnostic
 *     `<Richtext>` renderer consumes, so a Storyblok-sourced article body
 *     renders through the same code path as a local-JSON one.
 *  2. Story payload → `CMSPage`: `data.story.content.body[]` lifts into
 *     `CMSPage.components[]`, the `component` field becomes `type`,
 *     `_uid` becomes `id`, richtext-typed fields are pre-mapped to the AST.
 *
 * Schema-boundary note: the agnostic `RichtextSchema` represents the
 * TipTap `horizontal_rule` and `hard_break` nodes (as `hr` / `br`) and the
 * `underline` / `strike` marks (as boolean flags), so the mapper maps them
 * faithfully. It still has no `highlight` / `superscript` / `subscript`
 * marks, and the TipTap `blockquote` / `image` / `code_block` nodes have no
 * agnostic equivalent that the mapper can populate from a TipTap payload.
 * Those are silently dropped — the mapper never invents a block kind the
 * schema cannot validate. This boundary is pinned explicitly so the mapper
 * does not grow past what the renderer actually displays.
 */
import type { ISbStoryData, StoryblokRichTextNode } from '@storyblok/react/rsc';
import { BlockTypes, MarkTypes, TextTypes } from '@storyblok/react/rsc';
import { StoryblokCmsMapper } from './StoryblokCmsMapper';

const newMapper = () => new StoryblokCmsMapper();

const textNode = (
  text: string,
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>,
): StoryblokRichTextNode =>
  ({
    type: TextTypes.TEXT,
    text,
    marks,
  }) as unknown as StoryblokRichTextNode;

const paragraph = (...content: StoryblokRichTextNode[]): StoryblokRichTextNode =>
  ({
    type: BlockTypes.PARAGRAPH,
    content,
  }) as unknown as StoryblokRichTextNode;

const doc = (...content: StoryblokRichTextNode[]): StoryblokRichTextNode =>
  ({
    type: BlockTypes.DOCUMENT,
    content,
  }) as unknown as StoryblokRichTextNode;

describe('StoryblokCmsMapper — TipTap to richtext AST (block kinds)', () => {
  it('wraps the TipTap `doc` root by emitting its children as a `RichtextData.blocks` array', () => {
    const result = newMapper().mapRichtext(doc(paragraph(textNode('hello'))), 'id-1');

    expect(result?.type).toBe('richtext');
    expect(result?.id).toBe('id-1');
    expect(result?.blocks).toHaveLength(1);
    expect(result?.blocks[0]?.kind).toBe('paragraph');
  });

  it('maps `paragraph` → `{ kind: "paragraph", inlines: [...] }`', () => {
    const result = newMapper().mapRichtext(doc(paragraph(textNode('hi'))), 'id-2');

    expect(result?.blocks[0]).toEqual({
      kind: 'paragraph',
      inlines: [{ kind: 'text', value: 'hi' }],
    });
  });

  it('maps `heading` with `attrs.level` 1 → `{ kind: "heading", level: 1, inlines: [...] }`', () => {
    const heading: StoryblokRichTextNode = {
      type: BlockTypes.HEADING,
      attrs: { level: 1 },
      content: [textNode('Title')],
    } as unknown as StoryblokRichTextNode;
    const result = newMapper().mapRichtext(doc(heading), 'id-3');

    expect(result?.blocks[0]).toEqual({
      kind: 'heading',
      level: 1,
      inlines: [{ kind: 'text', value: 'Title' }],
    });
  });

  it('maps `heading` with `attrs.level` 2-6 to their respective levels', () => {
    for (const level of [2, 3, 4, 5, 6] as const) {
      const heading: StoryblokRichTextNode = {
        type: BlockTypes.HEADING,
        attrs: { level },
        content: [textNode(`H${level}`)],
      } as unknown as StoryblokRichTextNode;
      const block = newMapper().mapRichtext(doc(heading), `id-h${level}`)?.blocks[0];

      expect(block?.kind).toBe('heading');
      if (block?.kind === 'heading') {
        expect(block.level).toBe(level);
      }
    }
  });

  it('falls back to `level: 1` for headings without an `attrs.level`', () => {
    const heading: StoryblokRichTextNode = {
      type: BlockTypes.HEADING,
      content: [textNode('No level')],
    } as unknown as StoryblokRichTextNode;
    const block = newMapper().mapRichtext(doc(heading), 'id-h-noop')?.blocks[0];

    expect(block?.kind).toBe('heading');
    if (block?.kind === 'heading') {
      expect(block.level).toBe(1);
    }
  });

  it('maps `bullet_list` → `{ kind: "list", ordered: false, items: RichtextInline[][] }`', () => {
    const list: StoryblokRichTextNode = {
      type: BlockTypes.UL_LIST,
      content: [
        { type: BlockTypes.LIST_ITEM, content: [paragraph(textNode('one'))] } as unknown as StoryblokRichTextNode,
      ],
    } as unknown as StoryblokRichTextNode;
    const block = newMapper().mapRichtext(doc(list), 'id-ul')?.blocks[0];

    expect(block?.kind).toBe('list');
    if (block?.kind === 'list') {
      expect(block.ordered).toBe(false);
    }
  });

  it('maps `ordered_list` → `{ kind: "list", ordered: true, items: RichtextInline[][] }`', () => {
    const list: StoryblokRichTextNode = {
      type: BlockTypes.OL_LIST,
      content: [
        { type: BlockTypes.LIST_ITEM, content: [paragraph(textNode('one'))] } as unknown as StoryblokRichTextNode,
      ],
    } as unknown as StoryblokRichTextNode;
    const block = newMapper().mapRichtext(doc(list), 'id-ol')?.blocks[0];

    expect(block?.kind).toBe('list');
    if (block?.kind === 'list') {
      expect(block.ordered).toBe(true);
    }
  });

  it('lifts each `list_item` content into one `items[i]` inlines array', () => {
    const list: StoryblokRichTextNode = {
      type: BlockTypes.UL_LIST,
      content: [
        { type: BlockTypes.LIST_ITEM, content: [paragraph(textNode('one'))] } as unknown as StoryblokRichTextNode,
        { type: BlockTypes.LIST_ITEM, content: [paragraph(textNode('two'))] } as unknown as StoryblokRichTextNode,
        { type: BlockTypes.LIST_ITEM, content: [paragraph(textNode('three'))] } as unknown as StoryblokRichTextNode,
      ],
    } as unknown as StoryblokRichTextNode;
    const block = newMapper().mapRichtext(doc(list), 'id-li')?.blocks[0];

    expect(block?.kind).toBe('list');
    if (block?.kind === 'list') {
      expect(block.items).toHaveLength(3);
      expect(block.items[0]).toEqual([{ kind: 'text', value: 'one' }]);
      expect(block.items[2]).toEqual([{ kind: 'text', value: 'three' }]);
    }
  });
});

describe('StoryblokCmsMapper — TipTap to richtext AST (inline kinds & marks)', () => {
  it('maps a bare `text` node → `{ kind: "text", value }`', () => {
    const block = newMapper().mapRichtext(doc(paragraph(textNode('bare'))), 'id-t1')?.blocks[0];

    if (block?.kind === 'paragraph') {
      expect(block.inlines[0]).toEqual({ kind: 'text', value: 'bare' });
    }
  });

  it('maps a `text` with `marks: [{ type: "bold" }]` → `{ kind: "text", value, bold: true }`', () => {
    const block = newMapper().mapRichtext(doc(paragraph(textNode('loud', [{ type: MarkTypes.BOLD }]))), 'id-t2')
      ?.blocks[0];

    if (block?.kind === 'paragraph') {
      expect(block.inlines[0]).toEqual({ kind: 'text', value: 'loud', bold: true });
    }
  });

  it('maps a `text` with `marks: [{ type: "strong" }]` → `{ kind: "text", value, bold: true }` (strong alias)', () => {
    const block = newMapper().mapRichtext(doc(paragraph(textNode('also-loud', [{ type: MarkTypes.STRONG }]))), 'id-t3')
      ?.blocks[0];

    if (block?.kind === 'paragraph') {
      expect(block.inlines[0]).toEqual({ kind: 'text', value: 'also-loud', bold: true });
    }
  });

  it('maps a `text` with `marks: [{ type: "italic" }]` → `{ kind: "text", value, italic: true }`', () => {
    const block = newMapper().mapRichtext(doc(paragraph(textNode('lean', [{ type: MarkTypes.ITALIC }]))), 'id-t4')
      ?.blocks[0];

    if (block?.kind === 'paragraph') {
      expect(block.inlines[0]).toEqual({ kind: 'text', value: 'lean', italic: true });
    }
  });

  it('maps a `text` with `marks: [{ type: "code" }]` → `{ kind: "text", value, code: true }` (inline code)', () => {
    const block = newMapper().mapRichtext(doc(paragraph(textNode('snip', [{ type: MarkTypes.CODE }]))), 'id-t5')
      ?.blocks[0];

    if (block?.kind === 'paragraph') {
      expect(block.inlines[0]).toEqual({ kind: 'text', value: 'snip', code: true });
    }
  });

  it('maps a `text` with `marks: [{ type: "link", attrs: { href } }]` → `{ kind: "link", href, text }`', () => {
    const block = newMapper().mapRichtext(
      doc(paragraph(textNode('Example', [{ type: MarkTypes.LINK, attrs: { href: 'https://example.com' } }]))),
      'id-t6',
    )?.blocks[0];

    if (block?.kind === 'paragraph') {
      expect(block.inlines[0]).toEqual({ kind: 'link', href: 'https://example.com', text: 'Example' });
    }
  });

  it('combines multiple marks (bold + italic) on the same text node into one inline with both flags', () => {
    const block = newMapper().mapRichtext(
      doc(paragraph(textNode('shout-and-lean', [{ type: MarkTypes.BOLD }, { type: MarkTypes.ITALIC }]))),
      'id-t7',
    )?.blocks[0];

    if (block?.kind === 'paragraph') {
      expect(block.inlines[0]).toEqual({ kind: 'text', value: 'shout-and-lean', bold: true, italic: true });
    }
  });

  it('maps the TipTap `underline` mark → `{ kind: "text", value, underline: true }`', () => {
    const block = newMapper().mapRichtext(doc(paragraph(textNode('under', [{ type: MarkTypes.UNDERLINE }]))), 'id-t8')
      ?.blocks[0];

    if (block?.kind === 'paragraph') {
      expect(block.inlines[0]).toEqual({ kind: 'text', value: 'under', underline: true });
    }
  });

  it('maps the TipTap `strike` mark → `{ kind: "text", value, strike: true }`', () => {
    const block = newMapper().mapRichtext(doc(paragraph(textNode('struck', [{ type: MarkTypes.STRIKE }]))), 'id-t9')
      ?.blocks[0];

    if (block?.kind === 'paragraph') {
      expect(block.inlines[0]).toEqual({ kind: 'text', value: 'struck', strike: true });
    }
  });

  it('drops the TipTap `highlight` / `superscript` / `subscript` marks consistently', () => {
    const block = newMapper().mapRichtext(
      doc(
        paragraph(
          textNode('hi', [{ type: MarkTypes.HIGHLIGHT }]),
          textNode('sup', [{ type: MarkTypes.SUPERSCRIPT }]),
          textNode('sub', [{ type: MarkTypes.SUBSCRIPT }]),
        ),
      ),
      'id-t10',
    )?.blocks[0];

    if (block?.kind === 'paragraph') {
      expect(block.inlines).toEqual([
        { kind: 'text', value: 'hi' },
        { kind: 'text', value: 'sup' },
        { kind: 'text', value: 'sub' },
      ]);
    }
  });
});

describe('StoryblokCmsMapper — structural nodes the agnostic schema represents (mapped)', () => {
  it('maps a TipTap `horizontal_rule` → `{ kind: "hr" }` block', () => {
    const hr: StoryblokRichTextNode = { type: BlockTypes.HR } as unknown as StoryblokRichTextNode;
    const result = newMapper().mapRichtext(doc(paragraph(textNode('before')), hr), 'id-hr');

    expect(result?.blocks).toHaveLength(2);
    expect(result?.blocks[0]?.kind).toBe('paragraph');
    expect(result?.blocks[1]).toEqual({ kind: 'hr' });
  });

  it('maps a TipTap `hard_break` inline → `{ kind: "br" }`, preserving surrounding text', () => {
    const para = paragraph(
      textNode('line one'),
      { type: BlockTypes.BR } as unknown as StoryblokRichTextNode,
      textNode('line two'),
    );
    const block = newMapper().mapRichtext(doc(para), 'id-br')?.blocks[0];

    if (block?.kind === 'paragraph') {
      expect(block.inlines).toEqual([
        { kind: 'text', value: 'line one' },
        { kind: 'br' },
        { kind: 'text', value: 'line two' },
      ]);
    }
  });
});

describe('StoryblokCmsMapper — nodes the agnostic schema cannot represent (dropped)', () => {
  // The TipTap `blockquote` / `image` / `code_block` nodes carry content the
  // mapper cannot faithfully translate from a TipTap payload, and the schema
  // has no `highlight` / `superscript` / `subscript` marks. Rather than
  // invent a block kind the schema cannot validate, the mapper drops these
  // silently — matching the renderer surface.
  it('drops a TipTap `blockquote` (no faithful agnostic mapping from a TipTap payload)', () => {
    const quote: StoryblokRichTextNode = {
      type: BlockTypes.QUOTE,
      content: [paragraph(textNode('wisdom'))],
    } as unknown as StoryblokRichTextNode;
    const result = newMapper().mapRichtext(doc(paragraph(textNode('before')), quote), 'id-q');

    expect(result?.blocks).toHaveLength(1);
    expect(result?.blocks.map((b) => b.kind)).not.toContain('quote');
  });

  it('drops a TipTap `image`', () => {
    const image: StoryblokRichTextNode = {
      type: BlockTypes.IMAGE,
      attrs: { src: '/pic.png', alt: 'A pic' },
    } as unknown as StoryblokRichTextNode;
    const result = newMapper().mapRichtext(doc(paragraph(textNode('before')), image), 'id-img');

    expect(result?.blocks.map((b) => b.kind)).not.toContain('image');
  });

  it('drops a TipTap `code_block`', () => {
    const code: StoryblokRichTextNode = {
      type: BlockTypes.CODE_BLOCK,
      attrs: { language: 'ts' },
      content: [textNode('const x = 1;')],
    } as unknown as StoryblokRichTextNode;
    const result = newMapper().mapRichtext(doc(paragraph(textNode('before')), code), 'id-c');

    expect(result?.blocks.map((b) => b.kind)).not.toContain('code');
  });
});

describe('StoryblokCmsMapper — unknown / malformed input', () => {
  it('drops unknown TipTap node kinds silently (does not throw)', () => {
    const unknownKind: StoryblokRichTextNode = {
      type: 'never_existed_as_block_kind',
    } as unknown as StoryblokRichTextNode;
    const para = paragraph(textNode('after'));

    expect(() => newMapper().mapRichtext(doc(unknownKind, para), 'id-u1')).not.toThrow();
    const result = newMapper().mapRichtext(doc(unknownKind, para), 'id-u1');

    expect(result?.blocks).toHaveLength(1);
    expect(result?.blocks[0]?.kind).toBe('paragraph');
  });

  it('treats `content: undefined` as no richtext (returns undefined, no crash)', () => {
    expect(newMapper().mapRichtext(undefined, 'id-u2')).toBeUndefined();
  });

  it('treats `content: null` the same as undefined', () => {
    expect(newMapper().mapRichtext(null, 'id-u3')).toBeUndefined();
  });

  it('treats an empty `content: []` doc as no richtext (no empty block emitted)', () => {
    expect(newMapper().mapRichtext(doc(), 'id-u4')).toBeUndefined();
  });
});

describe('StoryblokCmsMapper — mapPage (story payload to CMSPage)', () => {
  const buildStory = (content: Record<string, unknown>, overrides: Partial<ISbStoryData> = {}): ISbStoryData =>
    ({
      id: 1,
      full_slug: 'main/about',
      slug: 'about',
      name: 'About',
      content,
      ...overrides,
    }) as unknown as ISbStoryData;

  it('maps page-level metadata (title, description, url, no_margin)', () => {
    const page = newMapper().mapPage(
      buildStory({ title: 'About Title', description: 'About Desc', no_margin: true, body: [] }),
    );

    expect(page.title).toBe('About Title');
    expect(page.description).toBe('About Desc');
    expect(page.url).toBe('main/about');
    expect(page.no_margin).toBe(true);
  });

  it('derives `url` from full_slug, falling back to slug', () => {
    const withFull = newMapper().mapPage(buildStory({ body: [] }, { full_slug: 'us/about', slug: 'about' }));
    const withoutFull = newMapper().mapPage(buildStory({ body: [] }, { full_slug: undefined, slug: 'about' }));

    expect(withFull.url).toBe('us/about');
    expect(withoutFull.url).toBe('about');
  });

  it('lifts each `content.body[]` entry into `components[]`, mapping `component` → `type` and `_uid` → `id`', () => {
    const page = newMapper().mapPage(
      buildStory({
        body: [
          { _uid: 'b1', component: 'button', title: 'Click me', link: '/x' },
          { _uid: 'b2', component: 'hero', headline: 'Welcome' },
        ],
      }),
    );

    expect(page.components).toHaveLength(2);
    expect(page.components[0]).toEqual(expect.objectContaining({ id: 'b1', type: 'button', title: 'Click me' }));
    expect(page.components[1]).toEqual(expect.objectContaining({ id: 'b2', type: 'hero' }));
  });

  it('does not carry the raw Storyblok `_uid` / `component` keys onto the mapped component', () => {
    const page = newMapper().mapPage(
      buildStory({ body: [{ _uid: 'b1', component: 'button', title: 'Click me', link: '/x' }] }),
    );

    const mapped = page.components[0] as Record<string, unknown>;
    expect(mapped._uid).toBeUndefined();
    expect(mapped.component).toBeUndefined();
  });

  it('pre-maps an `article` component body (TipTap `content`) into the agnostic richtext AST', () => {
    const page = newMapper().mapPage(
      buildStory({
        body: [
          {
            _uid: 'art-1',
            component: 'article',
            title: 'A',
            content: doc(paragraph(textNode('Body sentence.'))),
          },
        ],
      }),
    );

    const article = page.components[0] as Record<string, unknown>;
    expect(article.content).toEqual({
      id: 'art-1',
      type: 'richtext',
      blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', value: 'Body sentence.' }] }],
    });
  });

  it('returns an empty `components` array for a story with no body', () => {
    expect(newMapper().mapPage(buildStory({ body: undefined })).components).toEqual([]);
  });

  it('survives an unknown story shape without throwing (best-effort metadata, empty components)', () => {
    const garbage = { id: 1 } as unknown as ISbStoryData;

    expect(() => newMapper().mapPage(garbage)).not.toThrow();
    expect(newMapper().mapPage(garbage).components).toEqual([]);
  });
});
