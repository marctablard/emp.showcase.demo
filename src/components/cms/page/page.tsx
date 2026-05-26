import type { HTMLAttributes, ReactNode } from 'react';
import { H1 } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import type { PageData } from './schema';

export type PageProps = PageData &
  HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode;
  };

const Page = ({ id: _id, type: _type, title, body: _body, children, className, ...rest }: PageProps) => {
  return (
    <div className={cn('mx-auto', className)} {...rest}>
      {title && <H1 className="mb-6">{title}</H1>}
      <div className="space-y-8">{children}</div>
    </div>
  );
};

export default Page;
