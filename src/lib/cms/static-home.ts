import deHome from '@/data/cms/_default_/de/home.json';
import enHome from '@/data/cms/_default_/en/home.json';
import type { CMSPage } from '@/platform/services/model/cms';
import { getStoryblokEnv } from '../common/cms-dual-env';

/**
 * Demo homepage used when `NEXT_STORYBLOK_SPACE_ID` is unset.
 *
 * The pages live in `src/data/cms/_default_/<locale>/home.json` as the same
 * CMS components the live Storyblok homepage uses. A customer demo replaces
 * those component fields (copy, images, product ids) in place. The hero
 * headline ends with "· static" / "· statisch" so this copy is visible
 * against the Storyblok homepage.
 */
const STATIC_HOME_PAGES: Record<string, CMSPage> = {
  de: deHome as CMSPage,
  en: enHome as CMSPage,
};

const DEFAULT_STATIC_HOME_LOCALE = 'en';

export function usesStaticHomepage(env: NodeJS.ProcessEnv = process.env): boolean {
  return getStoryblokEnv('SPACE_ID', env) === undefined;
}

export function staticHomePage(locale: string): CMSPage {
  const normalized = locale.trim().toLowerCase();
  return STATIC_HOME_PAGES[normalized] ?? STATIC_HOME_PAGES[DEFAULT_STATIC_HOME_LOCALE];
}
