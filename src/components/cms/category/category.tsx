import type { HTMLAttributes } from 'react';
import Image from 'next/image';
import { H3 } from '@/components/ui/h';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { CategoryData } from './schema';

export type CategoryProps = CategoryData & HTMLAttributes<HTMLDivElement>;

const Category = ({
  id: _id,
  type: _type,
  title,
  description,
  emporix_category_id,
  banner,
  highlight,
  site: _site,
  className,
  ...rest
}: CategoryProps) => {
  const categoryUrl = emporix_category_id ? `/browse/${emporix_category_id}` : '#';

  return (
    <div
      className={cn('rounded-md overflow-hidden shadow-md', highlight && 'border-2 border-border-primary', className)}
      {...rest}
    >
      {banner?.filename && (
        <div className="relative h-48">
          <Image src={banner.filename} alt={banner.alt || title || 'Category'} fill className="object-cover" />
        </div>
      )}

      <div className="p-4">
        {title && (
          <H3 variant="h5" className="mb-2">
            {title}
          </H3>
        )}

        {description && <p className="text-text-placeholders mb-4 line-clamp-2">{description}</p>}

        <Link href={categoryUrl} className="text-text-action hover:underline font-medium">
          View Products
        </Link>
      </div>
    </div>
  );
};

export default Category;
