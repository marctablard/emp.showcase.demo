'use client';

import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
import useAuthentication from '@/hooks/authentication/useAuthentication';
import { usePersistedState } from '@/hooks/common/usePersistedState';
import { AssistantPanelContext } from './assistant-panel-context';

/**
 * Open state of the AI agent side panel. The agent needs a signed-in customer, so the panel is
 * only available (and only reported open) while authenticated. Cmd/Ctrl+J toggles it.
 */
export function AssistantPanelProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthentication();
  const [requested, setRequested] = usePersistedState<boolean>({
    key: 'assistant-panel.open',
    defaultValue: false,
    storage: 'sessionStorage',
  });
  const open = isAuthenticated && requested;

  const setOpen = useCallback((next: boolean) => setRequested(next), [setRequested]);
  const toggle = useCallback(() => setRequested((current) => !current), [setRequested]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAuthenticated, toggle]);

  useEffect(() => {
    const root = document.documentElement;
    if (open) root.dataset.assistantOpen = '';
    else delete root.dataset.assistantOpen;
    return () => {
      delete root.dataset.assistantOpen;
    };
  }, [open]);

  const value = useMemo(
    () => ({ available: isAuthenticated, open, setOpen, toggle }),
    [isAuthenticated, open, setOpen, toggle],
  );

  return <AssistantPanelContext.Provider value={value}>{children}</AssistantPanelContext.Provider>;
}
