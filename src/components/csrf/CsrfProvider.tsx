'use client';

import { useEffect } from 'react';
import { setupCsrfFetch } from '@/lib/client/csrf-fetch';

/**
 * Client component that initializes CSRF protection
 * This component has no UI and should be included once at the app root
 */
export function CsrfProvider() {
  useEffect(() => {
    setupCsrfFetch();
  }, []);

  return null;
}
