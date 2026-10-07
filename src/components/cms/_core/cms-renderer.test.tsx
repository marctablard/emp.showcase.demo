/**
 * Acceptance contract for `CmsRenderer` — the generic map-driven CMS
 * component resolver that turns a `CMSComponent` payload into a React tree.
 *
 * This is the render pipeline for adapters that produce an agnostic
 * `CMSPage.components[]` tree (the local-JSON adapter, and the Storyblok
 * adapter after its mapper lifts the story body into the agnostic shape).
 * It replaces the hand-maintained `cms-component-renderer.tsx` switch.
 *
 * Behaviour contract:
 * - For a leaf component (e.g. `button`), look up `cmsComponentMap[type]`
 *   and render `<Component {...component} />`.
 * - For container components (`page` body / `columns` columns / `grid`
 *   columns / `segment` content_blocks), iterate the nested array and
 *   recursively render each child. The container itself receives the
 *   resolved children via React `children`.
 * - For an unknown discriminator type, render `null` (graceful
 *   degradation — adapters validate upstream via the per-component Zod
 *   schemas, so this branch is defence-in-depth).
 *
 * Lives under `src/components/cms/_core/` so it can be imported by the
 * page route shell and any per-component preview tooling without dragging
 * a provider SDK in.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import type { ButtonData } from '../button/schema';
import type { ColumnsData } from '../columns/schema';
import type { CMSComponent } from '../component-schema';
import type { GridData } from '../grid/schema';
import type { PageData } from '../page/schema';
import type { SegmentData } from '../segment/schema';
import { CmsRenderer } from './cms-renderer';

const BUTTON: ButtonData = {
  id: 'btn-1',
  type: 'button',
  title: 'Buy',
  link: '/buy',
};

describe('CmsRenderer — leaf component', () => {
  it('renders a known leaf component (button) with its props spread', () => {
    const { getByText } = render(<CmsRenderer component={BUTTON} />);

    expect(getByText('Buy')).toBeInTheDocument();
  });

  it('renders `null` for an unknown discriminator type (defence-in-depth)', () => {
    const unknown = { id: 'x', type: 'totally-not-a-real-component' } as unknown as CMSComponent;
    const { container } = render(<CmsRenderer component={unknown} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('does not throw for an unknown discriminator type', () => {
    const unknown = { id: 'x', type: 'totally-not-a-real-component' } as unknown as CMSComponent;

    expect(() => render(<CmsRenderer component={unknown} />)).not.toThrow();
  });
});

describe('CmsRenderer — container recursion', () => {
  it('renders a `page` and recurses into its `body[]`', () => {
    const page: PageData = {
      id: 'page-1',
      type: 'page',
      title: 'Demo',
      body: [
        { ...BUTTON, id: 'btn-a', title: 'Alpha' },
        { ...BUTTON, id: 'btn-b', title: 'Beta' },
      ],
    };

    const { getByText } = render(<CmsRenderer component={page} />);

    expect(getByText('Alpha')).toBeInTheDocument();
    expect(getByText('Beta')).toBeInTheDocument();
  });

  it('renders a `segment` and recurses into its `content_blocks[]`', () => {
    const segment: SegmentData = {
      id: 'seg-1',
      type: 'segment',
      segment_name: 'Featured',
      content_blocks: [{ ...BUTTON, id: 'btn-in-seg', title: 'In Segment' }],
    };

    const { getByText } = render(<CmsRenderer component={segment} />);

    expect(getByText('In Segment')).toBeInTheDocument();
  });

  it('handles two levels of nesting (page → segment → button)', () => {
    const page: PageData = {
      id: 'page-1',
      type: 'page',
      body: [
        {
          id: 'seg-1',
          type: 'segment',
          segment_name: 'Inner',
          content_blocks: [{ ...BUTTON, id: 'btn-deep', title: 'Deep Button' }],
        },
      ],
    };

    const { getByText } = render(<CmsRenderer component={page} />);

    expect(getByText('Deep Button')).toBeInTheDocument();
  });

  it('renders a `columns` container and recurses into its `columns[]`', () => {
    const columns: ColumnsData = {
      id: 'cols-1',
      type: 'columns',
      columns: [
        { ...BUTTON, id: 'col-a', title: 'Col A' },
        { ...BUTTON, id: 'col-b', title: 'Col B' },
      ],
    };

    const { getByText } = render(<CmsRenderer component={columns} />);

    expect(getByText('Col A')).toBeInTheDocument();
    expect(getByText('Col B')).toBeInTheDocument();
  });

  it('renders a `grid` container and recurses into its `columns[]`', () => {
    const grid: GridData = {
      id: 'grid-1',
      type: 'grid',
      columns: [{ ...BUTTON, id: 'g-a', title: 'Grid A' }],
    };

    const { getByText } = render(<CmsRenderer component={grid} />);

    expect(getByText('Grid A')).toBeInTheDocument();
  });

  it('renders a container with no children array without crashing (segment shell still mounts)', () => {
    const emptySegment: SegmentData = {
      id: 'seg-empty',
      type: 'segment',
    };

    const { container } = render(<CmsRenderer component={emptySegment} />);

    expect(container.querySelector('section')).not.toBeNull();
  });
});

describe('CmsRenderer — content-slot substitution (layout frame)', () => {
  const PAGE_BODY: CMSComponent[] = [
    { ...BUTTON, id: 'pb-a', title: 'Page A' },
    { ...BUTTON, id: 'pb-b', title: 'Page B' },
  ];

  const layoutWith = (body: CMSComponent[]): CMSComponent =>
    ({ id: 'lay-1', type: 'layout', body }) as unknown as CMSComponent;

  it('substitutes a direct content-slot with the rendered pageBody[]', () => {
    const layout = layoutWith([
      { ...BUTTON, id: 'frame-top', title: 'Frame Top' },
      { id: 'slot-1', type: 'content-slot' } as unknown as CMSComponent,
      { ...BUTTON, id: 'frame-bottom', title: 'Frame Bottom' },
    ]);

    const { getByText } = render(<CmsRenderer component={layout} pageBody={PAGE_BODY} />);

    expect(getByText('Frame Top')).toBeInTheDocument();
    expect(getByText('Page A')).toBeInTheDocument();
    expect(getByText('Page B')).toBeInTheDocument();
    expect(getByText('Frame Bottom')).toBeInTheDocument();
  });

  it('substitutes a content-slot nested transitively inside a container', () => {
    const layout = layoutWith([
      {
        id: 'cols-1',
        type: 'columns',
        columns: [{ id: 'slot-deep', type: 'content-slot' }],
      } as unknown as CMSComponent,
    ]);

    const { getByText } = render(<CmsRenderer component={layout} pageBody={PAGE_BODY} />);

    expect(getByText('Page A')).toBeInTheDocument();
    expect(getByText('Page B')).toBeInTheDocument();
  });

  it('renders nothing for a content-slot when no pageBody is threaded (defence-in-depth)', () => {
    const slot = { id: 'slot-orphan', type: 'content-slot' } as unknown as CMSComponent;

    const { container } = render(<CmsRenderer component={slot} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('does not re-substitute a stray content-slot inside the page body (no infinite recursion)', () => {
    const pageBodyWithSlot: CMSComponent[] = [
      { ...BUTTON, id: 'pb-real', title: 'Real Content' },
      { id: 'pb-slot', type: 'content-slot' } as unknown as CMSComponent,
    ];
    const layout = layoutWith([{ id: 'slot-1', type: 'content-slot' } as unknown as CMSComponent]);

    const { getByText, container } = render(<CmsRenderer component={layout} pageBody={pageBodyWithSlot} />);

    expect(getByText('Real Content')).toBeInTheDocument();
    // The nested slot resolves to nothing rather than re-injecting the page body.
    expect(container.textContent).not.toContain('Real ContentReal Content');
  });
});
