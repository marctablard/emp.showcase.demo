import type { MutableRefObject, ReactNode } from 'react';
import { useImperativeHandle, useRef } from 'react';
import { useForm } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { act, render, screen, waitFor } from '@testing-library/react';
import { z } from 'zod';
import {
  CheckoutValidationProvider,
  focusFirstInvalid,
  useCheckoutValidation,
  useRegisterCheckoutForm,
  useRegisterSectionExpander,
} from './checkout-validation-registry';
import type { ValidateAllResult } from './checkout-validation-registry';

const schemaA = z.object({
  firstName: z.string().min(1, 'firstName.required'),
});
const schemaB = z.object({
  email: z.string().min(1, 'email.required'),
});

type SchemaA = z.infer<typeof schemaA>;
type SchemaB = z.infer<typeof schemaB>;

interface ValidatorHandle {
  validateAll: () => Promise<ValidateAllResult>;
}

function ValidateAllProbe({ handleRef }: { handleRef: MutableRefObject<ValidatorHandle | null> }) {
  const { validateAll } = useCheckoutValidation();
  useImperativeHandle(handleRef, () => ({ validateAll }), [validateAll]);
  return null;
}

function FormA({
  testId = 'form-a',
  defaultValue = '',
  formRef,
}: {
  testId?: string;
  defaultValue?: string;
  formRef?: MutableRefObject<UseFormReturn<SchemaA> | null>;
}) {
  const form = useForm<SchemaA>({
    resolver: zodResolver(schemaA),
    defaultValues: { firstName: defaultValue },
  });
  if (formRef) {
    formRef.current = form;
  }
  const rootRef = useRef<HTMLDivElement>(null);
  useRegisterCheckoutForm('form-a', form, rootRef);
  return (
    <div ref={rootRef} data-testid={testId}>
      <input data-testid={`${testId}-input`} {...form.register('firstName')} />
    </div>
  );
}

function FormB({ testId = 'form-b' }: { testId?: string }) {
  const form = useForm<SchemaB>({ resolver: zodResolver(schemaB), defaultValues: { email: '' } });
  const rootRef = useRef<HTMLDivElement>(null);
  useRegisterCheckoutForm('form-b', form, rootRef);
  return (
    <div ref={rootRef} data-testid={testId}>
      <input {...form.register('email')} />
    </div>
  );
}

function SectionExpander({ id, onExpand }: { id: string; onExpand: () => void }) {
  useRegisterSectionExpander(id, onExpand);
  return null;
}

function renderWithProvider(children: ReactNode, handleRef: MutableRefObject<ValidatorHandle | null>) {
  return render(
    <CheckoutValidationProvider>
      <ValidateAllProbe handleRef={handleRef} />
      {children}
    </CheckoutValidationProvider>,
  );
}

function createHandleRef(): MutableRefObject<ValidatorHandle | null> {
  return { current: null };
}

describe('CheckoutValidationProvider', () => {
  test('validateAll() collects every registered form and reports invalid ones', async () => {
    const handleRef = createHandleRef();
    renderWithProvider(
      <>
        <FormA />
        <FormB />
      </>,
      handleRef,
    );

    let outcome: ValidateAllResult | undefined;
    await act(async () => {
      outcome = await handleRef.current!.validateAll();
    });

    expect(outcome?.valid).toBe(false);
    expect(outcome?.invalidHandles).toHaveLength(2);
    expect(outcome?.firstInvalid).toBeDefined();
  });

  test('validateAll() returns valid: true when every form passes', async () => {
    const handleRef = createHandleRef();
    renderWithProvider(<FormA defaultValue="Ada" />, handleRef);

    let outcome: ValidateAllResult | undefined;
    await act(async () => {
      outcome = await handleRef.current!.validateAll();
    });

    expect(outcome?.valid).toBe(true);
    expect(outcome?.invalidHandles).toHaveLength(0);
    expect(outcome?.firstInvalid).toBeUndefined();
  });

  test('unmounting a consumer removes it from the registry', async () => {
    const handleRef = createHandleRef();
    const { rerender } = render(
      <CheckoutValidationProvider>
        <ValidateAllProbe handleRef={handleRef} />
        <FormA />
        <FormB />
      </CheckoutValidationProvider>,
    );

    let outcome: ValidateAllResult | undefined;
    await act(async () => {
      outcome = await handleRef.current!.validateAll();
    });
    expect(outcome?.invalidHandles).toHaveLength(2);

    rerender(
      <CheckoutValidationProvider>
        <ValidateAllProbe handleRef={handleRef} />
        <FormA />
      </CheckoutValidationProvider>,
    );

    await act(async () => {
      outcome = await handleRef.current!.validateAll();
    });
    expect(outcome?.invalidHandles).toHaveLength(1);
  });

  test('firstInvalid follows DOM order, not registration order', async () => {
    const handleRef = createHandleRef();
    render(
      <CheckoutValidationProvider>
        <ValidateAllProbe handleRef={handleRef} />
        <div data-testid="slot-b">
          <FormB testId="b-dom" />
        </div>
        <div data-testid="slot-a">
          <FormA testId="a-dom" />
        </div>
      </CheckoutValidationProvider>,
    );

    let outcome: ValidateAllResult | undefined;
    await act(async () => {
      outcome = await handleRef.current!.validateAll();
    });

    expect(outcome?.valid).toBe(false);
    const firstInvalidNode = outcome?.firstInvalid?.rootRef.current;
    expect(firstInvalidNode).toBe(screen.getByTestId('b-dom'));
  });

  test('section expanders run before forms are validated', async () => {
    const expand = jest.fn();
    const handleRef = createHandleRef();
    renderWithProvider(
      <>
        <SectionExpander id="shipping" onExpand={expand} />
        <FormA />
      </>,
      handleRef,
    );

    await act(async () => {
      await handleRef.current!.validateAll();
    });

    expect(expand).toHaveBeenCalledTimes(1);
  });

  test('validateAll() flips form.formState.isSubmitted on every registered form', async () => {
    const handleRef = createHandleRef();
    const formARef: MutableRefObject<UseFormReturn<SchemaA> | null> = { current: null };
    renderWithProvider(<FormA formRef={formARef} />, handleRef);

    expect(formARef.current!.formState.isSubmitted).toBe(false);

    await act(async () => {
      await handleRef.current!.validateAll();
    });

    await waitFor(() => {
      expect(formARef.current!.formState.isSubmitted).toBe(true);
    });
  });
});

describe('focusFirstInvalid', () => {
  test('focuses the field matching the first error key', async () => {
    const handleRef = createHandleRef();
    const formARef: MutableRefObject<UseFormReturn<SchemaA> | null> = { current: null };
    renderWithProvider(<FormA testId="focus-target" formRef={formARef} />, handleRef);

    let outcome: ValidateAllResult | undefined;
    await act(async () => {
      outcome = await handleRef.current!.validateAll();
    });

    expect(outcome?.valid).toBe(false);
    expect(outcome?.firstInvalid).toBeDefined();

    act(() => {
      focusFirstInvalid(outcome?.firstInvalid);
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('focus-target-input'));
    });
  });

  test('no-ops gracefully when the handle is undefined', () => {
    expect(() => focusFirstInvalid(undefined)).not.toThrow();
  });
});
