'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { storyblokEditable } from '@storyblok/react/rsc';
import { ChevronRight } from 'lucide-react';
import { H2, H3 } from '@/components/ui/h';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoryTree } from '@/hooks/category/useCategoryTree';
import { useL10n } from '@/hooks/useL10n';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { Category } from '@/platform/services/model/category';

interface CategoryGridProps {
  title?: string;
  subtitle?: string;
  showAllCategories?: boolean;
  categoryId?: string;
  maxCategories?: number;
  columns?: 2 | 3 | 4;
  blok?: any; // For Storyblok compatibility
}

// Premium gradient combinations for categories without images
const gradients = [
  'bg-gradient-to-br from-blue-500 to-indigo-600',
  'bg-gradient-to-br from-purple-500 to-pink-600',
  'bg-gradient-to-br from-emerald-500 to-teal-600',
  'bg-gradient-to-br from-orange-500 to-red-600',
  'bg-gradient-to-br from-cyan-500 to-blue-600',
  'bg-gradient-to-br from-rose-500 to-fuchsia-600',
  'bg-gradient-to-br from-amber-500 to-orange-600',
  'bg-gradient-to-br from-violet-500 to-purple-600',
];

interface CategoryCardProps {
  category: Category;
  index: number;
}

const CategoryCard = ({ category, index }: CategoryCardProps) => {
  const { l10n } = useL10n();
  const categoryUrl = `/category/${category.id}`;
  const categoryName = l10n(category.name) || 'Category';
  const categoryDescription = l10n(category.shortDescription || category.description || '');

  // Get the first media item if available
  const hasImage = category.media && category.media.length > 0;
  const imageUrl = hasImage ? category.media![0].url : null;
  const gradientClass = gradients[index % gradients.length];

  return (
    <Link href={categoryUrl} className="group block h-full">
      <div
        className={cn(
          'relative h-full overflow-hidden rounded-xl shadow-md transition-all duration-300',
          'hover:shadow-2xl hover:-translate-y-1',
          'bg-surface-primary border border-border-primary',
        )}
      >
        {/* Image or Gradient Background */}
        <div className="relative h-48 overflow-hidden">
          {hasImage && imageUrl ? (
            <>
              <Image
                src={imageUrl}
                alt={categoryName}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {/* Overlay gradient for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            </>
          ) : (
            <>
              {/* Premium gradient background for categories without images */}
              <div className={cn(gradientClass, 'absolute inset-0')} />
              {/* Pattern overlay */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              />
            </>
          )}

          {/* Category name overlay on image */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <H3 variant="h5" className="text-white font-semibold drop-shadow-lg">
              {categoryName}
            </H3>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 flex flex-col justify-between min-h-[120px]">
          {categoryDescription && (
            <p className="text-text-placeholders text-sm line-clamp-2 mb-3">{categoryDescription}</p>
          )}

          {/* Action Link */}
          <div className="flex items-center text-text-action font-medium text-sm group-hover:text-text-action-hover transition-colors">
            <span>Explore Products</span>
            <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
};

const CategoryGridSkeleton = ({ columns }: { columns: number }) => {
  return (
    <div className={cn('grid gap-6', `grid-cols-1 md:grid-cols-${Math.min(columns, 2)} lg:grid-cols-${columns}`)}>
      {Array.from({ length: columns * 2 }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden border border-border-primary">
          <Skeleton className="h-48 w-full" />
          <div className="p-5 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};

const CategoryGrid = ({
  title = 'Shop by Category',
  subtitle,
  showAllCategories: _showAllCategories = true,
  categoryId = 'productroot',
  maxCategories,
  columns = 4,
  blok,
}: CategoryGridProps) => {
  const { categoryTree: _categoryTree, loading, error, notFound: _notFound } = useCategoryTree(null, categoryId, false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  // Fetch categories - always use the fallback API since tree structure doesn't work
  useEffect(() => {
    const fetchAllCategories = async () => {
      try {
        setFallbackLoading(true);
        const response = await fetch('/api/categories/all');
        if (response.ok) {
          const data = await response.json();

          // Sort by position
          const sortedCategories = data.sort((a: Category, b: Category) => {
            const posA = a.position ?? 9999;
            const posB = b.position ?? 9999;
            return posA - posB;
          });

          // Limit the number of categories if maxCategories is set
          const limitedCategories = maxCategories ? sortedCategories.slice(0, maxCategories) : sortedCategories;
          setCategories(limitedCategories);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setFallbackLoading(false);
      }
    };

    // Always fetch from the categories/all endpoint
    fetchAllCategories();
  }, [maxCategories]);

  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-12">
        <div className="text-center text-text-placeholders">
          <p>Unable to load categories. Please try again later.</p>
        </div>
      </div>
    );
  }

  if (loading || fallbackLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-12">
        {title && (
          <div className="text-center mb-10">
            <H2 className="mb-2">{title}</H2>
            {subtitle && <p className="text-text-placeholders text-lg">{subtitle}</p>}
          </div>
        )}
        <CategoryGridSkeleton columns={columns} />
      </div>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-12" {...(blok ? storyblokEditable(blok) : {})}>
      {/* Header */}
      {title && (
        <div className="text-center mb-10">
          <H2 className="mb-2">{title}</H2>
          {subtitle && <p className="text-text-placeholders text-lg">{subtitle}</p>}
        </div>
      )}

      {/* Category Grid */}
      <div
        className={cn(
          'grid gap-6',
          columns === 2 && 'grid-cols-1 md:grid-cols-2',
          columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
          columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        )}
      >
        {categories.map((category, index) => (
          <CategoryCard key={category.id} category={category} index={index} />
        ))}
      </div>
    </div>
  );
};

export default CategoryGrid;
