import { LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';

interface HeaderIconLinkProps {
  icon: LucideIcon;
  text: string;
  href: string;
}

export function HeaderIconLink({ icon: Icon, text, href }: HeaderIconLinkProps) {
  return (
    <Link
      role="button"
      title={text}
      href={href}
      className="flex flex-col text-icon-primary-dark items-center min-w-12 rounded-button p-0.5 hover:bg-surface-action hover:text-text-on-action transition-colors focus-visible:outline-2 focus:outline-border-focus"
    >
      <Icon className="w-8 h-8" />
      <p className="text-sm font-bold -mt-1">{text}</p>
    </Link>
  );
}
