import { getRequestSite } from '../../server/RequestSiteCache';
import { createSiteNavigationShared } from '../../shared/createNavigationShared';
import { SiteRoutingConfig } from '../../types';

// this a server variation of the navigation, it is used in server only code (like edge middleware or api routes)
export default function createNavigation(siteRouting: SiteRoutingConfig, intlRouting: any) {
  const { ...fns } = createSiteNavigationShared(siteRouting, intlRouting, () => {
    const site = getRequestSite();
    if (!site) {
      throw new Error('getRequestSite returned undefined, make sure to setRequestSite in all layouts!');
    }
    return site;
  });

  // prevents accidental usage of hooks in server code
  function notSupported(hookName: string) {
    return () => {
      throw new Error(
        `\`${hookName}\` is not supported in Server Components. You can use this hook if you convert the calling component to a Client Component.`,
      );
    };
  }

  return {
    ...fns,
    usePathname: notSupported('usePathname'),
    useRouter: notSupported('useRouter'),
  };
}
