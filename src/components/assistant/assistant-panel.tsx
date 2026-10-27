'use client';

import { type KeyboardEvent, type PointerEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AiHelperCard } from '@/components/account/dashboard/cards/ai-helper-card';
import { usePersistedState } from '@/hooks/common/usePersistedState';
import { cn } from '@/lib/utils';
import { useAssistantPanel } from './assistant-panel-context';

const DEFAULT_WIDTH = 440;
const MIN_WIDTH = 360;
const MAX_WIDTH = 960;
const KEYBOARD_STEP = 24;

/** Leave at least 40% of the viewport to the page. */
const clampWidth = (width: number) => {
  const max = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(window.innerWidth * 0.6)));
  return Math.min(max, Math.max(MIN_WIDTH, Math.round(width)));
};

/**
 * Right-hand AI agent panel. Docks beside the page from `lg` (the page makes room via
 * `--assistant-offset`) and overlays it on smaller screens. The left edge resizes it.
 */
export function AssistantPanel() {
  const t = useTranslations('account.AiHelper');
  const { open, setOpen } = useAssistantPanel();
  const [width, setWidth] = usePersistedState<number>({ key: 'assistant-panel.width', defaultValue: DEFAULT_WIDTH });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--assistant-width', `${width}px`);
    return () => {
      root.style.removeProperty('--assistant-width');
    };
  }, [width]);

  useEffect(() => {
    if (!dragging) return;
    const previous = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = previous;
    };
  }, [dragging]);

  if (!open) return null;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging) setWidth(clampWidth(window.innerWidth - event.clientX));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') setWidth(clampWidth(width + KEYBOARD_STEP));
    else if (event.key === 'ArrowRight') setWidth(clampWidth(width - KEYBOARD_STEP));
    else if (event.key === 'Home') setWidth(clampWidth(MAX_WIDTH));
    else if (event.key === 'End') setWidth(MIN_WIDTH);
    else return;
    event.preventDefault();
  };

  return (
    <aside
      aria-label={t('title')}
      data-testid="assistantPanel"
      className="fixed inset-y-0 right-0 z-70 flex w-full flex-col border-l border-border-primary bg-surface-page shadow-xl sm:w-(--assistant-width) lg:shadow-none"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('resizePanel')}
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        tabIndex={0}
        data-testid="assistantPanel-resizeHandle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => setWidth(clampWidth(DEFAULT_WIDTH))}
        onKeyDown={onKeyDown}
        className={cn(
          'absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize touch-none transition-colors hover:bg-surface-action/30 focus-visible:bg-surface-action/30 focus-visible:outline-none sm:block',
          dragging && 'bg-surface-action/30',
        )}
      />
      <AiHelperCard placement="panel" onClose={() => setOpen(false)} />
    </aside>
  );
}
