/**
 * @jest-environment node
 */

const redirect = jest.fn((href: string) => {
  throw new Error(`REDIRECT:${href}`);
});

jest.mock('next/navigation', () => ({
  redirect: (href: string) => redirect(href),
}));

jest.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    getPathname: ({ href }: { href: string }) => href,
  }),
}));

jest.mock('@/i18n/routing', () => ({
  routing: {},
}));

jest.mock('@/site/routing', () => ({
  routing: {},
}));

jest.mock('@/site/utils', () => ({
  addPrefixIfNeeded: (path: string, site: string) => `/${site}${path}`,
}));

const { default: LegacyApprovalDetailPage } = require('@/app/[site]/[locale]/(default)/account/approval/[id]/page');

describe('Legacy singular approval route', () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it('redirects to the canonical plural approval detail route, preserving site and locale', async () => {
    await expect(
      LegacyApprovalDetailPage({
        params: Promise.resolve({ site: 'my-site', locale: 'en', id: 'APR-1000' }),
      }),
    ).rejects.toThrow('REDIRECT:/my-site/account/approvals/APR-1000');

    expect(redirect).toHaveBeenCalledWith('/my-site/account/approvals/APR-1000');
  });
});
