'use client';

import { cn } from '@/lib/utils';
import { useEmporixCMSContext } from '../context/emporix-cms-context';
import EmporixCMSComponentRenderer from './emporix-cms-component-renderer';

interface EmporixContentSlotProps extends React.HTMLAttributes<HTMLDivElement> {
  slot: string;
  renderWhenEmpty?: boolean;
  theme?: string;
}

/**
 * Renders a CMS content slot with its components.
 *
 * Features:
 * - Renders components for the specified slot
 * - Shows visual feedback in editor mode (purple border for layout slots, green for page slots)
 * - Only renders when has components OR renderWhenEmpty is true
 * - Applies highlight styling to selected components
 */
export default function EmporixContentSlot({
  slot,
  renderWhenEmpty,
  className,
  theme,
  ...htmlAttributes
}: EmporixContentSlotProps) {
  const { slotComponents, slotConfig, isEditorMode, highlightedSlotId } = useEmporixCMSContext();

  const components = slotComponents[slot] || [];
  const slotInfo = slotConfig.find((s) => s.slotId === slot);
  const hasComponents = components.length > 0;

  // Determine if we should render
  const shouldRender = hasComponents || renderWhenEmpty || isEditorMode;

  if (!shouldRender) {
    return null;
  }

  // Determine slot type for editor styling
  const isLayoutSlot = slotInfo?.type === 'layout';
  const isPageSlot = slotInfo?.type === 'page';
  const isHighlighted = isEditorMode && highlightedSlotId === slot;

  // Build editor mode classes
  const editorClasses = isEditorMode
    ? cn(
        'min-h-[50px]',
        // Highlighted slot gets blue solid outline
        isHighlighted &&
          'outline outline-2 outline-solid [outline-color:var(--color-cms-highlight)] outline-offset-[-2px]',
        // Non-highlighted slots get their normal dashed outlines
        !isHighlighted &&
          isLayoutSlot &&
          'outline outline-2 outline-dashed [outline-color:var(--color-cms-slot-layout)] outline-offset-[-2px]',
        !isHighlighted &&
          isPageSlot &&
          'outline outline-2 outline-dashed [outline-color:var(--color-cms-slot-page)] outline-offset-[-2px]',
      )
    : '';

  return (
    <div data-slot={slot} className={cn(editorClasses, className)} {...htmlAttributes}>
      {hasComponents ? (
        <EmporixCMSComponentRenderer components={components} theme={theme} />
      ) : isEditorMode ? (
        <div className="p-4 text-center text-gray-400 text-sm">
          {isLayoutSlot ? `Layout Slot: ${slot}` : `Page Slot: ${slot}`}
        </div>
      ) : null}
    </div>
  );
}
