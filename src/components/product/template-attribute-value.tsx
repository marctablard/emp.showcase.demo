'use client';

import type { ReactElement } from 'react';
import { SquareCheckBig, SquareX } from 'lucide-react';
import {
  formatTemplateAttributeValue,
  parseBooleanTemplateAttributeValue,
} from '@/lib/common/product-template-attributes';
import { cn } from '@/lib/utils';
import type { ProductTemplateAttributeType } from '@/platform/services/model/product';

interface TemplateAttributeValueProps {
  value: string;
  type?: ProductTemplateAttributeType;
  locale: string;
  className?: string;
}

/**
 * Renders a template-attribute value: BOOLEAN → Lucide square icons; DATETIME → formatted date; else raw text.
 */
export function TemplateAttributeValue({
  value,
  type,
  locale,
  className,
}: Readonly<TemplateAttributeValueProps>): ReactElement {
  const booleanValue = parseBooleanTemplateAttributeValue(value, type);

  if (booleanValue === true) {
    return (
      <SquareCheckBig
        role="img"
        aria-label="Boolean true"
        className={cn('inline-block size-[1em] shrink-0', className)}
        data-testid="template-attribute-boolean-true"
      />
    );
  }

  if (booleanValue === false) {
    return (
      <SquareX
        role="img"
        aria-label="Boolean false"
        className={cn('inline-block size-[1em] shrink-0', className)}
        data-testid="template-attribute-boolean-false"
      />
    );
  }

  return <>{formatTemplateAttributeValue(value, type, locale)}</>;
}
