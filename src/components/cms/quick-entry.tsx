import { ArrowRight, Gauge, MessageSquareQuote, ScanSearch, ShoppingCart } from 'lucide-react';
import { Link } from '@/i18n/navigation';

const IconVariant = {
  MessageSquareQuote: MessageSquareQuote,
  ScanSearch: ScanSearch,
  Gauge: Gauge,
  ShoppingCart: ShoppingCart,
} as const;

interface QuickEntry {
  title: string;
  link: string;
  link_name: string;
  icon: string;
}

interface QuickEntryElementProps {
  title: string;
  link: string;
  link_name: string;
  icon: string;
}

interface QuickEntryProps {
  elements: QuickEntry[];
}

const QuickEntryElement = ({ title, link, link_name, icon }: QuickEntryElementProps) => {
  const Icon = icon && IconVariant[icon as keyof typeof IconVariant];
  return (
    <Link
      href={link}
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

const QuickEntry = ({ elements }: QuickEntryProps) => {
  return (
    <div className="mb-10 w-full bg-surface-action-hover-2">
      <div className="grid grid-cols-[1fr] sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_1fr_1fr] lg:max-w-[1672px] mx-auto justify-items-center gap-3 sm:gap-4 md:gap-6 px-4 py-4 md:py-6 lg:px-9">
        {elements &&
          elements.map((element, index) => {
            return <QuickEntryElement key={index} {...element} />;
          })}
      </div>
    </div>
  );
};

export default QuickEntry;
