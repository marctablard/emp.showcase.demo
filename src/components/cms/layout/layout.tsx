import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { LayoutData } from './schema';

export type LayoutProps = LayoutData &
  HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode;
  };

/**
 * Layout container — the per-page frame fetched via `CmsAdapter.getLayout`.
 *
 * Like `page` / `segment` / `columns`, it does NOT iterate `body[]` itself:
 * `CmsRenderer` resolves each body entry (substituting the single
 * `content-slot` with the page's own body) and hands the resulting React
 * elements in via the `children` prop. The component only frames them in a
 * full-height column so a sticky header / footer in the body flow as
 * expected.
 */
const Layout = ({ id: _id, type: _type, body: _body, children, className, ...rest }: LayoutProps) => {
  return (
    <div className={cn('flex min-h-full flex-col', className)} {...rest}>
      {children}
    </div>
  );
};

export default Layout;
