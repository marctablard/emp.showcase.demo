import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import QuickEntryElement from './quick-entry-element';
import type { QuickEntryData } from './schema';

export type QuickEntryProps = QuickEntryData & HTMLAttributes<HTMLDivElement>;

const QuickEntry = ({ id: _id, type: _type, elements, className, ...rest }: Readonly<QuickEntryProps>) => {
  return (
    <div className={cn('mb-10 w-full bg-surface-action-hover-2', className)} {...rest}>
      <div className="grid grid-cols-[1fr] sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_1fr_1fr] lg:max-w-[1672px] mx-auto justify-items-center gap-3 sm:gap-4 md:gap-6 px-4 py-4 md:py-6 lg:px-9">
        {elements?.map((element) => (
          <QuickEntryElement key={`${element.link}-${element.title}`} {...element} />
        ))}
      </div>
    </div>
  );
};

export default QuickEntry;
