'use client';

import { useRouter } from 'next/navigation';
import { PasswordResetDialog } from '@/components/password/password-reset-dialog';

export default function PasswordResetInterceptPage() {
  const router = useRouter();

  return <PasswordResetDialog open={true} onCloseAction={() => router.back()} />;
}
