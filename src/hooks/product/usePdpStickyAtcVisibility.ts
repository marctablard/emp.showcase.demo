'use client';

import { type RefObject, useEffect, useState } from 'react';

/**
 * Shows the sticky add-to-cart bar when the inline ATC block leaves the viewport (md+).
 */
export function usePdpStickyAtcVisibility(targetRef: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = targetRef.current;
    if (target === null || !enabled) {
      setVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) {
          return;
        }
        setVisible(!entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 1.0,
      },
    );
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [targetRef, enabled]);

  return visible;
}
