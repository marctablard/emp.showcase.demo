import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface SearchInputProps {
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

export function useSearchInput(initial = false) {
  const [showSearch, setShowSearch] = useState(initial);
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

  return {
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
  };
}
