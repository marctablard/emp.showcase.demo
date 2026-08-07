'use client';

import { type JSX, type TransitionEvent, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import DOMPurify from 'dompurify';
import UiLink from '@/components/ui/link';
import {
  getPublicPdpDescriptionClampClass,
  getPublicPdpDescriptionClampLines,
  getPublicPdpDescriptionCollapsedMaxHeightClass,
} from '@/lib/common/public-default-env';
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
 * Expand/collapse animates `max-height` between the measured collapsed and expanded heights
 * so both directions interpolate (a huge CSS max-height like `80rem` would skip compact motion).
 *
 * Remount on `html` change (`key`) so expand/overflow state resets without render-time setState.
 * DOMPurify needs a browser DOM, so sanitize runs after mount; SSR + first paint stay empty.
 */
export function ProductDescription({ html, className }: Readonly<ProductDescriptionProps>): JSX.Element {
  return <ProductDescriptionContent key={html} html={html} className={className} />;
}

function ProductDescriptionContent({ html, className }: Readonly<ProductDescriptionProps>): JSX.Element {
  const t = useTranslations('product');
  const contentRef = useRef<HTMLDivElement>(null);
  const collapsedHeightRef = useRef<number | null>(null);
  const expandedRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(true);
  const [maxHeightPx, setMaxHeightPx] = useState<number | undefined>(undefined);
  const [isOverflowing, setIsOverflowing] = useState(false);
  // Empty on SSR / first paint — DOMPurify is browser-only and would otherwise hydrate as "".
  const [sanitizedHtml, setSanitizedHtml] = useState('');

  const clampLines = getPublicPdpDescriptionClampLines();
  const clampClass = getPublicPdpDescriptionClampClass(clampLines);
  const collapsedMaxHeightClass = getPublicPdpDescriptionCollapsedMaxHeightClass(clampLines);

  const toggleExpanded = (): void => {
    const el = contentRef.current;
    if (!el) {
      const next = !expandedRef.current;
      expandedRef.current = next;
      setExpanded(next);
      setClamped(!next);
      return;
    }

    if (clamped) {
      const startHeight = el.clientHeight;
      collapsedHeightRef.current = startHeight;
      expandedRef.current = true;
      setExpanded(true);
      setClamped(false);
      setMaxHeightPx(startHeight);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const content = contentRef.current;
          if (content) {
            setMaxHeightPx(content.scrollHeight);
          }
        });
      });
      return;
    }

    const startHeight = el.scrollHeight;
    const endHeight = collapsedHeightRef.current ?? el.clientHeight;
    expandedRef.current = false;
    setExpanded(false);
    setMaxHeightPx(startHeight);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMaxHeightPx(endHeight);
      });
    });
  };

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>): void => {
    // Ignore bubbled transitions from nested markup; jsdom may omit propertyName.
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.propertyName && event.propertyName !== 'max-height') {
      return;
    }

    if (!expandedRef.current) {
      setClamped(true);
      setMaxHeightPx(undefined);
      return;
    }

    // Expanded steady state: drop the inline cap so content can reflow freely.
    setMaxHeightPx(undefined);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DOMPurify needs a browser DOM; empty first paint avoids hydration mismatch
    setSanitizedHtml(sanitizeDescriptionHtml(html));
  }, [html]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !clamped || !sanitizedHtml) {
      return;
    }

    const measure = (): void => {
      collapsedHeightRef.current = el.clientHeight;
      setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
    globalThis.window.addEventListener('resize', measure);

    return () => {
      resizeObserver.disconnect();
      globalThis.window.removeEventListener('resize', measure);
    };
  }, [sanitizedHtml, clamped, clampClass]);

  return (
    <div className={cn('flex flex-col items-start gap-1', className)} data-testid="product-description">
      <div
        ref={contentRef}
        className={cn(
          'text-lg text-text-body overflow-hidden transition-[max-height] duration-300 ease-in-out',
          clamped && clampClass,
          clamped && maxHeightPx === undefined && collapsedMaxHeightClass,
        )}
        // Measured expand/collapse heights — CSS max-h-[80rem] cannot animate compact smoothly.
        style={maxHeightPx === undefined ? undefined : { maxHeight: `${maxHeightPx}px` }}
        data-expanded={expanded ? 'true' : 'false'}
        onTransitionEnd={handleTransitionEnd}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
      {isOverflowing && (
        <UiLink type="Button" variant="textBold" size="m" aria-expanded={expanded} onClick={toggleExpanded}>
          {expanded ? t('showLess') : t('showMore')}
        </UiLink>
      )}
    </div>
  );
}
