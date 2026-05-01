import { useContext } from 'react';
import { getPublicDefaultSite } from '@/lib/common/public-default-env';
import { SiteContext } from '@/providers/SiteProvider';

export function useSiteCode() {
  const siteCode = useContext(SiteContext);
  return siteCode ?? getPublicDefaultSite();
}
