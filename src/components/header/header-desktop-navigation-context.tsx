'use client';

import { type ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { MenuItem } from '@/data/navigation-menu';

type HeaderDesktopNavigationContextValue = {
  activeDesktopMenu: MenuItem | null;
  handleMenuHover: (item: MenuItem | null) => void;
  scheduleFlyoutClose: () => void;
  dismissFlyout: () => void;
};

const HeaderDesktopNavigationContext = createContext<HeaderDesktopNavigationContextValue | null>(null);

export function HeaderDesktopNavigationProvider({ children }: { children: ReactNode }) {
  const [activeDesktopMenu, setActiveDesktopMenu] = useState<MenuItem | null>(null);
  const menuLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLeaveTimer = useCallback(() => {
    if (menuLeaveTimeoutRef.current) {
      clearTimeout(menuLeaveTimeoutRef.current);
      menuLeaveTimeoutRef.current = null;
    }
  }, []);

  const dismissFlyout = useCallback(() => {
    clearLeaveTimer();
    setActiveDesktopMenu(null);
  }, [clearLeaveTimer]);

  const scheduleFlyoutClose = useCallback(() => {
    clearLeaveTimer();
    menuLeaveTimeoutRef.current = setTimeout(() => {
      setActiveDesktopMenu(null);
      menuLeaveTimeoutRef.current = null;
    }, 150);
  }, [clearLeaveTimer]);

  const handleMenuHover = useCallback(
    (item: MenuItem | null) => {
      clearLeaveTimer();
      if (item && !item.hasSubmenu) {
        setActiveDesktopMenu(null);
        return;
      }
      setActiveDesktopMenu(item);
    },
    [clearLeaveTimer],
  );

  const value = useMemo(
    () => ({
      activeDesktopMenu,
      handleMenuHover,
      scheduleFlyoutClose,
      dismissFlyout,
    }),
    [activeDesktopMenu, handleMenuHover, scheduleFlyoutClose, dismissFlyout],
  );

  return <HeaderDesktopNavigationContext.Provider value={value}>{children}</HeaderDesktopNavigationContext.Provider>;
}

export function useHeaderDesktopNavigation(): HeaderDesktopNavigationContextValue {
  const ctx = useContext(HeaderDesktopNavigationContext);
  if (!ctx) {
    throw new Error('useHeaderDesktopNavigation must be used within HeaderDesktopNavigationProvider');
  }
  return ctx;
}
