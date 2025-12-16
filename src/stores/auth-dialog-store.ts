'use client';

import { create } from 'zustand';

export type DialogType = 'login' | 'reset' | null;

export interface DialogOptions {
  callbackUrl?: string;
  email?: string;
  guestCheckout?: boolean;
}

export interface AuthDialogState {
  // State
  activeDialog: DialogType;
  dialogOptions: DialogOptions;
}

export interface AuthDialogActions {
  // Actions
  setActiveDialog: (dialog: DialogType) => void;
  setDialogOptions: (options: DialogOptions) => void;
  getDialogOptions: () => DialogOptions;
}

export type AuthDialogStore = AuthDialogState & AuthDialogActions;

// Default state
const defaultState: AuthDialogState = {
  activeDialog: null,
  dialogOptions: {},
};

/**
 * Creates an auth dialog store with the given initial state
 * @param initState Initial state for the store
 * @returns Zustand store for auth dialogs
 */
export const createAuthDialogStore = (initState: AuthDialogState = defaultState) => {
  return create<AuthDialogStore>()((set, get) => ({
    ...initState,
    setActiveDialog: (dialog: DialogType) => set({ activeDialog: dialog }),
    setDialogOptions: (options: DialogOptions) => set({ dialogOptions: options }),
    getDialogOptions: () => get().dialogOptions,
  }));
};

// Create the singleton instance of the store
export const authDialogStore = createAuthDialogStore();
