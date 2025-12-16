'use client';

import { ArrowUpRight } from 'lucide-react';
import UiLink from '@/components/ui/link';
import { useBanner } from '@/hooks/banner/use-banner';

interface TopBannerAnnouncementContent {
  title: string;
  link: {
    id: string;
    url: string;
    target: string;
  };
  is_active: boolean;
}

export default function TopBannerAnnouncement() {
  const { data, isLoading } = useBanner();

  // Don't show anything while loading
  if (isLoading) return null;

  // Don't show anything if no data is available
  if (!data) return null;

  const content: TopBannerAnnouncementContent | undefined = data?.story?.content;

  // Don't show anything if the banner is not active
  if (!content || !content.is_active) return null;

  return (
    <UiLink
      type="Link"
      href={content.link.url}
      target={content.link.target}
      className="text-text-on-action hover:text-text-on-action"
      iconAfter={<ArrowUpRight className="w-4 h-4" />}
    >
      {content.title}
    </UiLink>
  );
}
