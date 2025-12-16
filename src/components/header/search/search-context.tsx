'use client';

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export interface HeaderSearchContextValue {
  showSearch: boolean;
  setShowSearch: Dispatch<SetStateAction<boolean>>;
  toggleSearch: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  hasInputFocus: boolean;
  setHasInputFocus: Dispatch<SetStateAction<boolean>>;
  activateFocus: () => void;
  deactivateFocus: () => void;
  activateSearch: () => void;
  deactivateSearch: () => void;
}

const HeaderSearchContext = createContext<HeaderSearchContextValue | undefined>(undefined);

export function HeaderSearchProvider({ children }: { children: ReactNode }) {
  const [showSearch, setShowSearch] = useState(false);
  const [hasInputFocus, setHasInputFocus] = useState(false);

  const toggleSearch = useCallback(() => setShowSearch((prev) => !prev), []);
  const openSearch = useCallback(() => setShowSearch(true), []);
  const closeSearch = useCallback(() => setShowSearch(false), []);

  const activateFocus = useCallback(() => setHasInputFocus(true), []);
  const deactivateFocus = useCallback(() => setHasInputFocus(false), []);

  const activateSearch = useCallback(() => {
    openSearch();
    activateFocus();
  }, [openSearch, activateFocus]);

  const deactivateSearch = useCallback(() => {
    closeSearch();
    deactivateFocus();
  }, [closeSearch, deactivateFocus]);

  const value = useMemo(
    () => ({
      showSearch,
      setShowSearch,
      toggleSearch,
      openSearch,
      closeSearch,
      hasInputFocus,
      setHasInputFocus,
      activateFocus,
      deactivateFocus,
      activateSearch,
      deactivateSearch,
    }),
    [
      showSearch,
      hasInputFocus,
      toggleSearch,
      openSearch,
      closeSearch,
      activateFocus,
      deactivateFocus,
      activateSearch,
      deactivateSearch,
    ],
  );

  return <HeaderSearchContext.Provider value={value}>{children}</HeaderSearchContext.Provider>;
}

export function useHeaderSearch() {
  const ctx = useContext(HeaderSearchContext);
  if (!ctx) {
    throw new Error('useHeaderSearch must be used within a HeaderSearchProvider');
  }
  return ctx;
}
