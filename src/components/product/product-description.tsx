'use client';

import { type JSX, useEffect, useRef, useState } from 'react';
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

function sanitizeDescriptionHtml(html: string): string {
  try {
    return DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
  } catch (err) {
    getLogger().error({ err }, '[ProductDescription] Sanitization error');
    return '';
  }
}

/**
 * Localized product description: sanitized HTML, CSS line-clamp from the shared public env
 * constant, and a Show more / Show less toggle when content overflows.
 *
 * DOMPurify needs a browser DOM, so sanitize runs after mount. SSR + the first client render
 * both use an empty string to avoid a hydration mismatch.
 */
export function ProductDescription({ html, className }: Readonly<ProductDescriptionProps>): JSX.Element {
  const t = useTranslations('product');
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [contentKey, setContentKey] = useState(html);
  // Empty on SSR / first paint — DOMPurify is browser-only and would otherwise hydrate as "".
  const [sanitizedHtml, setSanitizedHtml] = useState('');
  const [sanitizedSource, setSanitizedSource] = useState<string | null>(null);

  const clampLines = getPublicPdpDescriptionClampLines();
  const clampClass = getPublicPdpDescriptionClampClass(clampLines);

  // Reset expand/overflow when the description HTML changes (React “adjust state while rendering”).
  if (html !== contentKey) {
    setContentKey(html);
    setExpanded(false);
    setIsOverflowing(false);
    setSanitizedHtml('');
    setSanitizedSource(null);
  }

  // Sanitize on the client during render once a browser DOM is available (same pattern as contentKey).
  if (typeof window !== 'undefined' && sanitizedSource !== html) {
    setSanitizedSource(html);
    setSanitizedHtml(sanitizeDescriptionHtml(html));
  }

  useEffect(() => {
    const el = contentRef.current;
    if (!el || expanded || !sanitizedHtml) {
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
