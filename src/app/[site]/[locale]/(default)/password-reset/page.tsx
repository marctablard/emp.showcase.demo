'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { PasswordResetForm } from '@/components/password/password-reset-form';
import { Card } from '@/components/ui/card';

export default function PasswordResetPage() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center py-10">
      <Card className="w-full max-w-150 p-6">
        <Suspense fallback={<div></div>}>
          <PasswordResetForm onSuccess={() => router.push('/')} />
        </Suspense>
      </Card>
    </div>
  );
}
