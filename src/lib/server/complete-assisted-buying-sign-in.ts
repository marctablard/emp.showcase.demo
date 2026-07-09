import { AuthError } from 'next-auth';
import { cookies } from 'next/headers';
import 'server-only';
import { signIn } from '@/auth/auth';
import {
  ASSISTED_BUYING_CREDENTIAL_FLAG,
  ASSISTED_BUYING_PENDING_COOKIE,
  ASSISTED_BUYING_PENDING_MAX_AGE_SECONDS,
  markAssistedBuyingSignInPending,
} from '@/lib/common/assisted-buying';

/**
 * Arms the assisted-buying NextAuth credentials flow (pending cookie + same-request memory flag).
 */
export async function armAssistedBuyingNextAuthSignIn(): Promise<void> {
  markAssistedBuyingSignInPending();
  const cookieStore = await cookies();
  cookieStore.set({
    name: ASSISTED_BUYING_PENDING_COOKIE,
    value: '1',
    maxAge: ASSISTED_BUYING_PENDING_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * Creates the NextAuth session after Emporix customer tokens are stored.
 * Must run in the same request that established the Emporix customer session.
 */
export async function completeAssistedBuyingSignIn(): Promise<{ success: boolean; error?: string }> {
  await armAssistedBuyingNextAuthSignIn();

  try {
    await signIn('credentials', {
      username: 'assisted-buying',
      password: '',
      assistedBuying: ASSISTED_BUYING_CREDENTIAL_FLAG,
      redirect: false,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
