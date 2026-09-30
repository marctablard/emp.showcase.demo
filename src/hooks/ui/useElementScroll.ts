import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { breakpoints } from '@/lib/breakpoints';

type ScrollPinState = {
  isFixed: boolean;
  isFixedToTop: boolean;
  isContainerBottom: boolean;
};

const CLEARED_SCROLL_PIN: ScrollPinState = {
  isFixed: false,
  isFixedToTop: false,
  isContainerBottom: false,
};

export type ScrollPinMeasurement = {
  width: number;
  windowHeight: number;
  containerHeight: number;
  containerTop: number;
  containerBottom: number;
  contentTop: number;
  contentBottom: number;
  contentHeight: number;
};

function roundedLength(value: number | undefined): number {
  return Math.round(value ?? 0);
}

function sumChildHeights(bounding: HTMLElement | null | undefined): number {
  if (!bounding) {
    return 0;
  }
  return Array.from(bounding.children).reduce((sum, child) => sum + child.getBoundingClientRect().height, 0);
}

function measureScrollPin(
  fixedContainer: HTMLElement | null | undefined,
  boundingContent: HTMLElement | null | undefined,
  viewport: { width: number; height: number },
): ScrollPinMeasurement {
  const container = fixedContainer?.getBoundingClientRect();
  const content = boundingContent?.getBoundingClientRect();
  return {
    width: viewport.width,
    windowHeight: viewport.height,
    containerHeight: roundedLength(container?.height),
    containerTop: roundedLength(container?.top),
    containerBottom: container?.bottom ? Math.round(container.bottom + 24) : 0,
    contentTop: roundedLength(content?.top),
    contentBottom: roundedLength(content?.bottom),
    contentHeight: sumChildHeights(boundingContent),
  };
}

function canPinSummary(measurement: ScrollPinMeasurement): boolean {
  return Boolean(
    measurement.containerHeight &&
    measurement.contentHeight &&
    measurement.containerHeight <= measurement.contentHeight &&
    measurement.windowHeight - measurement.containerHeight > 0 &&
    measurement.width >= breakpoints.lg,
  );
}

function releaseWhenContentPasses(state: ScrollPinState, contentTop: number, containerTop: number): ScrollPinState {
  if (contentTop && contentTop > containerTop) {
    return { ...state, isFixed: false, isContainerBottom: false };
  }
  return state;
}

function pinAboveContent(
  state: ScrollPinState,
  measurement: ScrollPinMeasurement,
  topPosition: number,
): ScrollPinState {
  if (measurement.containerTop && measurement.containerTop <= topPosition) {
    return releaseWhenContentPasses(
      { ...state, isFixed: true, isFixedToTop: true },
      measurement.contentTop,
      measurement.containerTop,
    );
  }
  // A bottom-fixed summary is measured from its viewport box, so its top stays below the
  // pin offset after the shopper scrolls back up. Drop that pin and return to document flow.
  if (state.isFixed && !state.isFixedToTop) {
    return CLEARED_SCROLL_PIN;
  }
  return releaseWhenContentPasses(state, measurement.contentTop, measurement.containerTop);
}

function pinAtBottom(state: ScrollPinState, measurement: ScrollPinMeasurement): ScrollPinState {
  const pastContent = Boolean(
    measurement.containerBottom && measurement.contentBottom && measurement.containerBottom > measurement.contentBottom,
  );
  const nearViewportBottom = Boolean(
    measurement.containerBottom && measurement.windowHeight - measurement.containerBottom < 12,
  );
  const released = pastContent ? { ...state, isFixed: false, isContainerBottom: true } : state;
  if (nearViewportBottom) {
    return { ...released, isFixed: true, isFixedToTop: false };
  }
  return released;
}

/** Pure pin decision so resize/scroll can drop a stale fixed summary when it no longer fits. */
export function resolveScrollPin(
  state: ScrollPinState,
  measurement: ScrollPinMeasurement,
  topPosition: number,
): ScrollPinState {
  if (!canPinSummary(measurement)) {
    return CLEARED_SCROLL_PIN;
  }
  const aboveContent = Boolean(
    measurement.containerBottom && measurement.contentBottom && measurement.containerBottom < measurement.contentBottom,
  );
  if (aboveContent) {
    return pinAboveContent(state, measurement, topPosition);
  }
  return pinAtBottom(state, measurement);
}

function samePin(left: ScrollPinState, right: ScrollPinState): boolean {
  return (
    left.isFixed === right.isFixed &&
    left.isFixedToTop === right.isFixedToTop &&
    left.isContainerBottom === right.isContainerBottom
  );
}

export const useElementScroll = (
  fixedContainer: RefObject<HTMLElement | null>,
  topPosition: number,
  boundingContent: RefObject<HTMLDivElement | null>,
) => {
  const [pin, setPin] = useState<ScrollPinState>(CLEARED_SCROLL_PIN);

  useEffect(() => {
    const scrollHandler = () => {
      const measurement = measureScrollPin(fixedContainer.current, boundingContent.current, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setPin((current) => {
        const next = resolveScrollPin(current, measurement, topPosition);
        return samePin(current, next) ? current : next;
      });
    };
    window.addEventListener('scroll', scrollHandler);
    window.addEventListener('resize', scrollHandler);
    scrollHandler();

    return () => {
      window.removeEventListener('scroll', scrollHandler);
      window.removeEventListener('resize', scrollHandler);
    };
  }, [fixedContainer, boundingContent, topPosition]);

  return pin;
};
