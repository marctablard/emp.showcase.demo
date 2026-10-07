/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { CompanySwitcher } from './header-company-switcher';

const setCompany = jest.fn();
const refresh = jest.fn();
const toast = jest.fn();

let session: { customerId?: string; legalEntityId?: string } | null = {
  customerId: '79628874',
};

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => ({
    session,
    loading: false,
    setCompany,
  }),
}));

jest.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ toast }),
}));

const companies = [
  { id: 'le-1', name: 'The LA La Ride' },
  { id: 'le-2', name: 'Darina Company LTD' },
];

describe('CompanySwitcher', () => {
  beforeEach(() => {
    setCompany.mockReset();
    refresh.mockReset();
    toast.mockReset();
    session = { customerId: '79628874' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => companies,
    }) as unknown as typeof fetch;
  });

  it('writes the first assigned company onto the session before showing its name', async () => {
    setCompany.mockResolvedValue(true);
    render(<CompanySwitcher />);

    await waitFor(() => {
      expect(setCompany).toHaveBeenCalledWith('le-1');
    });
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText('The LA La Ride')).not.toBeInTheDocument();
  });

  it('shows the session company and does not write it again', async () => {
    session = { customerId: '79628874', legalEntityId: 'le-2' };
    render(<CompanySwitcher />);

    expect(await screen.findByText('Darina Company LTD')).toBeInTheDocument();
    expect(setCompany).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
