import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

export const useElementScroll = (
  fixedContainer: RefObject<HTMLElement | null>,
  topPosition: number,
  boundingContent: RefObject<HTMLDivElement | null>,
) => {
  const [isFixed, setIsFixed] = useState(false);
  const [isFixedToTop, setIsFixedToTop] = useState(false);
  const [isContainerBottom, setIsContainerBottom] = useState(false);

  useEffect(() => {
    const scrollHandler = () => {
      const containerHeight = Math.round(
        fixedContainer?.current?.getBoundingClientRect().height
          ? fixedContainer?.current?.getBoundingClientRect().height
          : 0,
      );
      const containerTop = Math.round(
        fixedContainer?.current?.getBoundingClientRect().top ? fixedContainer?.current?.getBoundingClientRect().top : 0,
      );
      const containerBottom = Math.round(
        fixedContainer?.current?.getBoundingClientRect().bottom
          ? fixedContainer?.current?.getBoundingClientRect().bottom + 24
          : 0,
      );
      const windowHeight = window.innerHeight;
      const contentBox = boundingContent?.current?.getBoundingClientRect();
      const contentBottom = Math.round(contentBox?.bottom ? contentBox?.bottom : 0);
      const contentTop = Math.round(contentBox?.top ? contentBox?.top : 0);
      const contentHeight =
        boundingContent?.current?.children &&
        Array.from(boundingContent?.current?.children)
          .map((item) => item.getBoundingClientRect().height)
          .reduce((a, b) => a + b, 0);

      if (
        containerHeight &&
        contentHeight &&
        containerHeight <= contentHeight &&
        windowHeight - containerHeight > 0 &&
        window.innerWidth >= 1024
      ) {
        if (containerBottom && contentBottom && containerBottom < contentBottom) {
          if (containerTop && containerTop <= topPosition) {
            setIsFixed(true);
            setIsFixedToTop(true);
            if (contentTop && contentTop > containerTop) {
              setIsFixed(false);
              setIsContainerBottom(false);
            }
          } else {
            if (contentTop && contentTop > containerTop) {
              setIsFixed(false);
              setIsContainerBottom(false);
            }
          }
        } else {
          if (containerBottom && contentBottom && containerBottom > contentBottom) {
            setIsFixed(false);
            setIsContainerBottom(true);
          }
          if (containerBottom && windowHeight - containerBottom < 12) {
            setIsFixed(true);
            setIsFixedToTop(false);
          }
        }
      }
    };
    window.addEventListener('scroll', scrollHandler);

    return () => {
      window.removeEventListener('scroll', scrollHandler);
    };
  }, [fixedContainer, boundingContent, topPosition]);

  return { isFixed, isFixedToTop, isContainerBottom };
};
