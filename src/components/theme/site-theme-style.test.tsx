/**
 * Acceptance contract for `SiteThemeStyle`.
 *
 * The component emits a single `<link rel="stylesheet">` pointing at the
 * resolved per-site theme file, falling back to the empty default theme for
 * an un-themed site (so no cross-site cascade can occur).
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { SiteThemeStyle } from './site-theme-style';

const linkFor = (siteCode: string): HTMLLinkElement => {
  const { container } = render(<SiteThemeStyle siteCode={siteCode} />);
  const link = container.querySelector('link[rel="stylesheet"]');
  return link as HTMLLinkElement;
};

describe('SiteThemeStyle', () => {
  it('emits a stylesheet link to the resolved per-site theme', () => {
    const link = linkFor('us-branch');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/themes/us-branch.css');
  });

  it('tags the link with the active site code for debuggability', () => {
    const link = linkFor('main');
    expect(link.dataset.siteTheme).toBe('main');
  });

  it('falls back to the empty default theme for an un-themed site', () => {
    const link = linkFor('unknown-site');
    expect(link.getAttribute('href')).toBe('/themes/_default_.css');
  });
});
