'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoginDialog } from '@/components/login';

function pathLeafSegment(pathname: string): string | undefined {
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

export default function LoginInterceptPage() {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(true);

  // Close the dialog through local state so it always dismisses — on the X button
  // or a successful login — even when the underlying page (e.g. /browse) has synced
  // its own URL and left this intercepting slot out of sync with window.location.
  // Relying solely on router.back() gated on the live pathname could leave the
  // dialog stuck open with no way to close. After dismissing, pop the intercepted
  // /login history entry only when it is still the current URL, so the user returns
  // to the page they opened login from.
  const closeDialog = (): void => {
    setOpen(false);
    if (pathLeafSegment(window.location.pathname) === 'login') {
      router.back();
    }
  };

  if (pathLeafSegment(pathname) !== 'login') {
    return null;
  }

  return <LoginDialog open={open} onCloseAction={closeDialog} onLoginSuccess={closeDialog} />;
}
