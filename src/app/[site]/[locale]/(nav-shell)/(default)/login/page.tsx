import { Suspense } from 'react';
import { LoginForm } from '@/components/login/login-form';
import { Card } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center py-10">
      <Card className="w-full max-w-150 p-6 relative">
        <Suspense fallback={<div></div>}>
          <LoginForm callbackUrl="/account" />
        </Suspense>
      </Card>
    </div>
  );
}
