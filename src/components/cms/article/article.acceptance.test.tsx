/**
 * @jest-environment jsdom
 */
/**
 * Acceptance contract for the Article-on-Richtext migration.
 *
 * Post-migration, Article renders body content via the agnostic
 * `<Richtext>`, fed by `RichtextData` from the active CMS adapter's
 * mapper. The `content` field is schema-tightened to
 * `RichtextSchema.optional()` — payloads that fail `RichtextSchema.parse`
 * reject at the adapter boundary, not in the renderer.
 *
 * The earlier loose contract (`z.unknown()` + a provider-specific bridge
 * component) is replaced: schema-tightening counts as a deliberate
 * contract upgrade, not a regression. Behaviour for title / introduction
 * / video / linked_products is preserved verbatim.
 *
 * Co-located with the implementation they pin.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Article, { type ArticleData } from './index';
import { ArticleSchema } from './schema';

const VALID_RICHTEXT: ArticleData['content'] = {
  id: 'rt-1',
  type: 'richtext',
  blocks: [
    { kind: 'heading', level: 2, inlines: [{ kind: 'text', value: 'Section' }] },
    { kind: 'paragraph', inlines: [{ kind: 'text', value: 'Body sentence.' }] },
  ],
};

describe('Article — content schema contract', () => {
  it('`content` is typed `RichtextSchema.optional()` (the agnostic AST, not `z.unknown()`)', () => {
    const parsed = ArticleSchema.parse({
      id: 'art-1',
      type: 'article',
      content: VALID_RICHTEXT,
    });

    // The narrowed shape means TypeScript can reach `.blocks` without a
    // cast — verified at compile time. At runtime we check the type field
    // and block count landed.
    expect(parsed.content?.type).toBe('richtext');
    expect(parsed.content?.blocks).toHaveLength(2);
  });

  it('parses a valid RichtextData payload as `content`', () => {
    expect(() => ArticleSchema.parse({ id: 'art-ok', type: 'article', content: VALID_RICHTEXT })).not.toThrow();
  });

  it('rejects a raw TipTap-shaped payload as `content` (TipTap → AST mapping happens in the adapter)', () => {
    // The legacy schema accepted this verbatim because it was typed
    // `z.unknown()`. Now it must reject — the TipTap shape is structurally
    // different from `RichtextData` (no `id`, no `type`, no `blocks`).
    expect(() =>
      ArticleSchema.parse({
        id: 'art-tiptap',
        type: 'article',
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }] },
      }),
    ).toThrow();
  });

  it('still accepts `content: undefined` (field omitted)', () => {
    const parsed = ArticleSchema.parse({ id: 'art-no-content', type: 'article' });

    expect(parsed.content).toBeUndefined();
  });
});

describe('Article — render contract', () => {
  it('renders the body via the agnostic <Richtext> (body blocks present)', () => {
    const article: ArticleData = { id: 'art-r1', type: 'article', content: VALID_RICHTEXT };

    const { getByRole, getByText } = render(<Article {...article} />);

    // The richtext body is mounted: its heading + paragraph render.
    expect(getByRole('heading', { level: 2, name: 'Section' })).toBeInTheDocument();
    expect(getByText('Body sentence.')).toBeInTheDocument();
  });

  it('when `content` is undefined, no richtext body is mounted (no block-level body elements)', () => {
    // No title/introduction either, so the header is absent too — this
    // isolates the richtext-body region: an article with no `content` must
    // render zero block-level elements.
    const article: ArticleData = { id: 'art-empty', type: 'article' };

    const { container } = render(<Article {...article} />);

    expect(container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, hr')).toHaveLength(0);
  });

  it('renders the title in an <h1> header without mounting a richtext body when `content` is undefined', () => {
    const article: ArticleData = { id: 'art-title-only', type: 'article', title: 'Just a title' };

    const { container, getByText } = render(<Article {...article} />);

    // The title is a real <h1> inside the header (not a bare text node)...
    expect(getByText('Just a title').closest('h1')).not.toBeNull();
    // ...but no richtext body block elements are mounted.
    expect(container.querySelectorAll('p, h2, h3, h4, h5, h6, ul, ol, hr')).toHaveLength(0);
  });

  it('preserves the title / introduction / video / linked_products contract verbatim', () => {
    const article: ArticleData = {
      id: 'art-full',
      type: 'article',
      title: 'Pin the title',
      introduction: 'Pin the intro.',
      video: { url: 'https://video.test/embed/x', title: 'Demo' },
      linked_products: [
        { _uid: 'lp1', product_id: 'p-001', name: 'Hammer' },
        { _uid: 'lp2', product_id: 'p-002', name: 'Wrench' },
      ],
    };

    const { getByText, container } = render(<Article {...article} />);

    expect(getByText('Pin the title')).toBeInTheDocument();
    expect(getByText('Hammer')).toBeInTheDocument();
    expect(getByText('Wrench')).toBeInTheDocument();
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://video.test/embed/x');
  });
});

describe('Article — body block / inline pinning', () => {
  it('for a heading + paragraph + list AST the body renders the expected block tags', () => {
    const article: ArticleData = {
      id: 'art-multi',
      type: 'article',
      content: {
        id: 'rt-multi',
        type: 'richtext',
        blocks: [
          { kind: 'heading', level: 2, inlines: [{ kind: 'text', value: 'Title' }] },
          { kind: 'paragraph', inlines: [{ kind: 'text', value: 'A sentence.' }] },
          {
            kind: 'list',
            ordered: false,
            items: [[{ kind: 'text', value: 'one' }], [{ kind: 'text', value: 'two' }]],
          },
        ],
      },
    };

    const { container } = render(<Article {...article} />);

    expect(container.querySelector('h2')).not.toBeNull();
    expect(container.querySelector('p')).not.toBeNull();
    expect(container.querySelector('ul')).not.toBeNull();
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
  });

  it('inline marks (bold/italic) inside the body render as <strong>/<em>', () => {
    const article: ArticleData = {
      id: 'art-marks',
      type: 'article',
      content: {
        id: 'rt-marks',
        type: 'richtext',
        blocks: [
          {
            kind: 'paragraph',
            inlines: [
              { kind: 'text', value: 'loud', bold: true },
              { kind: 'text', value: '/' },
              { kind: 'text', value: 'lean', italic: true },
            ],
          },
        ],
      },
    };

    const { container } = render(<Article {...article} />);

    expect(container.querySelector('strong')).not.toBeNull();
    expect(container.querySelector('em')).not.toBeNull();
  });
});
