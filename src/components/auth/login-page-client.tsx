'use client';

import { useEffect } from 'react';
import useAuthDialog from '@/hooks/authentication/useAuthDialog';

/**
 * Client component that handles opening the login dialog
 * This component is used in the server-side login page
 */
export default function LoginPageClient() {
  const { openDialog } = useAuthDialog();

  // Open the login dialog when the component mounts with additional options
  useEffect(() => {
    // Open login dialog with callbackUrl and redirectAfterLogin options
    openDialog('login', {
      callbackUrl: '/',
    });
  }, [openDialog]);

  // This component doesn't render anything visible
  return null;
}
