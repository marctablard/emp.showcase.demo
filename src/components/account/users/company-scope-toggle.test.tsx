/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { CompanyScopeToggle } from './company-scope-toggle';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('CompanyScopeToggle', () => {
  it('selects the current company and calls back when All companies is chosen', () => {
    const onShowAllCompaniesChange = jest.fn();
    render(
      <CompanyScopeToggle
        currentCompanyName="NovaTech Nord"
        showAllCompanies={false}
        onShowAllCompaniesChange={onShowAllCompaniesChange}
      />,
    );

    expect(screen.getByRole('radiogroup', { name: 'companyScope' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'NovaTech Nord' })).toBeChecked();
    expect(screen.getByText('NovaTech Nord')).toHaveAttribute('title', 'NovaTech Nord');
    expect(screen.getByRole('radio', { name: 'allCompanies' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: 'allCompanies' }));
    expect(onShowAllCompaniesChange).toHaveBeenCalledWith(true);
  });

  it('falls back to the currentCompany label when the company name is missing', () => {
    render(<CompanyScopeToggle showAllCompanies onShowAllCompaniesChange={jest.fn()} />);

    expect(screen.getByRole('radio', { name: 'currentCompany' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'allCompanies' })).toBeChecked();
  });
});
