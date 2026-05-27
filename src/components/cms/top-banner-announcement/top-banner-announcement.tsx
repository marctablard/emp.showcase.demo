import type { HTMLAttributes } from 'react';
import { ArrowUpRight } from 'lucide-react';
import UiLink from '@/components/ui/link';
import type { TopBannerAnnouncementData } from './schema';

export type TopBannerAnnouncementProps = TopBannerAnnouncementData &
  Omit<HTMLAttributes<HTMLAnchorElement>, 'onClick' | 'className'>;

const TopBannerAnnouncement = ({
  id: _id,
  type: _type,
  title,
  link,
  is_active,
  ...rest
}: TopBannerAnnouncementProps) => {
  if (!is_active) {
    return null;
  }

  return (
    <UiLink
      type="Link"
      href={link.url}
      target={link.target}
      className="text-text-on-action hover:text-text-on-action"
      iconAfter={<ArrowUpRight className="w-4 h-4" />}
      {...rest}
    >
      {title}
    </UiLink>
  );
};

export default TopBannerAnnouncement;
