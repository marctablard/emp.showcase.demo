'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COLLAPSED_MAX_HEIGHT = 120;

interface ProductDescriptionProps {
  html: string;
  className?: string;
}

export function ProductDescription({ html, className }: ProductDescriptionProps) {
  const t = useTranslations('product');
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isTruncatable, setIsTruncatable] = useState(false);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }
    setIsTruncatable(element.scrollHeight > COLLAPSED_MAX_HEIGHT + 8);
  }, [html]);

  if (!html.trim()) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <div
          ref={contentRef}
          className={cn(
            'text-sm leading-relaxed text-text-body [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5',
            !expanded && isTruncatable && 'max-h-[120px] overflow-hidden',
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {!expanded && isTruncatable && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface-page to-transparent" />
        )}
      </div>
      {isTruncatable && (
        <Button
          type="button"
          variant="link"
          size="small"
          className="h-auto p-0 normal-case tracking-normal text-text-action"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? t('viewLess') : t('viewMore')}
          <ChevronDown className={cn('ml-1 h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </Button>
      )}
    </div>
  );
}
