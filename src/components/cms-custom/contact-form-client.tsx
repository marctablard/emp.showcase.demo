'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { H3 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import useCustomer from '@/hooks/customer/useCustomer';
import { submitFormSubmission } from '@/lib/client/form-submission';
import { cn } from '@/lib/utils';
import {
  type Alignment,
  type Density,
  type MaxWidth,
  type Tone,
  alignClass,
  densityClass,
  maxWidthClass,
  toneSurfaceClass,
} from './_shared/styles';

type Layout = 'stacked' | 'two-column';

type ContactFormProps = {
  headline?: string;
  body?: string;
  showSubject?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  showDescription?: boolean;
  subjectLabel?: string;
  emailLabel?: string;
  phoneLabel?: string;
  descriptionLabel?: string;
  subjectPlaceholder?: string;
  emailPlaceholder?: string;
  phonePlaceholder?: string;
  descriptionPlaceholder?: string;
  submitLabel?: string;
  successMessage?: string;
  alignment?: Alignment;
  layout?: Layout;
  maxWidth?: MaxWidth;
  density?: Density;
  tone?: Tone;
};

export default function ContactForm({
  headline,
  body,
  showSubject = true,
  showEmail = true,
  showPhone = true,
  showDescription = true,
  subjectLabel = 'Subject',
  emailLabel = 'Email',
  phoneLabel = 'Phone',
  descriptionLabel = 'Message',
  subjectPlaceholder = 'What is this regarding?',
  emailPlaceholder = 'you@example.com',
  phonePlaceholder = '+41 …',
  descriptionPlaceholder = 'Tell us more about your request…',
  submitLabel = 'Send',
  successMessage = 'Thank you — we received your message and will get back to you soon.',
  alignment = 'left',
  layout = 'stacked',
  maxWidth = 'content',
  density = 'comfortable',
  tone = 'default',
}: ContactFormProps) {
  const { customer } = useCustomer();
  const customerEmail = showEmail && customer?.email ? customer.email : '';
  const customerPhone = showPhone && customer?.contactPhone ? customer.contactPhone : '';

  const [subject, setSubject] = useState('');
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const email = emailDraft ?? customerEmail;
  const phone = phoneDraft ?? customerPhone;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage(null);

    try {
      await submitFormSubmission({
        formData: {
          ...(showSubject ? { subject: subject.trim() } : { subject: subject.trim() || 'Contact form' }),
          ...(showEmail && email.trim() ? { email: email.trim() } : {}),
          ...(showPhone && phone.trim() ? { phone: phone.trim() } : {}),
          ...(showDescription && description.trim() ? { description: description.trim() } : {}),
        },
      });
      setStatus('success');
      setSubject('');
      setEmailDraft(null);
      setPhoneDraft(null);
      setDescription('');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  const contactFields =
    showEmail || showPhone ? (
      <div
        className={cn(
          'grid w-full gap-4',
          layout === 'two-column' && showEmail && showPhone ? 'md:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {showEmail ? (
          <div className="grid gap-2">
            <Label htmlFor="cms-contact-email">{emailLabel}</Label>
            <Input
              id="cms-contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder={emailPlaceholder}
              autoComplete="email"
            />
          </div>
        ) : null}
        {showPhone ? (
          <div className="grid gap-2">
            <Label htmlFor="cms-contact-phone">{phoneLabel}</Label>
            <Input
              id="cms-contact-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhoneDraft(e.target.value)}
              placeholder={phonePlaceholder}
              autoComplete="tel"
            />
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <section data-cms="contact-form" data-tone={tone} className={cn('w-full', toneSurfaceClass(tone))}>
      <div
        className={cn(
          'mx-auto flex w-full flex-col gap-6 px-6 md:px-12',
          maxWidthClass(maxWidth),
          densityClass(density),
          alignClass(alignment),
        )}
      >
        {headline ? <H3>{headline}</H3> : null}
        {body ? <p className="max-w-prose text-base">{body}</p> : null}

        {status === 'success' ? (
          <p role="status" className="text-text-success">
            {successMessage}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col gap-4">
            {showSubject ? (
              <div className="grid gap-2">
                <Label htmlFor="cms-contact-subject">{subjectLabel}</Label>
                <Input
                  id="cms-contact-subject"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={subjectPlaceholder}
                />
              </div>
            ) : null}

            {contactFields}

            {showDescription ? (
              <div className="grid gap-2">
                <Label htmlFor="cms-contact-description">{descriptionLabel}</Label>
                <Textarea
                  id="cms-contact-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={descriptionPlaceholder}
                  rows={5}
                />
              </div>
            ) : null}

            <div
              className={cn(
                'flex',
                alignment === 'center' ? 'justify-center' : alignment === 'right' ? 'justify-end' : 'justify-start',
              )}
            >
              <Button type="submit" variant="primary" disabled={status === 'submitting'}>
                {status === 'submitting' ? '…' : submitLabel}
              </Button>
            </div>
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
