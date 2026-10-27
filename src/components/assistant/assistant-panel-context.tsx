'use client';

import { createContext, useContext } from 'react';

export type AssistantPanelState = {
  available: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

export const AssistantPanelContext = createContext<AssistantPanelState>({
  available: false,
  open: false,
  setOpen: () => undefined,
  toggle: () => undefined,
});

export const useAssistantPanel = () => useContext(AssistantPanelContext);
