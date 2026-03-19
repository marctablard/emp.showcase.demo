'use client';

import { useRouter } from 'next/navigation';
import { LoginDialog } from '@/components/login';

export default function LoginInterceptPage() {
  const router = useRouter();

  return <LoginDialog open={true} onCloseAction={() => router.back()} />;
}
