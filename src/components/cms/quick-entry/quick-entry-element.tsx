'use client';

import { ArrowRight, Gauge, MessageSquareQuote, ScanSearch, ShoppingCart } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { sanitizeHref } from '@/lib/sanitize-href';
import type { QuickEntryElementData } from './schema';

const IconVariant = {
  MessageSquareQuote: MessageSquareQuote,
  ScanSearch: ScanSearch,
  Gauge: Gauge,
  ShoppingCart: ShoppingCart,
} as const;

const QuickEntryElement = ({ title, link, link_name, icon }: QuickEntryElementData) => {
  const Icon = icon && IconVariant[icon as keyof typeof IconVariant];
  return (
    <Link
      href={sanitizeHref(link)}
      className="flex gap-6 align-center group w-full lg:max-w-[400px] bg-surface-page shadow-sm first:rounded-ss-xl last:rounded-ee-xl sm:first:rounded-ss-xl sm:last:rounded-ee-xl"
    >
      <div className="flex items-center justify-center bg-surface-action transition group-hover:bg-surface-action-hover text-icon-on-action p-4 md:p-5 rounded-ss-[inherit]">
        {Icon && <Icon className="w-8 h-8 md:w-10 md:h-10" />}
      </div>
      <div className="flex flex-col justify-center bg-surface-page ">
        <p className="sm:text-lg font-bold font-headlines">{title}</p>
        <p className="text-base inline-flex items-center gap-1 text-text-action font-bold underline transition group-hover:text-text-action-hover outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2">
          {link_name}
          <ArrowRight />
        </p>
      </div>
    </Link>
  );
};

export default QuickEntryElement;
