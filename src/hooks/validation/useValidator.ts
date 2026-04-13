import { useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isEqual } from 'lodash';
import z from 'zod/v4';
import { getService } from '@/lib/client/service';
import { ValidationService } from '@/platform/services/validation';

/**
 * Hook for using a validation service with a React Hook Form instance
 * @param validatorId The DI identifier for the validator service
 * @param initialData Initial data for the form
 * @param mode Validation mode ('onBlur', 'onChange', 'onSubmit', or 'all'), defaults to 'onSubmit'
 * @param onValidated Optional callback function that is called when the form is successfully validated
 * @returns Object containing the form instance and validator service
 */
export function useValidator(
  validatorId: string,
  initialData: any,
  mode: 'onBlur' | 'onChange' | 'onSubmit' | 'all' = 'onSubmit',
  onValidated?: (data: any) => void,
) {
  const valuesRef = useRef(initialData);
  const onValidatedRef = useRef(onValidated);
  useEffect(() => {
    onValidatedRef.current = onValidated;
  }, [onValidated]);

  const validator = getService<ValidationService>(validatorId);
  const schema = validator.getSchema();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: initialData,
    mode: mode,
  });

  // Set up subscription once and clean it up properly
  useEffect(() => {
    const unsubscribe = form.subscribe({
      formState: { isValid: true, isValidating: true },
      callback: (formState) => {
        if (formState.isValid && !formState.isValidating && onValidatedRef.current) {
          const currentValues = form.getValues();
          if (isEqual(valuesRef.current, currentValues)) return;
          valuesRef.current = currentValues;
          // Defer the callback to a macrotask to avoid triggering state updates during render
          // (queueMicrotask is insufficient — microtasks still run within React's render batch)
          setTimeout(() => onValidatedRef.current?.(currentValues), 0);
        }
      },
    });

    return () => unsubscribe();
  }, [form]);

  const alignAfterExternalReset = useCallback(() => {
    valuesRef.current = form.getValues();
  }, [form]);

  return {
    form,
    validator,
    alignAfterExternalReset,
  };
}
