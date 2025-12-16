import { useContext } from 'react';
import { SiteContext } from '@/providers/SiteProvider';

export function useSiteCode() {
  const siteCode = useContext(SiteContext);
  return siteCode ?? 'main';
}
