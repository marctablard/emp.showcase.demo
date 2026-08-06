import { PDP_TECHNICAL_INFORMATION_SECTION_ID, getPdpTechnicalInformationHref } from './pdp-sections';

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
});
