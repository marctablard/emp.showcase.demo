import type { HTMLAttributes } from 'react';
import { ArrowUpRight } from 'lucide-react';
import UiLink from '@/components/ui/link';
import { isExternalHref, sanitizeHref } from '@/lib/sanitize-href';
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
}: Readonly<TopBannerAnnouncementProps>) => {
  if (!is_active) {
    return null;
  }

  const href = sanitizeHref(link.url);

  // An unsafe URL sanitises to '' — announce the text without a link rather
  // than emitting a `Link` that would still resolve to a navigable route.
  if (!href) {
    return <span className="text-text-on-action">{title}</span>;
  }

  return (
    <UiLink
      type={isExternalHref(href) ? 'A' : 'Link'}
      href={href}
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
