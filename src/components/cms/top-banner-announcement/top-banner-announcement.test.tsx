/**
 * Failing-test contract for the `top-banner-announcement` CMS component.
 *
 * The banner is a regular CMS component supplied through the active adapter
 * as part of the default layout JSON. Wire-format (CMS-agnostic):
 *   {
 *     id, type: 'top-banner-announcement',
 *     title: string,
 *     link: { id: string, url: string, target: string },
 *     is_active: boolean,
 *   }
 *
 * Render behaviour:
 *   - `is_active === false` → renders nothing
 *   - `is_active === true` + valid link/title → renders a link wrapping the
 *     title with an `ArrowUpRight` icon after it
 *
 * The component also accepts `...rest` from `HTMLAttributes` and spreads it
 * onto the rendered `<a>` root, so the CMS Visual-Editor anchor
 * (`data-blok-*`) and any other pass-through attribute reach the DOM root —
 * matching every other CMS component.
 *
 * Co-located with the implementation they pin.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import TopBannerAnnouncement, { TopBannerAnnouncementSchema } from './index';

describe('TopBannerAnnouncement — schema', () => {
  it('parses the minimal valid payload (title, link, is_active=true)', () => {
    const parsed = TopBannerAnnouncementSchema.parse({
      id: 'tba-1',
      type: 'top-banner-announcement',
      title: 'Announce',
      link: { id: 'l1', url: '/promo', target: '_self' },
      is_active: true,
    });
    expect(parsed.is_active).toBe(true);
    expect(parsed.title).toBe('Announce');
  });

  it('rejects when discriminator value is wrong', () => {
    expect(() => TopBannerAnnouncementSchema.parse({ id: 'x', type: 'page' })).toThrow();
  });

  it('rejects when required `link` shape is missing or malformed', () => {
    expect(() =>
      TopBannerAnnouncementSchema.parse({
        id: 'x',
        type: 'top-banner-announcement',
        title: 'T',
        is_active: true,
        // link omitted
      }),
    ).toThrow();
  });
});

describe('TopBannerAnnouncement — render behaviour', () => {
  it('renders the title text when is_active=true', () => {
    const { getByText } = render(
      <TopBannerAnnouncement
        id="tba-1"
        type="top-banner-announcement"
        title="Buy Now"
        link={{ id: 'l1', url: '/promo', target: '_self' }}
        is_active={true}
      />,
    );
    expect(getByText('Buy Now')).toBeInTheDocument();
  });

  it('renders a link element with href containing link.url and the supplied target', () => {
    const { getByRole } = render(
      <TopBannerAnnouncement
        id="tba-1"
        type="top-banner-announcement"
        title="Buy Now"
        link={{ id: 'l1', url: '/promo', target: '_blank' }}
        is_active={true}
      />,
    );
    const link = getByRole('link', { name: /Buy Now/i });
    // The exact path may carry the locale prefix from `@/i18n/navigation`.
    expect(link.getAttribute('href')).toContain('/promo');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('renders an ArrowUpRight icon after the title', () => {
    const { container } = render(
      <TopBannerAnnouncement
        id="tba-1"
        type="top-banner-announcement"
        title="Buy Now"
        link={{ id: 'l1', url: '/promo', target: '_self' }}
        is_active={true}
      />,
    );
    // lucide-react renders SVG with `lucide-arrow-up-right` class.
    expect(container.querySelector('svg.lucide-arrow-up-right')).not.toBeNull();
  });

  it('renders nothing when is_active=false', () => {
    const { container } = render(
      <TopBannerAnnouncement
        id="tba-1"
        type="top-banner-announcement"
        title="Hidden"
        link={{ id: 'l1', url: '/promo', target: '_self' }}
        is_active={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TopBannerAnnouncement — attribute spread reaches the rendered root', () => {
  it('forwards `data-blok-c` to the rendered `<a>` element', () => {
    const { getByRole } = render(
      <TopBannerAnnouncement
        id="tba-1"
        type="top-banner-announcement"
        title="Forward me"
        link={{ id: 'l1', url: '/promo', target: '_self' }}
        is_active={true}
        // The CMS Visual-Editor anchor — must reach the DOM root.
        {...({ 'data-blok-c': 'top-banner-announcement' } as Record<string, string>)}
      />,
    );
    const link = getByRole('link', { name: /Forward me/i });
    expect(link.dataset.blokC).toBe('top-banner-announcement');
  });

  it('forwards `data-blok-uid` to the rendered `<a>` element', () => {
    const { getByRole } = render(
      <TopBannerAnnouncement
        id="tba-1"
        type="top-banner-announcement"
        title="Forward me"
        link={{ id: 'l1', url: '/promo', target: '_self' }}
        is_active={true}
        {...({ 'data-blok-uid': 'editable-uid-tba' } as Record<string, string>)}
      />,
    );
    const link = getByRole('link', { name: /Forward me/i });
    expect(link.dataset.blokUid).toBe('editable-uid-tba');
  });

  it('forwards arbitrary `data-testid` to the rendered `<a>` element (general HTMLAttributes spread)', () => {
    const { getByRole } = render(
      <TopBannerAnnouncement
        id="tba-1"
        type="top-banner-announcement"
        title="Forward me"
        link={{ id: 'l1', url: '/promo', target: '_self' }}
        is_active={true}
        {...({ 'data-testid': 'cms-top-banner-root' } as Record<string, string>)}
      />,
    );
    const link = getByRole('link', { name: /Forward me/i });
    expect(link.dataset.testid).toBe('cms-top-banner-root');
  });

  it('does NOT spread props when is_active=false (component still returns null in that branch)', () => {
    const { container } = render(
      <TopBannerAnnouncement
        id="tba-1"
        type="top-banner-announcement"
        title="Hidden"
        link={{ id: 'l1', url: '/promo', target: '_self' }}
        is_active={false}
        {...({ 'data-blok-c': 'top-banner-announcement' } as Record<string, string>)}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TopBannerAnnouncement — XSS sanitisation', () => {
  it('sanitises a javascript: link.url — rendered anchor href must not contain the scheme', () => {
    const { container } = render(
      <TopBannerAnnouncement
        id="tba-xss"
        type="top-banner-announcement"
        title="XSS"
        link={{ id: 'l-xss', url: 'javascript:alert(1)', target: '_self' }}
        is_active={true}
      />,
    );
    // An unsafe URL sanitises to '' and the announcement renders as plain text
    // — stronger than emitting an anchor with a blanked href, which would still
    // resolve to a navigable route through the i18n router.
    expect(container.querySelector('a')).toBeNull();
    expect(container.innerHTML).not.toMatch(/javascript:/i);
  });
});
