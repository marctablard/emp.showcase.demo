'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LoginDialog } from '@/components/login';

function pathLeafSegment(pathname: string): string | undefined {
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

export default function LoginInterceptPage() {
  const router = useRouter();
  const pathname = usePathname() ?? '';

  const onLoginDialogClose = (): void => {
    if (pathLeafSegment(window.location.pathname) === 'login') {
      router.back();
    }
  };

  if (pathLeafSegment(pathname) !== 'login') {
    return null;
  }

  return <LoginDialog open={true} onCloseAction={onLoginDialogClose} />;
}
