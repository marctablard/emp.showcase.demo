'use client';

import { type JSX, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import DOMPurify from 'dompurify';
import UiLink from '@/components/ui/link';
import { getPublicPdpDescriptionClampClass, getPublicPdpDescriptionClampLines } from '@/lib/common/public-default-env';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';

/**
 * Sanitize config aligned with HTMLRenderer — tenant product descriptions may contain markup.
 */
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'br',
    'hr',
    'strong',
    'em',
    'b',
    'i',
    'u',
    's',
    'mark',
    'small',
    'sub',
    'sup',
    'ul',
    'ol',
    'li',
    'a',
    'code',
    'pre',
    'blockquote',
    'div',
    'span',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'img',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height', 'class', 'id'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
};

export interface ProductDescriptionProps {
  html: string;
  className?: string;
}

/**
 * Localized product description: sanitized HTML, CSS line-clamp from the shared public env
 * constant, and a Show more / Show less toggle when content overflows.
 */
export function ProductDescription({ html, className }: Readonly<ProductDescriptionProps>): JSX.Element {
  const t = useTranslations('product');
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [contentKey, setContentKey] = useState(html);

  const clampLines = getPublicPdpDescriptionClampLines();
  const clampClass = getPublicPdpDescriptionClampClass(clampLines);

  const sanitizedHtml = useMemo(() => {
    try {
      return DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
    } catch (err) {
      getLogger().error({ err }, '[ProductDescription] Sanitization error');
      return '';
    }
  }, [html]);

  // Reset expand/overflow when the description HTML changes (React “adjust state while rendering”).
  if (html !== contentKey) {
    setContentKey(html);
    setExpanded(false);
    setIsOverflowing(false);
  }

  useEffect(() => {
    const el = contentRef.current;
    if (!el || expanded) {
      return;
    }

    const measure = (): void => {
      setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
    window.addEventListener('resize', measure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sanitizedHtml, expanded, clampClass]);

  return (
    <div className={cn('flex flex-col items-start gap-1', className)} data-testid="product-description">
      <div
        ref={contentRef}
        className={cn('text-lg text-text-body', !expanded && clampClass)}
        data-expanded={expanded ? 'true' : 'false'}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
      {isOverflowing && (
        <UiLink
          type="Button"
          variant="textBold"
          size="m"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded((current) => !current);
          }}
        >
          {expanded ? t('showLess') : t('showMore')}
        </UiLink>
      )}
    </div>
  );
}
