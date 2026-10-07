'use client';

import { useEffect, useState } from 'react';

/**
 * `true` once the target has scrolled up past the bottom edge of the barrier.
 *
 * For content a sticky element has swallowed: the barrier is that sticky element, so the answer
 * follows its actual position rather than a hard-coded offset — which would go wrong as soon as
 * the site header collapses on scroll and moves everything below it.
 *
 * `lead` answers that many pixels early, for a replacement that should be there before the last
 * sliver of the original disappears.
 */
export function useScrolledBehind(lead = 0) {
  // Callback refs rather than ref objects: the measurement has to start when the elements appear,
  // and in this view they do so several renders after mount, behind a spinner.
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [barrier, setBarrier] = useState<HTMLElement | null>(null);
  const [behind, setBehind] = useState(false);

  useEffect(() => {
    if (!target || !barrier) return;

    let frame = 0;
    const check = () => {
      frame = 0;
      setBehind(target.getBoundingClientRect().bottom < barrier.getBoundingClientRect().bottom + lead);
    };

    // Coalesced into a frame, which also keeps the first answer out of the effect itself.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };

    schedule();

    // Capture phase: a scroll event does not bubble, so a page scrolling inside a wrapper rather
    // than the document would never reach a listener bound on the window.
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule, { passive: true });
    // Removing a product shortens the target without any scrolling.
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(target);

    return () => {
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      resizeObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target, barrier, lead]);

  return { targetRef: setTarget, barrierRef: setBarrier, behind };
}
