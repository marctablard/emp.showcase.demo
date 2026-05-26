/**
 * Acceptance contract for the `article` CMS component.
 *
 * Article is the linked-products-grid case: the parent server-renders the
 * title / introduction / video iframe / agnostic richtext body and
 * delegates the per-card product link to a client island
 * (`article-product-link.tsx`) because `Link` from `@/i18n/navigation`
 * is client-only.
 *
 * The body uses the agnostic `<Richtext>` and the schema tightens
 * `content` to `RichtextSchema.optional()`. Wire formats that need
 * translation (e.g. TipTap JSON) are pre-mapped at the adapter boundary —
 * the UI side only ever sees a valid AST. The schema-tightening and
 * render contract live in `article.acceptance.test.tsx`; this file pins
 * the schema-shape invariants and the component spread/merge contract
 * shared with the other co-located CMS components.
 *
 * The schema, component, and barrel file do not exist in co-located form
 * yet — these tests are red until the migration lands.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Article, { type ArticleData, ArticleSchema } from './index';

const MINIMAL: ArticleData = {
  id: 'art-1',
  type: 'article',
};

const POPULATED: ArticleData = {
  id: 'art-2',
  type: 'article',
  title: 'How we tested it',
  introduction: 'A short intro.',
  video: { url: 'https://video.test/embed/x', title: 'Demo' },
  linked_products: [
    { _uid: 'lp1', product_id: 'p-001', name: 'Hammer' },
    { _uid: 'lp2', product_id: 'p-002', name: 'Wrench' },
  ],
};

describe('Article — schema', () => {
  it('parses a minimal payload with only `id` and `type`', () => {
    const parsed = ArticleSchema.parse(MINIMAL);

    expect(parsed.type).toBe('article');
    expect(parsed.title).toBeUndefined();
  });

  it('parses a fully populated payload', () => {
    const parsed = ArticleSchema.parse(POPULATED);

    expect(parsed.title).toBe('How we tested it');
    expect(parsed.video?.url).toBe('https://video.test/embed/x');
    expect(parsed.linked_products).toHaveLength(2);
    expect(parsed.linked_products?.[0]?.product_id).toBe('p-001');
  });

  it('rejects a missing required field (`id` absent)', () => {
    expect(() => ArticleSchema.parse({ type: 'article' })).toThrow();
  });

  it('rejects a linked_product entry without `_uid`', () => {
    expect(() =>
      ArticleSchema.parse({
        ...MINIMAL,
        linked_products: [{ product_id: 'p-001', name: 'No uid' }],
      }),
    ).toThrow();
  });

  it('rejects a wrong discriminator value', () => {
    expect(() =>
      ArticleSchema.parse({
        id: 'art-3',
        type: 'hero',
      }),
    ).toThrow();
  });

  // The narrowed `content` contract (typed against the agnostic
  // `RichtextSchema`) — accepts a valid AST, rejects raw TipTap, accepts
  // undefined — lives in `article.acceptance.test.tsx` to keep the
  // schema-tightening tests in a dedicated file aligned with the rest of
  // the acceptance suite.
});

describe('Article — component', () => {
  it('renders the title as visible text when provided', () => {
    const { getByText } = render(<Article {...POPULATED} />);

    expect(getByText('How we tested it')).toBeInTheDocument();
  });

  it('spreads `data-testid` onto its root <article> element', () => {
    const { container } = render(<Article {...POPULATED} data-testid="cms-article-root" />);

    const root = container.firstChild as HTMLElement;
    expect(root.tagName.toLowerCase()).toBe('article');
    expect(root).toHaveAttribute('data-testid', 'cms-article-root');
  });

  it('spreads arbitrary `data-*` attributes onto the root', () => {
    const { container } = render(<Article {...POPULATED} data-blok-c="abc" />);

    expect(container.firstChild).toHaveAttribute('data-blok-c', 'abc');
  });

  it('merges incoming className with its own root classes via cn() (does not clobber)', () => {
    const { container } = render(<Article {...POPULATED} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    // Own root class is preserved alongside the consumer-supplied one.
    expect(root).toHaveClass('extra-class');
    expect(root).toHaveClass('article');
  });

  it('keeps the `content` schema field free of the conflicting HTMLAttributes `content` string attribute', () => {
    /*
     * `ArticleProps = ArticleData & Omit<HTMLAttributes<HTMLElement>, 'content'>`.
     * The `content` field carries the agnostic richtext AST (an object),
     * while `HTMLAttributes.content` is a legacy string attribute. The
     * `Omit` resolves the type-level conflict so a richtext-AST `content`
     * can be passed without a cast, and the AST object must NOT leak onto
     * the DOM as a stringified `content="[object Object]"` attribute.
     */
    const withContent: ArticleData = {
      id: 'art-content',
      type: 'article',
      content: {
        id: 'rt-x',
        type: 'richtext',
        blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', value: 'body' }] }],
      },
    };

    const { container } = render(<Article {...withContent} />);

    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('content')).toBeNull();
  });
});
