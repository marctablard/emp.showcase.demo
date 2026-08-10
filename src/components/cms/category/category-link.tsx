'use client';

import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

type CategoryLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

const CategoryLink = ({ href, className, children }: Readonly<CategoryLinkProps>) => {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
};

export default CategoryLink;
