/**
 * @jest-environment node
 *
 * Guards the production failure mode behind digest 3980856108:
 * `generate:prod` DI prune must keep CMSService + adapter plugins on the SSR
 * container, and getCmsService must resolve after lazy CmsAdapter bind.
 */
import { bindActiveCmsAdapter } from './bind-active-cms-adapter';
import { getCmsService } from './get-cms-service';

describe('ssr CMSService binding (prod-prune smoke)', () => {
  it('binds CMSService via DelegatingCmsServiceSSR alias and resolves getCmsService', async () => {
    const ssr = (await import('@/platform/ssr')).default;

    expect(ssr.isBound('DelegatingCmsServiceSSR')).toBe(true);
    expect(ssr.isBound('CMSService')).toBe(true);
    expect(ssr.isBound('CmsAdapter:none')).toBe(true);

    bindActiveCmsAdapter(ssr, { NEXT_CMS_PROVIDER: 'none' } as unknown as NodeJS.ProcessEnv);
    expect(ssr.isBound('CmsAdapter')).toBe(true);

    const service = await getCmsService();
    expect(service.providerId).toBe('none');
    await expect(service.getPage('home', 'en', 'main')).resolves.toEqual(expect.objectContaining({ notfound: true }));
  });
});
