/**
 * Acceptance contract for the `content-slot` placeholder.
 *
 * `content-slot` is a leaf discriminator that marks where the page body is
 * substituted inside a layout. Its schema parses identity + discriminator;
 * its registered component is a non-rendering placeholder (the renderer
 * substitutes the slot before the component is ever mounted).
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import ContentSlot, { ContentSlotSchema } from './index';

describe('ContentSlot — schema', () => {
  it('parses a minimal content-slot payload', () => {
    const parsed = ContentSlotSchema.parse({ id: 'slot-1', type: 'content-slot' });
    expect(parsed).toEqual({ id: 'slot-1', type: 'content-slot' });
  });

  it('rejects a wrong discriminator value', () => {
    expect(() => ContentSlotSchema.parse({ id: 'slot-1', type: 'button' })).toThrow();
  });

  it('rejects a missing id', () => {
    expect(() => ContentSlotSchema.parse({ type: 'content-slot' })).toThrow();
  });
});

describe('ContentSlot — component (non-rendering placeholder)', () => {
  it('renders nothing', () => {
    const { container } = render(<ContentSlot id="slot-1" type="content-slot" />);
    expect(container).toBeEmptyDOMElement();
  });
});
