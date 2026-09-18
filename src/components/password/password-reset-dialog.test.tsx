/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { z } from 'zod/v4';
import { notify } from '@/components/ui/toast-notification';
import { PasswordResetDialog } from './password-reset-dialog';

jest.mock('next-intl', () => ({
  useTranslations: () => Object.assign((k: string) => k, { rich: (k: string) => k }),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

// PasswordResetForm renders a UiLink("Link") back to /login — no callback, no router.push
// (the auth flow moved to the @dialog/(.)login intercepting route in 1.8.0).
jest.mock('@/i18n/navigation', () => ({
  __esModule: true,
  Link: ({ children, replace: _replace, ...p }: { children: React.ReactNode; replace?: boolean }) => (
    <a {...p}>{children}</a>
  ),
}));

jest.mock('@/components/ui/toast-notification', () => ({
  __esModule: true,
  notify: jest.fn(),
  ToastType: { Success: 'success', Error: 'error', Warning: 'warning', Info: 'info' },
}));

// useValidator resolves its schema from the static client validator registry via getValidator
// (src/lib/client/validation-registry.ts) — the DI client container is gone in 1.8.0.
// Mirrors PasswordResetSchema.
jest.mock('@/lib/client/validation-registry', () => ({
  getValidator: () => ({
    getSchema: () => z.object({ email: z.string().min(1).email() }),
    validate: jest.fn(),
  }),
}));

const mockNotify = notify as jest.Mock;

const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  window.history.pushState({}, '', '/');
});

describe('PasswordResetDialog', () => {
  it('renders the dialog contents when open, with a disabled submit for an empty email', () => {
    render(<PasswordResetDialog open />);
    expect(screen.getByText('resetPassword')).toBeInTheDocument();
    expect(screen.getByText('resetPasswordDescription')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('email@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sendResetLink' })).toBeDisabled();
  });

  it('renders the trigger and keeps the dialog closed by default', () => {
    render(<PasswordResetDialog trigger={<button>open me</button>} />);
    expect(screen.getByText('open me')).toBeInTheDocument();
    // default open=false -> dialog content (heading) not rendered
    expect(screen.queryByText('resetPassword')).not.toBeInTheDocument();
  });

  it('submits the reset request, notifies and calls onCloseAction once the email is valid', async () => {
    // In 1.8.0 the dialog no longer routes success through an onBackToLoginAction(email)
    // callback: PasswordResetForm's onSuccess is wired straight to onCloseAction (the
    // password-reset dialog is its own @dialog/(.)password-reset intercepting route now,
    // it no longer sits on top of /login), so closing is all the parent is told.
    const onClose = jest.fn();
    render(<PasswordResetDialog open onCloseAction={onClose} />);

    const input = screen.getByPlaceholderText('email@example.com');
    fireEvent.change(input, { target: { value: 'ada@example.com' } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'sendResetLink' })).toBeEnabled());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'sendResetLink' }));
      await flush();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/password-reset',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'ada@example.com' }) }),
    );
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ title: 'resetEmailSent', type: 'success' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the processing state while the reset request is in flight', async () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<PasswordResetDialog open />);

    const input = screen.getByPlaceholderText('email@example.com');
    fireEvent.change(input, { target: { value: 'ada@example.com' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'sendResetLink' })).toBeEnabled());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'sendResetLink' }));
      await flush();
    });

    expect(screen.getByText('processing')).toBeInTheDocument();
  });

  it('links back to /login with the current seeded email, instead of an onBackToLoginAction callback', async () => {
    // 1.8.0 replaced the callback with plain navigation: the form renders a UiLink("Link")
    // to /login?email=... (picked up by /login's own intercepting-route dialog), it no
    // longer calls back into the parent with the email.
    // The mount effect resets the form with the seeded email, which runs RHF's
    // async validation (flipping isValid) — settle that inside act().
    await act(async () => {
      render(<PasswordResetDialog open email="seed@example.com" />);
    });
    expect(screen.getByText('backToLogin')).toHaveAttribute(
      'href',
      expect.stringContaining(`email=${encodeURIComponent('seed@example.com')}`),
    );
  });

  it('calls onCloseAction when the dialog is closed, whether on /login or elsewhere', async () => {
    // handleOpenChange no longer special-cases the /login path with a router.push('/'):
    // the password-reset dialog is its own @dialog/(.)password-reset route now and is
    // never rendered together with /login, so that redirect-on-close case is moot.
    for (const path of ['/login', '/']) {
      window.history.pushState({}, '', path);
      const onClose = jest.fn();
      const { unmount } = render(<PasswordResetDialog open onCloseAction={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'close' }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      unmount();
    }
  });
});
