'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { H3 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { type Alignment, type Tone, alignClass, toneSurfaceClass } from './_shared/styles';

type Layout = 'inline' | 'stacked';

type NewsletterSignupProps = {
  headline?: string;
  body?: string;
  placeholder?: string;
  submitLabel?: string;
  successMessage?: string;
  endpoint?: string;
  alignment?: Alignment;
  layout?: Layout;
  tone?: Tone;
};

export default function NewsletterSignup({
  headline,
  body,
  placeholder = 'you@example.com',
  submitLabel = 'Subscribe',
  successMessage = 'Thanks — please check your inbox.',
  endpoint,
  alignment = 'left',
  layout = 'inline',
  tone = 'default',
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setStatus('submitting');
    setErrorMessage(null);
    if (!endpoint) {
      setStatus('success');
      return;
    }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <section data-cms="newsletter-signup" data-tone={tone} className={cn('w-full', toneSurfaceClass(tone))}>
      <div className={cn('mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-10 md:px-12', alignClass(alignment))}>
        {headline ? <H3>{headline}</H3> : null}
        {body ? <p className="text-base">{body}</p> : null}
        {status === 'success' ? (
          <p role="status" className="text-text-success">
            {successMessage}
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className={cn('flex w-full gap-3', layout === 'stacked' ? 'flex-col' : 'flex-col sm:flex-row')}
          >
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={placeholder}
              className="flex-1"
            />
            <Button type="submit" variant="primary" disabled={status === 'submitting'}>
              {status === 'submitting' ? '…' : submitLabel}
            </Button>
          </form>
        )}
        {status === 'error' && errorMessage ? (
          <p role="alert" className="text-text-error">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
