import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { fetchTopBanner } from '@/app/_actions/cms-banner';
import { getLogger } from '@/lib/logger/use-logger-client';
import { useBannerStore } from '@/stores/banner-store';

interface TopBannerAnnouncementContent {
  title: string;
  link: {
    id: string;
    url: string;
    target: string;
  };
  is_active: boolean;
}

interface BannerData {
  story?: {
    content: TopBannerAnnouncementContent;
  };
}

interface UseBannerResult {
  data: BannerData | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for fetching and managing banner data.
 *
 * The Storyblok access token never lives in the browser bundle: the fetch
 * is delegated to the `fetchTopBanner` server action, which reads the env
 * server-side and hands the resolved story payload back across the wire.
 * When the action resolves `null` (no token configured / blank token /
 * defensive null), the hook settles with `data: null` and no error.
 *
 * Uses the `BannerStore` to share data between components.
 */
export function useBanner(): UseBannerResult {
  const locale = useLocale();
  const { data, setData, error, setError } = useBannerStore();
  const [isLoading, setIsLoading] = useState<boolean>(!data);

  useEffect(() => {
    let isMounted = true;

    const fetchBannerData = async () => {
      // If data already exists in the store, don't fetch again
      if (data) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        const payload = await fetchTopBanner({ locale });

        if (!isMounted) {
          return;
        }

        if (payload === null) {
          // No banner configured (token unset) or defensive null — settle quietly.
          setIsLoading(false);
          return;
        }

        setData(payload as BannerData);
        setIsLoading(false);
      } catch (err) {
        if (isMounted) {
          getLogger().error({ err }, 'Error fetching banner data');
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setIsLoading(false);
        }
      }
    };

    fetchBannerData();

    return () => {
      isMounted = false;
    };
  }, [locale, data, setData, setError]);

  return { data, isLoading, error };
}

export default useBanner;
