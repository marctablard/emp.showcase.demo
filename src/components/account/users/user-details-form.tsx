'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { H1, H4 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/hooks/session/useSession';
import { useValidator } from '@/hooks/validation/useValidator';
import { useRouter } from '@/i18n/navigation';
import { createCompanyUser, fetchAssignableCompanyUserGroups, updateCompanyUser } from '@/lib/client/user-management';
import type { CompanyUserFormData } from '@/lib/validation/form-schemas';
import type {
  AssignableLegalEntityGroups,
  CompanyUser,
  CompanyUserGroupAssignment,
} from '@/platform/services/model/user-management/company-user';
import { CONTACT_ONLY_GROUP_ID } from '@/platform/services/model/user-management/contact-only';

const TITLE_KEYS = ['MR', 'MRS', 'MS'] as const;
const NO_SELECTION = '__none__';
const SAME_COMPANY_REQUIRED_ERROR = 'Customer can only assign new customer to the same company';
const PREDEFINED_GROUP_CONFLICT_CODE = 'PREDEFINED_GROUP_CONFLICT';
const PREDEFINED_GROUP_ROLE_NAMES = ['admin', 'buyer', 'requestor', 'requester'];

const VALIDATION_I18N_KEYS = {
  'user-management.validation.firstNameRequired': 'validation.firstNameRequired',
  'user-management.validation.lastNameRequired': 'validation.lastNameRequired',
  'user-management.validation.emailRequired': 'validation.emailRequired',
  'user-management.validation.emailInvalid': 'validation.emailInvalid',
  'user-management.validation.phoneInvalid': 'validation.phoneInvalid',
  'user-management.validation.requiredGroup': 'validation.requiredGroup',
} as const;

type ZodValidationMessage = keyof typeof VALIDATION_I18N_KEYS;
type UserManagementTranslate = ReturnType<typeof useTranslations<'user-management'>>;

function isZodValidationMessage(message: string): message is ZodValidationMessage {
  return message in VALIDATION_I18N_KEYS;
}

function isContactGroupDisplayName(displayName: string): boolean {
  const normalizedDisplayName = displayName.trim().toLowerCase();
  return normalizedDisplayName.endsWith('contact') || normalizedDisplayName.includes(' - contact');
}

function toSelectableCatalogGroups(
  groups: AssignableLegalEntityGroups['groups'],
): AssignableLegalEntityGroups['groups'] {
  return groups.filter((group) => !isContactGroupDisplayName(group.displayName));
}

function toPickerGroupId(group: AssignableLegalEntityGroups['groups'][number]): string {
  return isContactGroupDisplayName(group.displayName) ? CONTACT_ONLY_GROUP_ID : group.id;
}

function getCompanyUserErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const maybeErrorWithCode = error as Error & { code?: string };
  return maybeErrorWithCode.code;
}

function getSubmitErrorTitle(error: unknown, isEdit: boolean, translate: UserManagementTranslate): string {
  const errorCode = getCompanyUserErrorCode(error);
  if (errorCode === PREDEFINED_GROUP_CONFLICT_CODE) {
    return translate('notifications.predefinedGroupConflict');
  }
  if (isEdit) {
    return translate('notifications.saveError');
  }
  if (error instanceof Error && error.message === SAME_COMPANY_REQUIRED_ERROR) {
    return SAME_COMPANY_REQUIRED_ERROR;
  }
  return translate('notifications.genericFailure');
}

function getUpdateSuccessTitle(
  nextActive: boolean,
  initialActive: boolean,
  translate: UserManagementTranslate,
): string {
  return nextActive !== initialActive
    ? translate('notifications.statusSuccess')
    : translate('notifications.saveSuccess');
}

function toProfileRequest(data: CompanyUserFormData) {
  return {
    title: data.title || undefined,
    firstName: data.firstName,
    lastName: data.lastName,
    contactEmail: data.email,
    contactPhone: data.phone || undefined,
    active: data.active,
  };
}

function selectedLegalEntityAssignment(data: CompanyUserFormData): CompanyUserGroupAssignment | undefined {
  return data.groupAssignments.find((assignment) => assignment.legalEntityId === data.selectedLegalEntityId);
}

export interface HeaderCompany {
  id: string;
  name: string;
}

export interface OtherHeaderCompanyGroupSection {
  legalEntityId: string;
  companyName: string;
  groups: Array<{ id: string; displayName: string }>;
}

interface UserDetailsFormProps {
  initialUser?: CompanyUser;
  headerCompanies?: ReadonlyArray<HeaderCompany>;
}

function normalizeTitle(title?: string): CompanyUserFormData['title'] {
  return TITLE_KEYS.includes(title as (typeof TITLE_KEYS)[number]) ? (title as (typeof TITLE_KEYS)[number]) : '';
}

function fieldErrorId(field: string): string {
  return `company-user-${field}-error`;
}

function reconcileInitialGroupAssignment(
  assignedGroups: CompanyUser['groups'],
  legalEntityGroups: AssignableLegalEntityGroups,
): CompanyUserGroupAssignment[] {
  const selectedLegalEntityAssignments = assignedGroups.filter(
    (assigned) => assigned.legalEntityId === legalEntityGroups.legalEntityId,
  );
  if (selectedLegalEntityAssignments.length === 0) return [];

  const preferredRolePriority = (displayName: string): number => {
    const normalizedDisplayName = displayName.trim().toLowerCase();
    if (normalizedDisplayName.endsWith('contact') || normalizedDisplayName.includes(' - contact')) return 1;
    if (PREDEFINED_GROUP_ROLE_NAMES.some((role) => normalizedDisplayName.endsWith(role))) return 0;
    return 2;
  };

  const choosePreferredGroup = (
    options: AssignableLegalEntityGroups['groups'],
  ): AssignableLegalEntityGroups['groups'][number] | undefined =>
    [...options].sort(
      (left, right) => preferredRolePriority(left.displayName) - preferredRolePriority(right.displayName),
    )[0];

  const matchedById = selectedLegalEntityAssignments
    .map((assigned) => legalEntityGroups.groups.find((option) => option.id === assigned.id))
    .filter((group): group is AssignableLegalEntityGroups['groups'][number] => Boolean(group));
  const preferredById = choosePreferredGroup(matchedById);
  if (preferredById) {
    return [{ legalEntityId: legalEntityGroups.legalEntityId, groupId: toPickerGroupId(preferredById) }];
  }

  const matchedByName = selectedLegalEntityAssignments
    .map((assigned) => legalEntityGroups.groups.find((option) => option.displayName === assigned.displayName))
    .filter((group): group is AssignableLegalEntityGroups['groups'][number] => Boolean(group));
  const preferredByName = choosePreferredGroup(matchedByName);

  return preferredByName
    ? [{ legalEntityId: legalEntityGroups.legalEntityId, groupId: toPickerGroupId(preferredByName) }]
    : [];
}

function groupAssignmentKey(assignment: CompanyUserGroupAssignment): string {
  return `${assignment.legalEntityId}:${assignment.groupId}`;
}

function resolveInitialGroupAssignments(
  initialUser: CompanyUser,
  legalEntityGroups: AssignableLegalEntityGroups,
): CompanyUserGroupAssignment[] {
  const reconciled = reconcileInitialGroupAssignment(initialUser.groups, legalEntityGroups);
  if (reconciled.length > 0) return reconciled;
  if (initialUser.isSelectedLegalEntityMember === true) {
    return [{ legalEntityId: legalEntityGroups.legalEntityId, groupId: CONTACT_ONLY_GROUP_ID }];
  }
  return [];
}

function areGroupAssignmentsEqual(left: CompanyUserGroupAssignment[], right: CompanyUserGroupAssignment[]): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map(groupAssignmentKey));
  return left.every((assignment) => rightKeys.has(groupAssignmentKey(assignment)));
}

export function buildOtherHeaderCompanyGroupSections(
  groups: CompanyUser['groups'] | undefined,
  headerCompanies: ReadonlyArray<HeaderCompany>,
  selectedLegalEntityId: string,
): OtherHeaderCompanyGroupSection[] {
  if (!selectedLegalEntityId || !groups?.length || headerCompanies.length === 0) return [];

  const assignedByLegalEntityId = new Map<string, Array<{ id: string; displayName: string }>>();
  for (const group of groups) {
    const legalEntityId = group.legalEntityId.trim();
    if (!legalEntityId) continue;
    const assigned = assignedByLegalEntityId.get(legalEntityId);
    const item = { id: group.id, displayName: group.displayName };
    if (assigned) {
      assigned.push(item);
    } else {
      assignedByLegalEntityId.set(legalEntityId, [item]);
    }
  }

  const sections: OtherHeaderCompanyGroupSection[] = [];
  for (const company of headerCompanies) {
    if (company.id === selectedLegalEntityId) continue;
    const assignedGroups = assignedByLegalEntityId.get(company.id);
    if (!assignedGroups?.length) continue;
    sections.push({
      legalEntityId: company.id,
      companyName: company.name,
      groups: assignedGroups,
    });
  }
  return sections;
}

function getSelectedLegalEntityGroups(
  assignedGroups: CompanyUser['groups'],
  legalEntityGroups: AssignableLegalEntityGroups[],
  selectedLegalEntityId: string,
): AssignableLegalEntityGroups | undefined {
  if (!selectedLegalEntityId) return undefined;

  const selectedLegalEntity = legalEntityGroups.find(
    (legalEntity) => legalEntity.legalEntityId === selectedLegalEntityId,
  );
  const selectedAssignedGroups = assignedGroups.filter((group) => group.legalEntityId === selectedLegalEntityId);
  const selectedGroups = (selectedLegalEntity?.groups ?? []).filter(
    (group) => group.legalEntityId === selectedLegalEntityId,
  );

  selectedAssignedGroups.forEach((assignedGroup) => {
    if (selectedGroups.some((group) => group.id === assignedGroup.id)) return;
    selectedGroups.push({
      ...assignedGroup,
      legalEntityName: selectedLegalEntity?.legalEntityName ?? selectedLegalEntityId,
    });
  });

  return {
    legalEntityId: selectedLegalEntityId,
    legalEntityName: selectedLegalEntity?.legalEntityName ?? selectedLegalEntityId,
    groups: selectedGroups,
  };
}

export function UserDetailsForm({ initialUser, headerCompanies = [] }: Readonly<UserDetailsFormProps>) {
  const t = useTranslations('user-management');
  const router = useRouter();
  const { session } = useSession();
  const [legalEntityGroups, setLegalEntityGroups] = useState<AssignableLegalEntityGroups[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChangedGroupSelection, setHasChangedGroupSelection] = useState(false);
  const hasReconciledInitialGroups = useRef(false);
  const hasResetAfterGroupSelectMount = useRef(false);
  const allowDirtyRef = useRef(!initialUser);

  const sessionLegalEntityId = typeof session?.legalEntityId === 'string' ? session.legalEntityId.trim() : '';
  const selectedLegalEntityId = useMemo(() => {
    if (sessionLegalEntityId) return sessionLegalEntityId;

    const sessionMatch = legalEntityGroups.find((legalEntity) => legalEntity.legalEntityId === sessionLegalEntityId);
    if (sessionMatch) return sessionMatch.legalEntityId;

    return legalEntityGroups.length === 1 ? legalEntityGroups[0].legalEntityId : '';
  }, [legalEntityGroups, sessionLegalEntityId]);
  // Customer Service enforces: "Customer can only assign new customer to the same company".
  const selectedLegalEntityGroups = useMemo(
    () => getSelectedLegalEntityGroups(initialUser?.groups ?? [], legalEntityGroups, selectedLegalEntityId),
    [initialUser, legalEntityGroups, selectedLegalEntityId],
  );
  const otherHeaderCompanyGroupSections = useMemo(
    () =>
      initialUser
        ? buildOtherHeaderCompanyGroupSections(initialUser.groups, headerCompanies, selectedLegalEntityId)
        : [],
    [headerCompanies, initialUser, selectedLegalEntityId],
  );
  const initialGroupAssignments = useMemo<CompanyUserGroupAssignment[]>(() => {
    if (!initialUser || !selectedLegalEntityGroups) return [];
    return resolveInitialGroupAssignments(initialUser, selectedLegalEntityGroups);
  }, [initialUser, selectedLegalEntityGroups]);
  const initialData: CompanyUserFormData = {
    title: normalizeTitle(initialUser?.title),
    firstName: initialUser?.firstName ?? '',
    lastName: initialUser?.lastName ?? '',
    email: initialUser?.contactEmail ?? '',
    phone: initialUser?.contactPhone ?? '',
    active: initialUser?.active ?? false,
    selectedLegalEntityId,
    groupAssignments: initialGroupAssignments,
  };
  const { form } = useValidator(
    initialUser ? 'CompanyUserEditValidationService' : 'CompanyUserCreateValidationService',
    initialData,
    'onSubmit',
  );
  const { isDirty, isSubmitted } = form.formState;

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      setLegalEntityGroups(await fetchAssignableCompanyUserGroups());
    } catch (error) {
      setGroupsError(error instanceof Error ? error.message : t('notifications.genericFailure'));
    } finally {
      setGroupsLoading(false);
    }
  }, [t]);

  const handleRetryLoadGroups = () => {
    loadGroups().catch(() => undefined);
  };

  useEffect(() => {
    let cancelled = false;

    fetchAssignableCompanyUserGroups()
      .then((groups) => {
        if (!cancelled) setLegalEntityGroups(groups);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setGroupsError(error instanceof Error ? error.message : t('notifications.genericFailure'));
        }
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    form.setValue('selectedLegalEntityId', selectedLegalEntityId, {
      shouldDirty: false,
      shouldValidate: isSubmitted,
    });
  }, [form, isSubmitted, selectedLegalEntityId]);

  useEffect(() => {
    if (!initialUser || hasReconciledInitialGroups.current || !selectedLegalEntityGroups) return;

    form.setValue('groupAssignments', resolveInitialGroupAssignments(initialUser, selectedLegalEntityGroups), {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    hasReconciledInitialGroups.current = true;
  }, [form, initialUser, selectedLegalEntityGroups]);

  useEffect(() => {
    if (!initialUser || groupsLoading || groupsError) return;
    if (!hasReconciledInitialGroups.current || hasResetAfterGroupSelectMount.current) return;
    if (!selectedLegalEntityGroups) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;
      timeoutId = setTimeout(() => {
        if (cancelled || hasResetAfterGroupSelectMount.current) return;
        hasResetAfterGroupSelectMount.current = true;
        if (form.formState.isDirty) {
          allowDirtyRef.current = true;
          return;
        }
        form.reset(form.getValues());
        allowDirtyRef.current = true;
      }, 0);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [form, groupsError, groupsLoading, initialUser, selectedLegalEntityGroups]);

  const assignments = form.watch('groupAssignments') as CompanyUserGroupAssignment[];
  const active = form.watch('active') as boolean;
  const selectableCatalogGroups = toSelectableCatalogGroups(selectedLegalEntityGroups?.groups ?? []);
  const selectedAssignmentGroupId = assignments.find(
    (assignment) => assignment.legalEntityId === selectedLegalEntityGroups?.legalEntityId,
  )?.groupId;
  const isContactOnlySelection =
    selectedAssignmentGroupId === CONTACT_ONLY_GROUP_ID ||
    Boolean(
      selectedAssignmentGroupId &&
      selectedLegalEntityGroups?.groups.some(
        (group) => group.id === selectedAssignmentGroupId && isContactGroupDisplayName(group.displayName),
      ),
    );
  const selectedGroup = isContactOnlySelection
    ? undefined
    : selectableCatalogGroups.find((group) => group.id === selectedAssignmentGroupId);
  const selectedGroupId = isContactOnlySelection ? CONTACT_ONLY_GROUP_ID : (selectedGroup?.id ?? NO_SELECTION);
  const emptyGroupOptionLabel =
    initialUser?.isSelectedLegalEntityMember === true ? t('form.unassignFromCompany') : t('form.groupPlaceholder');
  const selectedGroupLabel = isContactOnlySelection ? t('form.contactOnly') : selectedGroup?.displayName;
  const isEditingActiveUser = initialUser?.active === true;

  const updateGroupAssignment = useCallback(
    (groupId: string) => {
      if (!allowDirtyRef.current && groupId === NO_SELECTION) return;
      const nextAssignments = groupId === NO_SELECTION ? [] : [{ legalEntityId: selectedLegalEntityId, groupId }];
      const currentAssignments = (form.getValues('groupAssignments') as CompanyUserGroupAssignment[]) ?? [];
      if (
        groupId === NO_SELECTION &&
        currentAssignments.length === 0 &&
        initialUser &&
        selectedLegalEntityGroups &&
        !hasChangedGroupSelection
      ) {
        const reconciledAssignments = reconcileInitialGroupAssignment(initialUser.groups, selectedLegalEntityGroups);
        if (reconciledAssignments.length > 0) {
          form.setValue('groupAssignments', reconciledAssignments, {
            shouldDirty: false,
            shouldTouch: false,
            shouldValidate: false,
          });
          return;
        }
      }
      if (areGroupAssignmentsEqual(currentAssignments, nextAssignments)) return;
      setHasChangedGroupSelection(true);
      form.setValue('groupAssignments', nextAssignments, {
        shouldDirty: allowDirtyRef.current,
        shouldValidate: true,
      });
    },
    [form, hasChangedGroupSelection, initialUser, selectedLegalEntityGroups, selectedLegalEntityId],
  );

  const handleTitleChange = (value: string) => {
    const nextTitle = (value === NO_SELECTION ? '' : value) as CompanyUserFormData['title'];
    const currentTitle = (form.getValues('title') as string) || '';
    if (!allowDirtyRef.current && nextTitle === '' && currentTitle) return;
    if (currentTitle === nextTitle) return;
    form.setValue('title', nextTitle, { shouldDirty: allowDirtyRef.current });
  };

  const handleActiveChange = (checked: boolean | 'indeterminate') => {
    const nextActive = checked === true;
    if (form.getValues('active') === nextActive) return;
    form.setValue('active', nextActive, { shouldDirty: allowDirtyRef.current });
  };

  const translateValidationMessage = (message?: string): string | undefined => {
    if (!message || !isZodValidationMessage(message)) return undefined;
    return t(VALIDATION_I18N_KEYS[message]);
  };

  const onSubmit = async (data: CompanyUserFormData) => {
    setIsSaving(true);
    const request = toProfileRequest(data);
    const selectedGroupAssignment = selectedLegalEntityAssignment(data);

    try {
      if (!initialUser) {
        const result = await createCompanyUser({
          ...request,
          groupAssignments: selectedGroupAssignment ? [selectedGroupAssignment] : [],
        });
        const userName = `${data.firstName} ${data.lastName}`.trim();
        if (result.failedGroupNames?.length) {
          notify({
            title: t('notifications.createPartial', {
              userName,
              groupNames: result.failedGroupNames.join(', '),
            }),
            type: ToastType.Warning,
            duration: 4000,
          });
        } else {
          notify({
            title: t('notifications.createSuccess'),
            type: ToastType.Success,
            duration: 4000,
          });
        }
        router.push('/account/users');
        return;
      }

      await updateCompanyUser(initialUser.id, {
        ...request,
        ...(hasChangedGroupSelection
          ? { groupAssignments: selectedGroupAssignment ? [selectedGroupAssignment] : [] }
          : {}),
      });
      notify({
        title: getUpdateSuccessTitle(data.active, initialUser.active, t),
        type: ToastType.Success,
        duration: 4000,
      });
      router.push('/account/users');
    } catch (error) {
      notify({
        title: getSubmitErrorTitle(error, Boolean(initialUser), t),
        type: ToastType.Error,
        duration: 4000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const firstNameError = translateValidationMessage(form.formState.errors.firstName?.message as string | undefined);
  const lastNameError = translateValidationMessage(form.formState.errors.lastName?.message as string | undefined);
  const emailError = translateValidationMessage(form.formState.errors.email?.message as string | undefined);
  const phoneError = translateValidationMessage(form.formState.errors.phone?.message as string | undefined);
  const groupError = translateValidationMessage(form.formState.errors.groupAssignments?.message as string | undefined);

  return (
    <div className="flex max-w-[1068px] flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6">
        <H1>
          {initialUser
            ? t('headingWithName', { firstName: initialUser.firstName, lastName: initialUser.lastName })
            : t('heading')}
        </H1>
        {initialUser ? (
          <Badge
            variant={initialUser.active ? 'success' : 'destructive'}
            size="status"
            className={
              initialUser.active
                ? 'border-border-success bg-surface-success text-text-success'
                : 'border-border-error bg-surface-error text-text-error'
            }
          >
            {initialUser.active ? t('status.active') : t('status.inactive')}
          </Badge>
        ) : null}
      </div>

      <Card className="gap-8 p-4 lg:p-6">
        <CardContent className="p-0">
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
            <div className="flex flex-col gap-6">
              <H4>{t('form.userDetails')}</H4>

              <div className="flex flex-col gap-4">
                <div className="flex w-full flex-col gap-0.5 md:w-[254px] lg:w-66">
                  <Label
                    htmlFor="company-user-title"
                    isOptional
                    className="text-base leading-6 font-bold text-text-headings"
                  >
                    {t('form.title')}
                  </Label>
                  <Select
                    value={(form.watch('title') as string) || NO_SELECTION}
                    onValueChange={handleTitleChange}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="company-user-title">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SELECTION}>{t('form.noTitle')}</SelectItem>
                      {TITLE_KEYS.map((title) => (
                        <SelectItem key={title} value={title}>
                          {t(`form.titles.${title}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-0.5">
                    <Label
                      htmlFor="company-user-first-name"
                      className="text-base leading-6 font-bold text-text-headings"
                    >
                      {t('form.firstName')}
                    </Label>
                    <Input
                      id="company-user-first-name"
                      autoComplete="given-name"
                      aria-required="true"
                      aria-invalid={Boolean(firstNameError)}
                      aria-describedby={firstNameError ? fieldErrorId('first-name') : undefined}
                      disabled={isSaving}
                      {...form.register('firstName')}
                    />
                    {firstNameError ? (
                      <p id={fieldErrorId('first-name')} role="alert" className="mt-1 text-sm text-text-error">
                        {firstNameError}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <Label
                      htmlFor="company-user-last-name"
                      className="text-base leading-6 font-bold text-text-headings"
                    >
                      {t('form.lastName')}
                    </Label>
                    <Input
                      id="company-user-last-name"
                      autoComplete="family-name"
                      aria-required="true"
                      aria-invalid={Boolean(lastNameError)}
                      aria-describedby={lastNameError ? fieldErrorId('last-name') : undefined}
                      disabled={isSaving}
                      {...form.register('lastName')}
                    />
                    {lastNameError ? (
                      <p id={fieldErrorId('last-name')} role="alert" className="mt-1 text-sm text-text-error">
                        {lastNameError}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="company-user-email" className="text-base leading-6 font-bold text-text-headings">
                      {t('form.email')}
                    </Label>
                    <Input
                      id="company-user-email"
                      type="email"
                      autoComplete="email"
                      aria-required="true"
                      aria-invalid={Boolean(emailError)}
                      aria-describedby={emailError ? fieldErrorId('email') : undefined}
                      disabled={isSaving}
                      {...form.register('email')}
                    />
                    {emailError ? (
                      <p id={fieldErrorId('email')} role="alert" className="mt-1 text-sm text-text-error">
                        {emailError}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <Label
                      htmlFor="company-user-phone"
                      isOptional
                      className="text-base leading-6 font-bold text-text-headings"
                    >
                      {t('form.phone')}
                    </Label>
                    <Input
                      id="company-user-phone"
                      type="tel"
                      autoComplete="tel"
                      aria-invalid={Boolean(phoneError)}
                      aria-describedby={phoneError ? fieldErrorId('phone') : undefined}
                      disabled={isSaving}
                      {...form.register('phone')}
                    />
                    {phoneError ? (
                      <p id={fieldErrorId('phone')} role="alert" className="mt-1 text-sm text-text-error">
                        {phoneError}
                      </p>
                    ) : null}
                  </div>
                </div>

                {groupsLoading ? (
                  <output className="flex items-center gap-2 text-text-body">
                    <Spinner variant="sm" color="primary" />
                    {t('form.loadingGroups')}
                  </output>
                ) : null}

                {groupsError ? (
                  <div role="alert" className="space-y-3 rounded-sm border border-border-error bg-surface-error p-4">
                    <p className="text-text-error">{groupsError}</p>
                    <Button type="button" variant="secondary" onClick={handleRetryLoadGroups}>
                      {t('tryAgain')}
                    </Button>
                  </div>
                ) : null}

                {!groupsLoading && !groupsError ? (
                  <div className="flex flex-col gap-4">
                    {selectedLegalEntityGroups ? (
                      <div className="flex flex-col gap-0.5">
                        <Label
                          htmlFor={`company-user-group-${selectedLegalEntityGroups.legalEntityId}`}
                          className="text-base leading-6 font-bold text-text-headings"
                        >
                          {t('form.userGroupForCompany', {
                            company: selectedLegalEntityGroups.legalEntityName,
                          })}
                        </Label>
                        <Select value={selectedGroupId} onValueChange={updateGroupAssignment} disabled={isSaving}>
                          <SelectTrigger
                            id={`company-user-group-${selectedLegalEntityGroups.legalEntityId}`}
                            aria-required={initialUser ? undefined : 'true'}
                            aria-invalid={groupError ? true : undefined}
                            aria-describedby={groupError ? fieldErrorId('group-assignments') : undefined}
                          >
                            <SelectValue placeholder={emptyGroupOptionLabel}>{selectedGroupLabel}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={CONTACT_ONLY_GROUP_ID}>{t('form.contactOnly')}</SelectItem>
                            <SelectItem value={NO_SELECTION}>{emptyGroupOptionLabel}</SelectItem>
                            {selectableCatalogGroups.map((group) => (
                              <SelectItem key={group.id} value={group.id}>
                                {group.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    {otherHeaderCompanyGroupSections.map((section) => {
                      const headingId = `company-user-group-readonly-${section.legalEntityId}`;
                      return (
                        <div key={section.legalEntityId} className="flex flex-col gap-0.5">
                          <Label id={headingId} className="text-base leading-6 font-bold text-text-headings">
                            {t('form.userGroupForCompany', { company: section.companyName })}
                          </Label>
                          <ul aria-labelledby={headingId} className="list-disc ps-6 text-base leading-6 text-text-body">
                            {section.groups.map((group) => (
                              <li key={group.id}>{group.displayName}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                    {groupError ? (
                      <p id={fieldErrorId('group-assignments')} role="alert" className="text-sm text-text-error">
                        {groupError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="flex w-fit items-center gap-3">
                  <Checkbox
                    id="company-user-active"
                    checked={active}
                    onCheckedChange={handleActiveChange}
                    disabled={isSaving}
                  />
                  <Label htmlFor="company-user-active" className="text-base leading-6 font-bold text-text-body">
                    {isEditingActiveUser ? t('form.activeUser') : t('form.activateUser')}
                  </Label>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {isEditingActiveUser ? t('form.activeUserHelper') : t('form.activateUserHelper')}
              </TooltipContent>
            </Tooltip>

            <div className="flex flex-wrap gap-8">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/account/users')}
                disabled={isSaving}
                className="font-headlines tracking-[var(--desktop-spacing-action-button)]"
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!isDirty || isSaving || groupsLoading || Boolean(groupsError)}
                className="font-headlines tracking-[var(--desktop-spacing-action-button)]"
              >
                {isSaving ? t('form.saving') : t('save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
