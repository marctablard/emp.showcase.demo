import { CMSComponentSchema } from '@/components/cms/component-schema';
import deHome from '@/data/cms/_default_/de/home.json';
import enHome from '@/data/cms/_default_/en/home.json';
import { staticHomePage, usesStaticHomepage } from './static-home';

describe('usesStaticHomepage', () => {
  it('is on when the Storyblok space id is missing', () => {
    expect(usesStaticHomepage({})).toBe(true);
    expect(usesStaticHomepage({ NEXT_STORYBLOK_SPACE_ID: '   ' })).toBe(true);
  });

  it('is off when a space id is configured', () => {
    expect(usesStaticHomepage({ NEXT_STORYBLOK_SPACE_ID: '338074' })).toBe(false);
    expect(usesStaticHomepage({ NEXT_PUBLIC_STORYBLOK_SPACE_ID: '338074' })).toBe(false);
  });
});

describe('static homepage content', () => {
  it('serves English and German, and falls back to English for an unknown locale', () => {
    expect(staticHomePage('en').components[0]).toEqual(
      expect.objectContaining({ type: 'hero', headline: enHome.components[0].headline }),
    );
    expect(staticHomePage('DE').components[0]).toEqual(
      expect.objectContaining({ type: 'hero', headline: deHome.components[0].headline }),
    );
    expect(staticHomePage('fr').components[0]).toEqual(
      expect.objectContaining({ headline: enHome.components[0].headline }),
    );
  });

  it('matches the CMS component schemas in every shipped language', () => {
    for (const page of [enHome, deHome]) {
      expect(page.components.map((component) => component.type)).toEqual([
        'hero',
        'quick-entry',
        'media-text',
        'media-text',
        'recommendations',
        'recommendations',
        'recommendations',
      ]);
      for (const component of page.components) {
        expect(CMSComponentSchema.safeParse(component).success).toBe(true);
      }
    }
  });
});
