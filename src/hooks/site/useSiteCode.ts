import { useContext } from 'react';
import { SiteContext } from '@/providers/SiteProvider';

export function useSiteCode(): string | undefined {
  const siteCode = useContext(SiteContext);
  const trimmed = siteCode?.trim();
  return trimmed || undefined;
}
