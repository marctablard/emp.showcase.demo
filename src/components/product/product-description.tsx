'use client';

import { type JSX, type TransitionEvent, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import DOMPurify from 'dompurify';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  ADD_ATTR: ['target', 'rel'],
};

const BLANK_TARGET_REL = 'noopener noreferrer';

/** Force safe `rel` on `target="_blank"` links (reverse-tabnabbing). */
function enforceBlankTargetRel(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  for (const anchor of Array.from(container.querySelectorAll('a[target="_blank"]'))) {
    anchor.setAttribute('rel', BLANK_TARGET_REL);
  }
  return container.innerHTML;
}

export interface ProductDescriptionProps {
  html: string;
  className?: string;
}

function sanitizeDescriptionHtml(html: string): string {
  try {
    return enforceBlankTargetRel(DOMPurify.sanitize(html, DOMPURIFY_CONFIG));
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

  const showFade = clamped && isOverflowing;

  return (
    <div className={cn('space-y-3', className)} data-testid="product-description">
      <div className="relative">
        <div
          ref={contentRef}
          className={cn(
            'text-sm leading-relaxed text-text-body overflow-hidden transition-[max-height] duration-300 ease-in-out [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5',
            clamped && clampClass,
            clamped && maxHeightPx === undefined && collapsedMaxHeightClass,
          )}
          // Measured expand/collapse heights — CSS max-h-[80rem] cannot animate compact smoothly.
          style={maxHeightPx === undefined ? undefined : { maxHeight: `${maxHeightPx}px` }}
          data-expanded={expanded ? 'true' : 'false'}
          onTransitionEnd={handleTransitionEnd}
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
        {showFade && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface-page to-transparent" />
        )}
      </div>
      {isOverflowing && (
        <Button
          type="button"
          variant="link"
          size="small"
          className="h-auto p-0 normal-case tracking-normal text-text-action"
          onClick={toggleExpanded}
          aria-expanded={expanded}
        >
          {expanded ? t('showLess') : t('showMore')}
          <ChevronDown className={cn('ml-1 h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </Button>
      )}
    </div>
  );
}
