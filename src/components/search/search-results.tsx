'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ProductTile } from '@/components/product/product-tile';
import { ProductTileSkeleton } from '@/components/product/product-tile-skeleton';
import { SearchFilter } from '@/components/search/search-filter';
import { H2 } from '@/components/ui/h';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearch } from '@/hooks/search/useSearch';
import { SearchParams, SearchResult } from '@/platform/services/model/common';
import { Product } from '@/platform/services/model/product';

interface SearchClientWrapperProps {
  initialSearch?: SearchParams<Product>;
  initialResults?: SearchResult<Product>;
  locale: string;
}

export function SearchResultsComponent({ initialSearch, initialResults, locale }: SearchClientWrapperProps) {
  const t = useTranslations('search');
  const searchParams = useSearchParams();
  // Initialize the search hook with Product type and initial results
  const {
    data: products,
    loading,
    total,
    facets: availableFilters,
    currentPage,
    pageSize,
    search,
    applyFacet,
    applyRangeFacet,
    applyAllFacets,
    resetFacet,
    resetAllFacets,
    activeFilters,
    changePage,
  } = useSearch<Product>(initialSearch, initialResults);
  const visiblePagination = useMemo(() => {
    if (pageSize <= 0) {
      return [];
    }

    const totalPages = Math.ceil(total / pageSize);
    if (totalPages === 0) {
      return [];
    }

    const start = Math.max(0, currentPage - 2);
    const end = Math.min(totalPages - 1, currentPage + 2);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [currentPage, total, pageSize]);

  useEffect(() => {
    // Parse URL parameters to restore search state
    const query = searchParams.get('q') ?? '';
    const page = parseInt(searchParams.get('page') ?? '0', 10);
    const size = parseInt(searchParams.get('size') ?? String(pageSize), 10);
    const sort = searchParams.get('sort') ?? undefined;

    const filters: Record<string, string | string[] | Record<string, string>> = {};

    searchParams.forEach((value, key) => {
      const filterRegex = /^filters\[(.*?)\](\[\]|\[(.*?)\])?$/;
      const match = key.match(filterRegex);

      if (match) {
        const filterKey = match[1];
        const isArray = match[2] === '[]';
        const nestedKey = match[3];

        // Handle nested filters like filters[price][from]
        if (nestedKey) {
          if (!filters[filterKey] || typeof filters[filterKey] !== 'object' || Array.isArray(filters[filterKey])) {
            filters[filterKey] = {};
          }

          (filters[filterKey] as Record<string, string>)[nestedKey] = value;
        }
        // Handle array filters like filters[category][]
        else if (isArray) {
          if (!filters[filterKey]) {
            filters[filterKey] = [];
          } else if (!Array.isArray(filters[filterKey])) {
            filters[filterKey] = [filters[filterKey] as string];
          }

          (filters[filterKey] as string[]).push(value);
        }
        // Handle simple filters like filters[inStock]
        else {
          filters[filterKey] = value;
        }
      }
    });

    // Perform search with parameters from URL
    search({
      query: query,
      page: page,
      size: size, // Use the size from URL parameters
      sort: sort,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    });
  }, [searchParams, pageSize, search]);

  return (
    <>
      <SearchFilter
        {...{
          activeFilters,
          availableFilters,
          resetFacet,
          resetAllFacets,
          applyFacet,
          applyRangeFacet,
          applyAllFacets,
        }}
      />
      {/* Product Grid */}
      <div className="mt-6 w-full">
        {loading ? (
          <>
            <Skeleton className="h-5 w-[180px] mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-fr">
              {Array.from({ length: Math.min(pageSize, products.length) }).map((_, i) => (
                <ProductTileSkeleton key={i} />
              ))}
            </div>
          </>
        ) : (
          <>
            {products.length === 0 ? (
              <div className="text-center py-12">
                <H2 className="mb-2">{t('searchResults.noProductsFound')}</H2>
                <p className="text-text-placeholders">{t('searchResults.tryAdjusting')}</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p className="text-sm text-text-placeholders">
                    {t('searchResults.showing', {
                      start: currentPage * pageSize + 1,
                      end: currentPage * pageSize + products.length,
                      total: total,
                    })}
                  </p>
                </div>

                {/* Client-side rendered products - this will replace the server-rendered ones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-fr">
                  {products.map((product) => (
                    <div key={product.id} className="h-full">
                      <ProductTile product={product} locale={locale} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        {/* Simple Pagination */}
        {total > pageSize && (
          <div className="mt-8 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 0) changePage(currentPage - 1);
                    }}
                    disabled={currentPage === 0}
                  />
                </PaginationItem>

                {visiblePagination.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href="#"
                      isActive={currentPage === pageNumber}
                      onClick={(e) => {
                        e.preventDefault();
                        changePage(pageNumber);
                      }}
                    >
                      {pageNumber + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                {/**/}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < Math.ceil(total / pageSize) - 1) {
                        changePage(currentPage + 1);
                      }
                    }}
                    disabled={currentPage === Math.ceil(total / pageSize) - 1}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </>
  );
}
