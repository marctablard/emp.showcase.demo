'use client';

import { useLayoutEffect } from 'react';

const GLOBAL_CURSOR_ATTRIBUTE = 'data-global-cursor';
const GLOBAL_CURSOR_STYLE_ID = 'global-cursor-style';

let waitCursorOwners = 0;
let navigationWaitCursorLease: GlobalCursorLease | null = null;

export interface GlobalCursorLease {
  release: () => void;
}

function ensureGlobalCursorStyle(): void {
  if (document.getElementById(GLOBAL_CURSOR_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = GLOBAL_CURSOR_STYLE_ID;
  style.textContent = `
    html[${GLOBAL_CURSOR_ATTRIBUTE}='wait'],
    html[${GLOBAL_CURSOR_ATTRIBUTE}='wait'] body,
    html[${GLOBAL_CURSOR_ATTRIBUTE}='wait'] body *,
    html[${GLOBAL_CURSOR_ATTRIBUTE}='wait'] * {
      cursor: wait !important;
    }
  `;
  document.head.appendChild(style);
}

function setWaitCursorActive(): void {
  ensureGlobalCursorStyle();
  document.documentElement.setAttribute(GLOBAL_CURSOR_ATTRIBUTE, 'wait');
}

function clearWaitCursor(): void {
  document.documentElement.removeAttribute(GLOBAL_CURSOR_ATTRIBUTE);
}

function releaseWaitCursorOwner(): void {
  waitCursorOwners = Math.max(0, waitCursorOwners - 1);
  if (waitCursorOwners === 0) {
    clearWaitCursor();
  }
}

export function acquireGlobalCursorLease(): GlobalCursorLease {
  waitCursorOwners += 1;
  setWaitCursorActive();

  let released = false;

  return {
    release: () => {
      if (released) {
        return;
      }

      released = true;
      releaseWaitCursorOwner();
    },
  };
}

export function acquireNavigationWaitCursorLease(): void {
  releaseNavigationWaitCursorLease();
  navigationWaitCursorLease = acquireGlobalCursorLease();
}

export function releaseNavigationWaitCursorLease(): void {
  navigationWaitCursorLease?.release();
  navigationWaitCursorLease = null;
}

export function useGlobalCursor(active: boolean): void {
  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    const lease = acquireGlobalCursorLease();

    return () => {
      lease.release();
    };
  }, [active]);
}
