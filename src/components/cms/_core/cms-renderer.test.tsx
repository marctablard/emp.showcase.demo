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
import type { CMSComponent } from '../component-schema';
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
    const columns = {
      id: 'cols-1',
      type: 'columns',
      columns: [
        { ...BUTTON, id: 'col-a', title: 'Col A' },
        { ...BUTTON, id: 'col-b', title: 'Col B' },
      ],
    } as unknown as CMSComponent;

    const { getByText } = render(<CmsRenderer component={columns} />);

    expect(getByText('Col A')).toBeInTheDocument();
    expect(getByText('Col B')).toBeInTheDocument();
  });

  it('renders a `grid` container and recurses into its `columns[]`', () => {
    const grid = {
      id: 'grid-1',
      type: 'grid',
      columns: [{ ...BUTTON, id: 'g-a', title: 'Grid A' }],
    } as unknown as CMSComponent;

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
