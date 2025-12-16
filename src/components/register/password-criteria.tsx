'use client';

import { useMemo } from 'react';
import { useFormState, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Check, CircleAlert, Dot } from 'lucide-react';

interface PasswordCriteriaProps {
  control: any;
  passwordField: string;
}

type CriteriaState = {
  minLength: boolean | null;
  uppercase: boolean | null;
  lowercase: boolean | null;
  number: boolean | null;
};

export function PasswordCriteria({ control, passwordField }: PasswordCriteriaProps) {
  const t = useTranslations('auth.register.passwordCriteria');
  const password = useWatch({
    control,
    name: passwordField,
  });

  const { touchedFields, dirtyFields } = useFormState({ control });

  const isFieldTouched = touchedFields[passwordField];
  const isFieldDirty = dirtyFields[passwordField];

  const criteria = useMemo<CriteriaState>(() => {
    if (password) {
      return {
        minLength: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[\d]/.test(password),
      };
    }

    if (isFieldTouched || isFieldDirty) {
      return {
        minLength: false,
        uppercase: false,
        lowercase: false,
        number: false,
      };
    }

    return {
      minLength: null,
      uppercase: null,
      lowercase: null,
      number: null,
    };
  }, [password, isFieldTouched, isFieldDirty]);

  return (
    <ul className="space-y-2 text-sm">
      <li className="flex items-center gap-1">
        {criteria.minLength === null ? (
          <Dot className="h-4 w-4" />
        ) : criteria.minLength ? (
          <Check className="h-4 w-4 text-icon-success" />
        ) : (
          <CircleAlert className="h-4 w-4 text-icon-error" />
        )}
        <span
          className={criteria.minLength === null ? '' : criteria.minLength ? 'text-text-success' : 'text-text-error'}
        >
          {t('minLength')}
        </span>
      </li>
      <li className="flex items-center gap-1">
        {criteria.uppercase === null ? (
          <Dot className="h-4 w-4" />
        ) : criteria.uppercase ? (
          <Check className="h-4 w-4 text-icon-success" />
        ) : (
          <CircleAlert className="h-4 w-4 text-icon-error" />
        )}
        <span
          className={criteria.uppercase === null ? '' : criteria.uppercase ? 'text-text-success' : 'text-text-error'}
        >
          {t('uppercase')}
        </span>
      </li>
      <li className="flex items-center gap-1">
        {criteria.lowercase === null ? (
          <Dot className="h-4 w-4" />
        ) : criteria.lowercase ? (
          <Check className="h-4 w-4 text-icon-success" />
        ) : (
          <CircleAlert className="h-4 w-4 text-icon-error" />
        )}
        <span
          className={criteria.lowercase === null ? '' : criteria.lowercase ? 'text-text-success' : 'text-text-error'}
        >
          {t('lowercase')}
        </span>
      </li>
      <li className="flex items-center gap-1">
        {criteria.number === null ? (
          <Dot className="h-4 w-4" />
        ) : criteria.number ? (
          <Check className="h-4 w-4 text-icon-success" />
        ) : (
          <CircleAlert className="h-4 w-4 text-icon-error" />
        )}
        <span className={criteria.number === null ? '' : criteria.number ? 'text-text-success' : 'text-text-error'}>
          {t('number')}
        </span>
      </li>
    </ul>
  );
}
