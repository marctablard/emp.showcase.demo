'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

type TruncatedTextProps = {
  text: string;
  className?: string;
};

/**
 * Single-line ellipsis. The tooltip opens only after layout shows the text does not fit.
 */
export function TruncatedText({ text, className }: Readonly<TruncatedTextProps>) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = () => {
      setTruncated(element.scrollWidth > element.clientWidth);
    };

    if (typeof ResizeObserver === 'undefined') {
      const frame = requestAnimationFrame(update);
      return () => cancelAnimationFrame(frame);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    const frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [text]);

  return (
    <Tooltip open={truncated ? open : false} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <p ref={ref} className={cn('min-w-0 flex-1 truncate', className)}>
          {text}
        </p>
      </TooltipTrigger>
      <TooltipContent className="break-all">{text}</TooltipContent>
    </Tooltip>
  );
}
