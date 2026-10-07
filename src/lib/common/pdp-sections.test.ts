/**
 * @jest-environment jsdom
 */
import {
  PDP_STICKY_OVERLAY_ATTR,
  PDP_TECHNICAL_INFORMATION_SECTION_ID,
  applyPdpAnchorScrollMargin,
  getPdpStickyOverlayOffsetPx,
  getPdpTechnicalInformationHref,
  scrollToPdpAnchor,
} from './pdp-sections';

describe('pdp-sections', () => {
  it('exports a locale-, site-, and product-agnostic Technical Information anchor id', () => {
    expect(PDP_TECHNICAL_INFORMATION_SECTION_ID).toBe('technical-information');
    expect(PDP_TECHNICAL_INFORMATION_SECTION_ID).not.toContain('/');
    const segments = PDP_TECHNICAL_INFORMATION_SECTION_ID.toLowerCase().split(/[-_]/);
    expect(segments).not.toEqual(expect.arrayContaining(['en', 'de', 'site', 'product']));
  });

  it('getPdpTechnicalInformationHref returns the #-prefixed anchor id', () => {
    expect(getPdpTechnicalInformationHref()).toBe(`#${PDP_TECHNICAL_INFORMATION_SECTION_ID}`);
  });

  describe('sticky overlay offset', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
      window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
    });

    it('uses the lowest visible sticky overlay bottom plus gap', () => {
      const header = document.createElement('div');
      header.setAttribute(PDP_STICKY_OVERLAY_ATTR, '');
      Object.defineProperty(header, 'getBoundingClientRect', {
        value: () => ({
          top: 0,
          bottom: 120,
          height: 120,
          left: 0,
          right: 0,
          width: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });

      const cartBar = document.createElement('div');
      cartBar.setAttribute(PDP_STICKY_OVERLAY_ATTR, '');
      Object.defineProperty(cartBar, 'getBoundingClientRect', {
        value: () => ({
          top: 120,
          bottom: 200,
          height: 80,
          left: 0,
          right: 0,
          width: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });

      document.body.append(header, cartBar);

      expect(getPdpStickyOverlayOffsetPx(16)).toBe(216);
    });

    it('ignores sticky overlays that are opacity-0 (hidden ATC bar)', () => {
      const header = document.createElement('div');
      header.setAttribute(PDP_STICKY_OVERLAY_ATTR, '');
      Object.defineProperty(header, 'getBoundingClientRect', {
        value: () => ({
          top: 0,
          bottom: 120,
          height: 120,
          left: 0,
          right: 0,
          width: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });

      const hiddenWrap = document.createElement('div');
      hiddenWrap.style.opacity = '0';
      const cartBar = document.createElement('div');
      cartBar.setAttribute(PDP_STICKY_OVERLAY_ATTR, '');
      Object.defineProperty(cartBar, 'getBoundingClientRect', {
        value: () => ({
          top: 120,
          bottom: 200,
          height: 80,
          left: 0,
          right: 0,
          width: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
      hiddenWrap.append(cartBar);
      document.body.append(header, hiddenWrap);

      expect(getPdpStickyOverlayOffsetPx(16)).toBe(136);
    });

    it('applyPdpAnchorScrollMargin sets scroll-margin-top from the sticky stack', () => {
      const header = document.createElement('div');
      header.setAttribute(PDP_STICKY_OVERLAY_ATTR, '');
      Object.defineProperty(header, 'getBoundingClientRect', {
        value: () => ({
          top: 0,
          bottom: 100,
          height: 100,
          left: 0,
          right: 0,
          width: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
      document.body.append(header);

      const section = document.createElement('div');
      applyPdpAnchorScrollMargin(section);
      expect(section.style.scrollMarginTop).toBe('116px');
    });

    it('scrollToPdpAnchor scrolls above the sticky stack and updates the hash', () => {
      const header = document.createElement('div');
      header.setAttribute(PDP_STICKY_OVERLAY_ATTR, '');
      Object.defineProperty(header, 'getBoundingClientRect', {
        value: () => ({
          top: 0,
          bottom: 100,
          height: 100,
          left: 0,
          right: 0,
          width: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });

      const section = document.createElement('div');
      section.id = PDP_TECHNICAL_INFORMATION_SECTION_ID;
      Object.defineProperty(section, 'getBoundingClientRect', {
        value: () => ({
          top: 500,
          bottom: 800,
          height: 300,
          left: 0,
          right: 0,
          width: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 200 });

      document.body.append(header, section);

      scrollToPdpAnchor(PDP_TECHNICAL_INFORMATION_SECTION_ID);

      expect(window.scrollTo).toHaveBeenCalledWith({ top: 500 + 200 - 116, behavior: 'smooth' });
      expect(window.location.hash).toBe(`#${PDP_TECHNICAL_INFORMATION_SECTION_ID}`);
    });
  });
});
