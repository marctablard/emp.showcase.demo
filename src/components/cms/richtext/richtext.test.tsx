/**
 * Failing-test contract for the `richtext` CMS component.
 *
 * Richtext is the agnostic-AST pilot: the schema is a CMS-provider-free
 * semantic block tree that intentionally does NOT reuse provider-specific
 * (e.g. TipTap / ProseMirror / Storyblok) node naming. Adapters are
 * responsible for mapping their wire format into this AST.
 *
 * The contract covers three concerns:
 *
 * 1. AST coverage — every documented block-kind and inline-kind round-trips
 *    through `RichtextSchema.parse`.
 * 2. Root rendering — the component renders a single root element that
 *    spreads HTML attributes and merges className via `cn(...)`.
 * 3. Block & inline rendering — each block-kind maps to its semantic DOM
 *    element (`<h1>`..`<h6>`, `<p>`, `<ol>`/`<ul>`, `<img>`,
 *    `<blockquote>`, `<pre>`/`<code>`); each inline-kind to its mark or
 *    anchor counterpart. The DOM is pinned (rather than class names or
 *    schema internals) so the test survives implementation choices.
 *
 * The schema, component, and barrel file do not exist yet — these tests
 * are red until the co-located implementation lands.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Richtext, { type RichtextData, RichtextSchema } from './index';

const text = (value: string) => ({ kind: 'text' as const, value });

describe('Richtext — schema (block AST)', () => {
  it('parses a heading block with a valid level (1–6) and inlines', () => {
    const parsed = RichtextSchema.parse({
      id: 'rt-h',
      type: 'richtext',
      blocks: [{ kind: 'heading', level: 2, inlines: [text('Section title')] }],
    });

    const first = parsed.blocks[0];
    expect(first?.kind).toBe('heading');
  });

  it('rejects a heading block with a level outside 1–6', () => {
    expect(() =>
      RichtextSchema.parse({
        id: 'rt-h',
        type: 'richtext',
        blocks: [{ kind: 'heading', level: 7, inlines: [text('Too deep')] }],
      }),
    ).toThrow();
  });

  it('parses a paragraph block with an array of inlines', () => {
    const parsed = RichtextSchema.parse({
      id: 'rt-p',
      type: 'richtext',
      blocks: [{ kind: 'paragraph', inlines: [text('A sentence.')] }],
    });

    expect(parsed.blocks[0]?.kind).toBe('paragraph');
  });

  it('parses an ordered and an unordered list block (items = inline[][] per item)', () => {
    const parsed = RichtextSchema.parse({
      id: 'rt-l',
      type: 'richtext',
      blocks: [
        { kind: 'list', ordered: true, items: [[text('one')], [text('two')]] },
        { kind: 'list', ordered: false, items: [[text('a')]] },
      ],
    });

    const ordered = parsed.blocks[0];
    const unordered = parsed.blocks[1];
    if (ordered?.kind === 'list') expect(ordered.ordered).toBe(true);
    if (unordered?.kind === 'list') expect(unordered.ordered).toBe(false);
  });

  it('parses an image block with a required `src` and optional `alt`', () => {
    const parsed = RichtextSchema.parse({
      id: 'rt-img',
      type: 'richtext',
      blocks: [{ kind: 'image', src: '/img.png', alt: 'pic' }],
    });

    expect(parsed.blocks[0]?.kind).toBe('image');
  });

  it('parses a quote block with inlines', () => {
    const parsed = RichtextSchema.parse({
      id: 'rt-q',
      type: 'richtext',
      blocks: [{ kind: 'quote', inlines: [text('quoted')] }],
    });

    expect(parsed.blocks[0]?.kind).toBe('quote');
  });

  it('parses a code block with required `value` and optional `language`', () => {
    const parsed = RichtextSchema.parse({
      id: 'rt-c',
      type: 'richtext',
      blocks: [{ kind: 'code', language: 'ts', value: 'const x = 1;' }],
    });

    expect(parsed.blocks[0]?.kind).toBe('code');
  });

  it('parses a text inline with optional marks', () => {
    const parsed = RichtextSchema.parse({
      id: 'rt-marks',
      type: 'richtext',
      blocks: [
        {
          kind: 'paragraph',
          inlines: [{ kind: 'text', value: 'bold and italic', bold: true, italic: true }],
        },
      ],
    });

    expect(parsed.blocks[0]?.kind).toBe('paragraph');
  });

  it('parses a link inline with required href and text', () => {
    const parsed = RichtextSchema.parse({
      id: 'rt-link',
      type: 'richtext',
      blocks: [
        {
          kind: 'paragraph',
          inlines: [{ kind: 'link', href: 'https://example.com', text: 'Example' }],
        },
      ],
    });

    expect(parsed.blocks[0]?.kind).toBe('paragraph');
  });

  it('rejects an inline with an unknown discriminator kind', () => {
    expect(() =>
      RichtextSchema.parse({
        id: 'rt-bad',
        type: 'richtext',
        blocks: [{ kind: 'paragraph', inlines: [{ kind: 'shrug', value: 'nope' }] }],
      }),
    ).toThrow();
  });

  it('rejects a richtext payload with a wrong discriminator value', () => {
    expect(() =>
      RichtextSchema.parse({
        id: 'rt-x',
        type: 'hero',
        blocks: [],
      }),
    ).toThrow();
  });
});

describe('Richtext — component (root contract)', () => {
  const MINIMAL: RichtextData = {
    id: 'rt-1',
    type: 'richtext',
    blocks: [{ kind: 'paragraph', inlines: [text('hello world')] }],
  };

  it('renders inline text content into the document', () => {
    const { getByText } = render(<Richtext {...MINIMAL} />);

    expect(getByText('hello world')).toBeInTheDocument();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Richtext {...MINIMAL} data-testid="cms-richtext-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-richtext-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Richtext {...MINIMAL} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });

  it('spreads `data-blok-*` editor attributes onto its root', () => {
    const { container } = render(<Richtext {...MINIMAL} data-blok-c="richtext" data-blok-uid="editable-uid-rt" />);

    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-blok-c')).toBe('richtext');
    expect(root.getAttribute('data-blok-uid')).toBe('editable-uid-rt');
  });
});

describe('Richtext — block rendering (semantic DOM)', () => {
  it('renders a heading block as the matching <hN> element', () => {
    const data: RichtextData = {
      id: 'rt-h',
      type: 'richtext',
      blocks: [
        { kind: 'heading', level: 1, inlines: [text('Level one')] },
        { kind: 'heading', level: 3, inlines: [text('Level three')] },
      ],
    };

    const { getByRole } = render(<Richtext {...data} />);

    expect(getByRole('heading', { level: 1, name: 'Level one' })).toBeInTheDocument();
    expect(getByRole('heading', { level: 3, name: 'Level three' })).toBeInTheDocument();
  });

  it('renders a paragraph block as a <p>', () => {
    const data: RichtextData = {
      id: 'rt-p',
      type: 'richtext',
      blocks: [{ kind: 'paragraph', inlines: [text('a paragraph')] }],
    };

    const { container, getByText } = render(<Richtext {...data} />);

    expect(getByText('a paragraph').closest('p')).not.toBeNull();
    expect(container.querySelector('p')).not.toBeNull();
  });

  it('renders an ordered list block as <ol> with <li> items', () => {
    const data: RichtextData = {
      id: 'rt-ol',
      type: 'richtext',
      blocks: [{ kind: 'list', ordered: true, items: [[text('first')], [text('second')]] }],
    };

    const { container } = render(<Richtext {...data} />);

    expect(container.querySelector('ol')).not.toBeNull();
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
  });

  it('renders an unordered list block as <ul> with <li> items', () => {
    const data: RichtextData = {
      id: 'rt-ul',
      type: 'richtext',
      blocks: [{ kind: 'list', ordered: false, items: [[text('a')]] }],
    };

    const { container } = render(<Richtext {...data} />);

    expect(container.querySelector('ul')).not.toBeNull();
    expect(container.querySelectorAll('ul > li')).toHaveLength(1);
  });

  it('renders an image block as <img> with the provided src and alt', () => {
    const data: RichtextData = {
      id: 'rt-img',
      type: 'richtext',
      blocks: [{ kind: 'image', src: '/cat.jpg', alt: 'a cat' }],
    };

    const { container } = render(<Richtext {...data} />);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/cat.jpg');
    expect(img?.getAttribute('alt')).toBe('a cat');
  });

  it('renders a quote block inside a <blockquote>', () => {
    const data: RichtextData = {
      id: 'rt-q',
      type: 'richtext',
      blocks: [{ kind: 'quote', inlines: [text('quoted text')] }],
    };

    const { container, getByText } = render(<Richtext {...data} />);

    expect(container.querySelector('blockquote')).not.toBeNull();
    expect(getByText('quoted text').closest('blockquote')).not.toBeNull();
  });

  it('renders a code block inside a <pre><code> element', () => {
    const data: RichtextData = {
      id: 'rt-c',
      type: 'richtext',
      blocks: [{ kind: 'code', language: 'ts', value: 'const x = 1;' }],
    };

    const { container } = render(<Richtext {...data} />);

    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.querySelector('code')).not.toBeNull();
    expect(pre?.textContent).toContain('const x = 1;');
  });
});

describe('Richtext — inline rendering (semantic DOM)', () => {
  it('renders a link inline as <a> with the right href and text', () => {
    const data: RichtextData = {
      id: 'rt-link',
      type: 'richtext',
      blocks: [
        {
          kind: 'paragraph',
          inlines: [{ kind: 'link', href: 'https://example.com', text: 'Example' }],
        },
      ],
    };

    const { getByRole } = render(<Richtext {...data} />);

    const link = getByRole('link', { name: 'Example' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://example.com');
  });

  it('renders bold text inside a <strong>/<b> element', () => {
    const data: RichtextData = {
      id: 'rt-bold',
      type: 'richtext',
      blocks: [
        {
          kind: 'paragraph',
          inlines: [{ kind: 'text', value: 'loud', bold: true }],
        },
      ],
    };

    const { container } = render(<Richtext {...data} />);

    const loud = container.querySelector('strong, b');
    expect(loud).not.toBeNull();
    expect(loud?.textContent).toBe('loud');
  });

  it('renders italic text inside an <em>/<i> element', () => {
    const data: RichtextData = {
      id: 'rt-italic',
      type: 'richtext',
      blocks: [
        {
          kind: 'paragraph',
          inlines: [{ kind: 'text', value: 'leaning', italic: true }],
        },
      ],
    };

    const { container } = render(<Richtext {...data} />);

    const leaning = container.querySelector('em, i');
    expect(leaning).not.toBeNull();
    expect(leaning?.textContent).toBe('leaning');
  });

  it('renders inline code text inside a <code> element (not inside <pre>)', () => {
    const data: RichtextData = {
      id: 'rt-inline-code',
      type: 'richtext',
      blocks: [
        {
          kind: 'paragraph',
          inlines: [{ kind: 'text', value: 'snippet', code: true }],
        },
      ],
    };

    const { container } = render(<Richtext {...data} />);

    const inlineCode = container.querySelector('p code');
    expect(inlineCode).not.toBeNull();
    expect(inlineCode?.textContent).toBe('snippet');
  });
});

describe('Richtext — provider-decoupling guarantee', () => {
  it('renders a non-provider AST without depending on provider-specific discriminators', () => {
    /*
     * Behaviour pin: every adapter feeds the same agnostic shape, so a
     * non-provider AST must render successfully. This complements — but
     * does not replace — the source-text audit below: a passing render
     * alone would stay green even if `richtext.tsx` re-introduced a
     * `@storyblok/*` import, so the real decoupling guarantee is the
     * import-absence audit.
     */
    const data: RichtextData = {
      id: 'rt-decoupled',
      type: 'richtext',
      blocks: [{ kind: 'paragraph', inlines: [text('decoupled')] }],
    };

    const { getByText } = render(<Richtext {...data} />);

    expect(getByText('decoupled')).toBeInTheDocument();
  });

  describe('source-text audit — no `@storyblok/*` imports', () => {
    /*
     * The render-based pin above cannot detect a re-introduced provider
     * dependency: a `@storyblok/*` import would still compile and the
     * agnostic-AST render would still pass. To make the decoupling
     * guarantee real, read the source of the renderer and its schema as
     * text and assert no `@storyblok/` import string survives.
     *
     * Comments are stripped before the grep so narrative documentation
     * that *mentions* `@storyblok/*` (like this very block) does not
     * false-positive. The audit reads files as text and never requires
     * them, so it is robust whether the module compiles or not.
     */
    const stripComments = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    const AUDITED_FILES = [
      { label: 'richtext.tsx', path: join(__dirname, 'richtext.tsx') },
      { label: 'schema.ts', path: join(__dirname, 'schema.ts') },
    ] as const;

    it.each(AUDITED_FILES)('$label imports no `@storyblok/*` module', ({ path }) => {
      const source = stripComments(readFileSync(path, 'utf8'));

      expect(source).not.toMatch(/@storyblok\//);
    });
  });
});
