/**
 * @jest-environment jsdom
 */
import { useForm } from 'react-hook-form';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatInput } from './ChatInput';
import type { AiHelperFormData } from './types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const onSubmit = jest.fn();

const Harness = ({ loading }: { loading: boolean }) => {
  const form = useForm<AiHelperFormData>({ defaultValues: { question: 'draft' } });
  return <ChatInput form={form} onSubmit={onSubmit} loading={loading} isChatMode />;
};

describe('ChatInput', () => {
  beforeEach(() => {
    onSubmit.mockReset();
  });

  it('keeps the field editable and blocks send while waiting for a response', () => {
    render(<Harness loading />);

    const input = screen.getByRole('textbox');
    expect(input).not.toBeDisabled();
    fireEvent.change(input, { target: { value: 'next question' } });
    expect(input).toHaveValue('next question');

    const sendButton = screen.getByRole('button', { name: 'sending' });
    expect(sendButton).toBeDisabled();
    expect(sendButton.closest('form')?.parentElement).toHaveClass('cursor-progress');
    fireEvent.submit(sendButton.closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits when not waiting for a response', async () => {
    render(<Harness loading={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'sendButton' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ question: 'draft' });
    });
  });
});
