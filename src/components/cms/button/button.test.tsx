/**
 * Failing-test contract for the `button` CMS component.
 *
 * Asserts the two pillars every co-located CMS component must satisfy:
 *
 * 1. `ButtonSchema` is the wire-format source of truth — adapters validate
 *    against it at the CMS boundary, so it must accept minimal-valid payloads,
 *    accept optional fields when present, and reject malformed input.
 *
 * 2. `Button` (React component) renders a single root DOM element that:
 *    - exposes the button title to assistive tech,
 *    - spreads arbitrary HTML attributes (`data-testid`, `aria-*`,
 *      `data-blok-*`) onto that root,
 *    - merges incoming `className` via `cn(...)` instead of clobbering the
 *      component's own classes.
 *
 * Co-located with the implementation they pin.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Button, { ButtonSchema } from './index';

describe('Button — schema', () => {
  it('parses a valid button payload with only required fields', () => {
    const parsed = ButtonSchema.parse({
      id: 'btn-1',
      type: 'button',
      title: 'Buy now',
      link: '/checkout',
    });

    expect(parsed.type).toBe('button');
    expect(parsed.title).toBe('Buy now');
    expect(parsed.iconLeft).toBeUndefined();
    expect(parsed.iconRight).toBeUndefined();
  });

  it('accepts optional iconLeft / iconRight when present', () => {
    const parsed = ButtonSchema.parse({
      id: 'btn-2',
      type: 'button',
      title: 'Next',
      link: '/next',
      iconLeft: 'ArrowLeft',
      iconRight: 'ArrowRight',
    });

    expect(parsed.iconLeft).toBe('ArrowLeft');
    expect(parsed.iconRight).toBe('ArrowRight');
  });

  it('rejects payloads missing the required `title`', () => {
    expect(() =>
      ButtonSchema.parse({
        id: 'btn-3',
        type: 'button',
        link: '/missing-title',
      }),
    ).toThrow();
  });

  it('rejects payloads with a wrong discriminator value', () => {
    expect(() =>
      ButtonSchema.parse({
        id: 'btn-4',
        type: 'hero',
        title: 'wrong',
        link: '/',
      }),
    ).toThrow();
  });
});

describe('Button — component', () => {
  const VALID_PROPS = {
    id: 'btn-1',
    type: 'button' as const,
    title: 'Buy now',
    link: '/checkout',
  };

  it('renders the button title as visible text', () => {
    const { getByText } = render(<Button {...VALID_PROPS} />);

    expect(getByText('Buy now')).toBeInTheDocument();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Button {...VALID_PROPS} data-testid="cms-button-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-button-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Button {...VALID_PROPS} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });

  it('spreads `data-blok-*` editor attributes onto its root', () => {
    const { container } = render(<Button {...VALID_PROPS} data-blok-c="button" data-blok-uid="editable-uid-btn" />);

    const root = container.firstChild as HTMLElement;
    expect(root.dataset.blokC).toBe('button');
    expect(root.dataset.blokUid).toBe('editable-uid-btn');
  });

  it('sanitises a javascript: link — rendered anchor href must not contain the scheme', () => {
    const { container } = render(<Button {...VALID_PROPS} link="javascript:alert(1)" />);
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).not.toMatch(/javascript:/i);
  });
});
