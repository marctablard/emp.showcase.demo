/**
 * Failing-test contract for the `segment` CMS container.
 *
 * Segment is a thin wrapper scoped to a customer-segment id. Its
 * `content_blocks[]` field references the global discriminated union via
 * `z.lazy(...)`, so validation runs transitively into the nested
 * components. The component does NOT iterate `content_blocks[]` itself — it
 * renders React-native `children` (the caller iterates the data and passes
 * the resolved elements via the `children` prop), mirroring the `page`
 * container.
 *
 * Co-located with the implementation they pin.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Segment, { SegmentSchema } from './index';

describe('Segment — schema (recursive content_blocks)', () => {
  it('parses a minimal payload with only `id` and `type`', () => {
    const parsed = SegmentSchema.parse({
      id: 'seg-1',
      type: 'segment',
    });

    expect(parsed.type).toBe('segment');
    expect(parsed.content_blocks).toBeUndefined();
  });

  it('parses a segment whose content_blocks contain known nested components', () => {
    const parsed = SegmentSchema.parse({
      id: 'seg-2',
      type: 'segment',
      segment_name: 'B2B',
      emporix_segment_id: 'seg-001',
      content_blocks: [
        { id: 'btn-1', type: 'button', title: 'Buy', link: '/buy' },
        { id: 'cb-1', type: 'content-block' },
      ],
    });

    expect(parsed.content_blocks).toHaveLength(2);
    expect(parsed.content_blocks?.[0]?.type).toBe('button');
  });

  it('rejects a content_blocks entry with an unknown discriminator type', () => {
    expect(() =>
      SegmentSchema.parse({
        id: 'seg-3',
        type: 'segment',
        content_blocks: [{ id: 'x', type: 'totally-not-a-real-component' }],
      }),
    ).toThrow();
  });

  it('rejects a content_blocks entry whose required field is missing (transitive)', () => {
    expect(() =>
      SegmentSchema.parse({
        id: 'seg-3b',
        type: 'segment',
        content_blocks: [{ id: 'btn-missing', type: 'button', link: '/no-title' }],
      }),
    ).toThrow();
  });

  it('rejects a wrong discriminator value', () => {
    expect(() =>
      SegmentSchema.parse({
        id: 'seg-4',
        type: 'hero',
      }),
    ).toThrow();
  });
});

describe('Segment — component (children-prop render)', () => {
  it('renders React children passed via the `children` prop inside the segment wrapper', () => {
    const { getByText } = render(
      <Segment id="s1" type="segment">
        <span>nested content</span>
      </Segment>,
    );

    expect(getByText('nested content')).toBeInTheDocument();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Segment id="s1" type="segment" data-testid="cms-segment-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-segment-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Segment id="s1" type="segment" className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});
