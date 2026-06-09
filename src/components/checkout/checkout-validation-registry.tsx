'use client';

import type { ReactNode, RefObject } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

/**
 * Coordinator for the independent `useForm` instances used by the checkout sub-forms
 * (contact data, addresses, shipping method, payment method, terms & conditions).
 *
 * Why a registry (instead of a single big form):
 * - Each existing sub-form already owns its own RHF instance via `useValidator(...)`.
 *   Rewriting them into one shared form would be a much bigger blast radius and would
 *   also lose the per-section `onValidated` callbacks that drive cart updates.
 * - Instead, every rendered sub-form registers its `UseFormReturn` + a root DOM ref
 *   with this provider. On Submit click, `validateAll()` runs `form.handleSubmit(...)`
 *   on each registered form (so `isSubmitted` flips → RHF default
 *   `reValidateMode: 'onChange'` clears errors as the user types), collects the
 *   invalid ones, and exposes a DOM-ordered first-invalid handle for scroll/focus.
 * - Collapsed sections register an "expander" callback via `useRegisterSectionExpander`.
 *   `validateAll()` runs every expander first so hidden forms mount before validation.
 *
 * The provider keeps state entirely in refs so registering a new form does not
 * re-render existing forms.
 */

export interface CheckoutFormHandle<TValues extends FieldValues = FieldValues> {
  readonly form: UseFormReturn<TValues>;
  readonly rootRef: RefObject<HTMLElement | null>;
  readonly sectionId?: string;
  readonly testIdPrefix?: string;
}

export interface ValidateAllResult {
  readonly valid: boolean;
  readonly firstInvalid?: CheckoutFormHandle;
  readonly invalidHandles: CheckoutFormHandle[];
}

interface CheckoutValidationContextValue {
  registerForm: (id: string, handle: CheckoutFormHandle) => () => void;
  registerSectionExpander: (id: string, expand: () => void) => () => void;
  validateAll: () => Promise<ValidateAllResult>;
}

const CheckoutValidationContext = createContext<CheckoutValidationContextValue | null>(null);

interface CheckoutValidationProviderProps {
  children: ReactNode;
}

export function CheckoutValidationProvider({ children }: CheckoutValidationProviderProps) {
  const formsRef = useRef<Map<string, CheckoutFormHandle>>(new Map());
  const expandersRef = useRef<Map<string, () => void>>(new Map());

  const registerForm = useCallback((id: string, handle: CheckoutFormHandle) => {
    formsRef.current.set(id, handle);
    return () => {
      const current = formsRef.current.get(id);
      if (current === handle) {
        formsRef.current.delete(id);
      }
    };
  }, []);

  const registerSectionExpander = useCallback((id: string, expand: () => void) => {
    expandersRef.current.set(id, expand);
    return () => {
      const current = expandersRef.current.get(id);
      if (current === expand) {
        expandersRef.current.delete(id);
      }
    };
  }, []);

  const validateAll = useCallback(async (): Promise<ValidateAllResult> => {
    for (const expand of expandersRef.current.values()) {
      try {
        expand();
      } catch {
        // Section expanders are best-effort; a throwing one should not block other sections.
      }
    }

    // Wait one frame so newly-mounted sub-forms have a chance to run their
    // `useRegisterCheckoutForm` effects before we read the registry.
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });

    const handles = Array.from(formsRef.current.values());

    const outcomes = await Promise.all(
      handles.map(
        (handle) =>
          new Promise<{ handle: CheckoutFormHandle; valid: boolean }>((resolve) => {
            const onValid = () => {
              resolve({ handle, valid: true });
            };
            const onInvalid = () => {
              resolve({ handle, valid: false });
            };
            try {
              handle.form.handleSubmit(onValid, onInvalid)();
            } catch {
              resolve({ handle, valid: false });
            }
          }),
      ),
    );

    const invalidHandles = outcomes.filter((outcome) => !outcome.valid).map((outcome) => outcome.handle);

    const firstInvalid = pickFirstInvalidByDomOrder(invalidHandles);

    return {
      valid: invalidHandles.length === 0,
      firstInvalid,
      invalidHandles,
    };
  }, []);

  const value = useMemo<CheckoutValidationContextValue>(
    () => ({ registerForm, registerSectionExpander, validateAll }),
    [registerForm, registerSectionExpander, validateAll],
  );

  return <CheckoutValidationContext.Provider value={value}>{children}</CheckoutValidationContext.Provider>;
}

export function useCheckoutValidation(): CheckoutValidationContextValue {
  const ctx = useContext(CheckoutValidationContext);
  if (!ctx) {
    throw new Error('useCheckoutValidation must be used within a <CheckoutValidationProvider>');
  }
  return ctx;
}

/**
 * Register a sub-form's RHF instance with the checkout validation registry.
 *
 * Safe to call from components that may render outside a `<CheckoutValidationProvider>`
 * (e.g. `AddressForm` is reused in `/account/addresses/*`): the hook no-ops when the
 * provider is absent.
 */
export function useRegisterCheckoutForm<TValues extends FieldValues>(
  id: string,
  form: UseFormReturn<TValues>,
  rootRef: RefObject<HTMLElement | null>,
  options?: { sectionId?: string; testIdPrefix?: string },
): void {
  const ctx = useContext(CheckoutValidationContext);
  const sectionId = options?.sectionId;
  const testIdPrefix = options?.testIdPrefix;

  useEffect(() => {
    if (!ctx) {
      return;
    }
    const handle: CheckoutFormHandle = {
      form: form as unknown as UseFormReturn<FieldValues>,
      rootRef,
      sectionId,
      testIdPrefix,
    };
    return ctx.registerForm(id, handle);
  }, [ctx, id, form, rootRef, sectionId, testIdPrefix]);
}

/**
 * Register a callback that expands a collapsed checkout section (e.g. flips
 * `isShippingEdit` to `true`). `validateAll()` runs every registered expander before
 * triggering form validation so hidden forms get mounted and validated.
 */
export function useRegisterSectionExpander(id: string, expand: () => void): void {
  const ctx = useContext(CheckoutValidationContext);
  const expandRef = useRef(expand);
  useEffect(() => {
    expandRef.current = expand;
  }, [expand]);

  useEffect(() => {
    if (!ctx) {
      return;
    }
    return ctx.registerSectionExpander(id, () => expandRef.current());
  }, [ctx, id]);
}

/**
 * Scroll the first invalid field within `handle.rootRef` into view and focus it.
 *
 * Lookup order for the field DOM node:
 *   1. `[data-testid="{testIdPrefix}-{fieldName}"]` when a prefix is registered.
 *   2. `[name="{fieldName}"]`
 *   3. `#{fieldName}`
 *
 * If none of those resolve, falls back to focusing the registered `rootRef` node so
 * keyboard users are still moved into the failing section.
 */
export function focusFirstInvalid(handle: CheckoutFormHandle | undefined): void {
  if (!handle) return;
  const root = handle.rootRef.current;
  if (!root) return;

  const errors = handle.form.formState.errors;
  const fieldName = findFirstErrorFieldName(errors);

  const candidates: string[] = [];
  if (fieldName) {
    if (handle.testIdPrefix) {
      candidates.push(`[data-testid="${handle.testIdPrefix}-${cssEscape(fieldName)}"]`);
    }
    candidates.push(`[name="${cssEscape(fieldName)}"]`);
    candidates.push(`#${cssEscape(fieldName)}`);
  }

  let target: HTMLElement | null = null;
  for (const selector of candidates) {
    const node = root.querySelector<HTMLElement>(selector);
    if (node) {
      target = node;
      break;
    }
  }

  if (!target) {
    target = root instanceof HTMLElement ? root : null;
  }

  if (!target) return;

  const runFocus = () => {
    try {
      target!.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      // jsdom / older browsers may not implement scrollIntoView with options
    }
    try {
      target!.focus({ preventScroll: true });
    } catch {
      try {
        target!.focus();
      } catch {
        // Element may not be focusable; nothing useful to do.
      }
    }
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(runFocus);
  } else {
    runFocus();
  }
}

function pickFirstInvalidByDomOrder(handles: CheckoutFormHandle[]): CheckoutFormHandle | undefined {
  if (handles.length === 0) return undefined;
  if (handles.length === 1) return handles[0];

  const withNodes = handles
    .map((handle) => ({ handle, node: handle.rootRef.current }))
    .filter((entry): entry is { handle: CheckoutFormHandle; node: HTMLElement } => entry.node instanceof HTMLElement);

  if (withNodes.length === 0) return handles[0];

  const sorted = [...withNodes].sort((a, b) => {
    const relation = a.node.compareDocumentPosition(b.node);
    if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  return sorted[0]?.handle ?? handles[0];
}

function findFirstErrorFieldName(errors: Record<string, unknown>): string | undefined {
  for (const key of Object.keys(errors)) {
    const value = errors[key];
    if (value && typeof value === 'object') {
      return key;
    }
  }
  return undefined;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}
