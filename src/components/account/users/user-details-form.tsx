'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { releaseNavigationWaitCursorLease } from '@/hooks/common/useGlobalCursor';
import { useSession } from '@/hooks/session/useSession';
import { useValidator } from '@/hooks/validation/useValidator';
import { useRouter } from '@/i18n/navigation';
import { createCompanyUser, fetchAssignableCompanyUserGroups, updateCompanyUser } from '@/lib/client/user-management';
import type { CompanyUserFormData } from '@/lib/validation/form-schemas';
import type {
  AssignableLegalEntityGroups,
  CompanyUser,
  CompanyUserGroupAssignment,
  CreateCompanyUserResult,
  UpdateCompanyUserRequest,
} from '@/platform/services/model/user-management/company-user';
import { CONTACT_ONLY_GROUP_ID } from '@/platform/services/model/user-management/contact-only';

const TITLE_KEYS = ['MR', 'MRS', 'MS'] as const;
const NO_SELECTION = '__none__';
const SAME_COMPANY_REQUIRED_ERROR = 'Customer can only assign new customer to the same company';
const PREDEFINED_GROUP_CONFLICT_CODE = 'PREDEFINED_GROUP_CONFLICT';
const PREDEFINED_GROUP_ROLE_NAMES = ['admin', 'buyer', 'requestor', 'requester'];
const NOTIFY_DURATION_MS = 4000;
const USERS_LIST_HREF = '/account/users';

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

function getPredefinedGroupConflictTitle(error: unknown, translate: UserManagementTranslate): string | undefined {
  if (getCompanyUserErrorCode(error) === PREDEFINED_GROUP_CONFLICT_CODE) {
    return translate('notifications.predefinedGroupConflict');
  }
  return undefined;
}

function getCreateSubmitErrorTitle(error: unknown, translate: UserManagementTranslate): string {
  const conflictTitle = getPredefinedGroupConflictTitle(error, translate);
  if (conflictTitle) return conflictTitle;
  if (error instanceof Error && error.message === SAME_COMPANY_REQUIRED_ERROR) {
    return SAME_COMPANY_REQUIRED_ERROR;
  }
  return translate('notifications.genericFailure');
}

function getUpdateSubmitErrorTitle(error: unknown, translate: UserManagementTranslate): string {
  return getPredefinedGroupConflictTitle(error, translate) ?? translate('notifications.saveError');
}

function companyUserValidationServiceName(initialUser?: CompanyUser): string {
  if (initialUser) return 'CompanyUserEditValidationService';
  return 'CompanyUserCreateValidationService';
}

function sessionLegalEntityIdValue(legalEntityId: unknown): string {
  if (typeof legalEntityId === 'string') {
    return legalEntityId.trim();
  }
  return '';
}

function activeToggleCopy(initialUser: CompanyUser | undefined, translate: UserManagementTranslate) {
  if (initialUser?.active === true) {
    return { label: translate('form.activeUser'), helper: translate('form.activeUserHelper') };
  }
  return { label: translate('form.activateUser'), helper: translate('form.activateUserHelper') };
}

function titleSelectValue(title: string | undefined): string {
  if (title) return title;
  return NO_SELECTION;
}

function describedById(error: string | undefined, suffix: string): string | undefined {
  if (!error) return undefined;
  return fieldErrorId(suffix);
}

function isUserDetailsSaveDisabled(
  isDirty: boolean,
  isSaving: boolean,
  groupsLoading: boolean,
  groupsError: string | null,
): boolean {
  if (!isDirty) return true;
  if (isSaving) return true;
  if (groupsLoading) return true;
  return Boolean(groupsError);
}

function isContactOnlyGroupSelection(
  selectedAssignmentGroupId: string | undefined,
  selectedLegalEntityGroups: AssignableLegalEntityGroups | undefined,
): boolean {
  if (selectedAssignmentGroupId === CONTACT_ONLY_GROUP_ID) return true;
  if (selectedAssignmentGroupId && selectedLegalEntityGroups) {
    return selectedLegalEntityGroups.groups.some(
      (group) => group.id === selectedAssignmentGroupId && isContactGroupDisplayName(group.displayName),
    );
  }
  return false;
}

function resolveGroupPickerSelection(
  assignments: CompanyUserGroupAssignment[],
  selectedLegalEntityGroups: AssignableLegalEntityGroups | undefined,
  contactOnlyLabel: string,
): {
  selectedGroupId: string;
  selectedGroupLabel: string | undefined;
  selectableCatalogGroups: AssignableLegalEntityGroups['groups'];
} {
  const selectableCatalogGroups = toSelectableCatalogGroups(selectedLegalEntityGroups?.groups ?? []);
  const selectedAssignmentGroupId = assignments.find(
    (assignment) => assignment.legalEntityId === selectedLegalEntityGroups?.legalEntityId,
  )?.groupId;

  if (isContactOnlyGroupSelection(selectedAssignmentGroupId, selectedLegalEntityGroups)) {
    return {
      selectedGroupId: CONTACT_ONLY_GROUP_ID,
      selectedGroupLabel: contactOnlyLabel,
      selectableCatalogGroups,
    };
  }

  const selectedGroup = selectableCatalogGroups.find((group) => group.id === selectedAssignmentGroupId);
  return {
    selectedGroupId: selectedGroup?.id ?? NO_SELECTION,
    selectedGroupLabel: selectedGroup?.displayName,
    selectableCatalogGroups,
  };
}

function restoreReconciledAssignmentsIfNeeded(
  groupId: string,
  currentAssignments: CompanyUserGroupAssignment[],
  initialUser: CompanyUser | undefined,
  selectedLegalEntityGroups: AssignableLegalEntityGroups | undefined,
  hasChangedGroupSelection: boolean,
): CompanyUserGroupAssignment[] | undefined {
  if (groupId === NO_SELECTION && currentAssignments.length === 0 && hasChangedGroupSelection === false) {
    if (initialUser && selectedLegalEntityGroups) {
      const reconciledAssignments = reconcileInitialGroupAssignment(initialUser.groups, selectedLegalEntityGroups);
      if (reconciledAssignments.length > 0) {
        return reconciledAssignments;
      }
    }
  }
  return undefined;
}

function notifyCreateUserResult(
  result: CreateCompanyUserResult,
  userName: string,
  translate: UserManagementTranslate,
): void {
  if (result.failedGroupNames?.length) {
    notify({
      title: translate('notifications.createPartial', {
        userName,
        groupNames: result.failedGroupNames.join(', '),
      }),
      type: ToastType.Warning,
      duration: NOTIFY_DURATION_MS,
    });
    return;
  }

  notify({
    title: translate('notifications.createSuccess'),
    type: ToastType.Success,
    duration: NOTIFY_DURATION_MS,
  });
}

async function submitCreateUserDetails(
  data: CompanyUserFormData,
  translate: UserManagementTranslate,
  navigateToUsers: () => void,
): Promise<void> {
  const selectedGroupAssignment = selectedLegalEntityAssignment(data);
  const result = await createCompanyUser({
    ...toProfileRequest(data),
    groupAssignments: selectedGroupAssignment ? [selectedGroupAssignment] : [],
  });
  notifyCreateUserResult(result, `${data.firstName} ${data.lastName}`.trim(), translate);
  navigateToUsers();
}

async function submitUpdateUserDetails(
  data: CompanyUserFormData,
  initialUser: CompanyUser,
  hasChangedGroupSelection: boolean,
  translate: UserManagementTranslate,
  navigateToUsers: () => void,
): Promise<void> {
  const selectedGroupAssignment = selectedLegalEntityAssignment(data);
  const updateRequest: UpdateCompanyUserRequest = toProfileRequest(data);
  if (hasChangedGroupSelection) {
    updateRequest.groupAssignments = selectedGroupAssignment ? [selectedGroupAssignment] : [];
  }
  await updateCompanyUser(initialUser.id, updateRequest);
  const saveSuccessKey =
    data.active === initialUser.active ? 'notifications.saveSuccess' : 'notifications.statusSuccess';
  notify({
    title: translate(saveSuccessKey),
    type: ToastType.Success,
    duration: NOTIFY_DURATION_MS,
  });
  navigateToUsers();
}

async function submitUserDetailsForm(
  data: CompanyUserFormData,
  initialUser: CompanyUser | undefined,
  hasChangedGroupSelection: boolean,
  translate: UserManagementTranslate,
  navigateToUsers: () => void,
): Promise<void> {
  if (initialUser) {
    await submitUpdateUserDetails(data, initialUser, hasChangedGroupSelection, translate, navigateToUsers);
    return;
  }
  await submitCreateUserDetails(data, translate, navigateToUsers);
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

function saveButtonLabel(isSaving: boolean, translate: UserManagementTranslate): string {
  if (isSaving) return translate('form.saving');
  return translate('save');
}

function submitErrorTitle(
  error: unknown,
  initialUser: CompanyUser | undefined,
  translate: UserManagementTranslate,
): string {
  if (initialUser) return getUpdateSubmitErrorTitle(error, translate);
  return getCreateSubmitErrorTitle(error, translate);
}

function UserDetailsStatusBadge({
  active,
  activeLabel,
  inactiveLabel,
}: Readonly<{ active: boolean; activeLabel: string; inactiveLabel: string }>) {
  if (active) {
    return (
      <Badge variant="success" size="status" className="border-border-success bg-surface-success text-text-success">
        {activeLabel}
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" size="status" className="border-border-error bg-surface-error text-text-error">
      {inactiveLabel}
    </Badge>
  );
}

function UserDetailsHeading({
  initialUser,
  heading,
  headingWithName,
  activeLabel,
  inactiveLabel,
}: Readonly<{
  initialUser?: CompanyUser;
  heading: string;
  headingWithName: string;
  activeLabel: string;
  inactiveLabel: string;
}>) {
  if (initialUser) {
    return (
      <div className="flex flex-wrap items-center gap-6">
        <H1>{headingWithName}</H1>
        <UserDetailsStatusBadge active={initialUser.active} activeLabel={activeLabel} inactiveLabel={inactiveLabel} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-6">
      <H1>{heading}</H1>
    </div>
  );
}

function UserDetailsFieldError({ suffix, message }: Readonly<{ suffix: string; message?: string }>) {
  if (message) {
    return (
      <p id={fieldErrorId(suffix)} role="alert" className="mt-1 text-sm text-text-error">
        {message}
      </p>
    );
  }
  return null;
}

function createGroupAriaRequired(initialUser?: CompanyUser): 'true' | undefined {
  if (initialUser) return undefined;
  return 'true';
}

function UserDetailsGroupSelect({
  selectedLegalEntityGroups,
  companyHeading,
  selectedGroupId,
  selectedGroupLabel,
  groupPlaceholderLabel,
  contactOnlyLabel,
  selectableCatalogGroups,
  isSaving,
  groupAriaRequired,
  groupError,
  onGroupChange,
}: Readonly<{
  selectedLegalEntityGroups: AssignableLegalEntityGroups;
  companyHeading: string;
  selectedGroupId: string;
  selectedGroupLabel: string | undefined;
  groupPlaceholderLabel: string;
  contactOnlyLabel: string;
  selectableCatalogGroups: AssignableLegalEntityGroups['groups'];
  isSaving: boolean;
  groupAriaRequired?: 'true';
  groupError?: string;
  onGroupChange: (groupId: string) => void;
}>) {
  const triggerId = `company-user-group-${selectedLegalEntityGroups.legalEntityId}`;
  const describedBy = describedById(groupError, 'group-assignments');
  return (
    <div className="flex flex-col gap-0.5">
      <Label htmlFor={triggerId} className="text-base leading-6 font-bold text-text-headings">
        {companyHeading}
      </Label>
      <Select value={selectedGroupId} onValueChange={onGroupChange} disabled={isSaving}>
        <SelectTrigger
          id={triggerId}
          aria-required={groupAriaRequired}
          aria-invalid={groupError ? true : undefined}
          aria-describedby={describedBy}
        >
          <SelectValue placeholder={groupPlaceholderLabel}>{selectedGroupLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CONTACT_ONLY_GROUP_ID}>{contactOnlyLabel}</SelectItem>
          {selectableCatalogGroups.map((group) => (
            <SelectItem key={group.id} value={group.id}>
              {group.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function UserDetailsOtherCompanyGroups({
  sections,
  headingForCompany,
}: Readonly<{
  sections: OtherHeaderCompanyGroupSection[];
  headingForCompany: (companyName: string) => string;
}>) {
  return (
    <>
      {sections.map((section) => {
        const headingId = `company-user-group-readonly-${section.legalEntityId}`;
        return (
          <div key={section.legalEntityId} className="flex flex-col gap-0.5">
            <Label id={headingId} className="text-base leading-6 font-bold text-text-headings">
              {headingForCompany(section.companyName)}
            </Label>
            <ul aria-labelledby={headingId} className="list-disc ps-6 text-base leading-6 text-text-body">
              {section.groups.map((group) => (
                <li key={group.id}>{group.displayName}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

function UserDetailsGroupsSection({
  groupsLoading,
  groupsError,
  loadingLabel,
  tryAgainLabel,
  onRetry,
  selectedLegalEntityGroups,
  companyHeading,
  selectedGroupId,
  selectedGroupLabel,
  groupPlaceholderLabel,
  contactOnlyLabel,
  selectableCatalogGroups,
  isSaving,
  groupAriaRequired,
  groupError,
  onGroupChange,
  otherHeaderCompanyGroupSections,
  headingForCompany,
}: Readonly<{
  groupsLoading: boolean;
  groupsError: string | null;
  loadingLabel: string;
  tryAgainLabel: string;
  onRetry: () => void;
  selectedLegalEntityGroups?: AssignableLegalEntityGroups;
  companyHeading: string;
  selectedGroupId: string;
  selectedGroupLabel: string | undefined;
  groupPlaceholderLabel: string;
  contactOnlyLabel: string;
  selectableCatalogGroups: AssignableLegalEntityGroups['groups'];
  isSaving: boolean;
  groupAriaRequired?: 'true';
  groupError?: string;
  onGroupChange: (groupId: string) => void;
  otherHeaderCompanyGroupSections: OtherHeaderCompanyGroupSection[];
  headingForCompany: (companyName: string) => string;
}>) {
  if (groupsLoading) {
    return (
      <output className="flex items-center gap-2 text-text-body">
        <Spinner variant="sm" color="primary" />
        {loadingLabel}
      </output>
    );
  }

  if (groupsError) {
    return (
      <div role="alert" className="space-y-3 rounded-sm border border-border-error bg-surface-error p-4">
        <p className="text-text-error">{groupsError}</p>
        <Button type="button" variant="secondary" onClick={onRetry}>
          {tryAgainLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {selectedLegalEntityGroups ? (
        <UserDetailsGroupSelect
          selectedLegalEntityGroups={selectedLegalEntityGroups}
          companyHeading={companyHeading}
          selectedGroupId={selectedGroupId}
          selectedGroupLabel={selectedGroupLabel}
          groupPlaceholderLabel={groupPlaceholderLabel}
          contactOnlyLabel={contactOnlyLabel}
          selectableCatalogGroups={selectableCatalogGroups}
          isSaving={isSaving}
          groupAriaRequired={groupAriaRequired}
          groupError={groupError}
          onGroupChange={onGroupChange}
        />
      ) : null}
      <UserDetailsOtherCompanyGroups sections={otherHeaderCompanyGroupSections} headingForCompany={headingForCompany} />
      {groupError ? (
        <p id={fieldErrorId('group-assignments')} role="alert" className="text-sm text-text-error">
          {groupError}
        </p>
      ) : null}
    </div>
  );
}

function UserDetailsActiveToggle({
  checked,
  disabled,
  label,
  helper,
  onCheckedChange,
}: Readonly<{
  checked: boolean;
  disabled: boolean;
  label: string;
  helper: string;
  onCheckedChange: (checked: boolean | 'indeterminate') => void;
}>) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className="flex w-fit items-center gap-3">
          <Checkbox id="company-user-active" checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
          <Label htmlFor="company-user-active" className="text-base leading-6 font-bold text-text-body">
            {label}
          </Label>
        </span>
      </TooltipTrigger>
      <TooltipContent>{helper}</TooltipContent>
    </Tooltip>
  );
}

export function UserDetailsForm({ initialUser, headerCompanies = [] }: Readonly<UserDetailsFormProps>) {
  const t = useTranslations('user-management');
  const router = useRouter();
  const { session } = useSession();

  useLayoutEffect(() => {
    releaseNavigationWaitCursorLease({ force: true });
  }, []);
  const [legalEntityGroups, setLegalEntityGroups] = useState<AssignableLegalEntityGroups[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChangedGroupSelection, setHasChangedGroupSelection] = useState(false);
  const hasReconciledInitialGroups = useRef(false);
  const hasResetAfterGroupSelectMount = useRef(false);
  const allowDirtyRef = useRef(initialUser === undefined);

  const sessionLegalEntityId = sessionLegalEntityIdValue(session?.legalEntityId);
  const selectedLegalEntityId = useMemo(() => {
    if (sessionLegalEntityId) return sessionLegalEntityId;

    const sessionMatch = legalEntityGroups.find((legalEntity) => legalEntity.legalEntityId === sessionLegalEntityId);
    if (sessionMatch) return sessionMatch.legalEntityId;

    if (legalEntityGroups.length === 1) return legalEntityGroups[0].legalEntityId;
    return '';
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
  const { form } = useValidator(companyUserValidationServiceName(initialUser), initialData, 'onSubmit');
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
  const contactOnlyLabel = t.raw('form.contactOnly');
  const groupPicker = resolveGroupPickerSelection(assignments, selectedLegalEntityGroups, contactOnlyLabel);
  const groupPlaceholderLabel = t('form.groupPlaceholder');
  const activeCopy = activeToggleCopy(initialUser, t);

  const updateGroupAssignment = useCallback(
    (groupId: string) => {
      if (allowDirtyRef.current === false && groupId === NO_SELECTION) return;
      const nextAssignments = groupId === NO_SELECTION ? [] : [{ legalEntityId: selectedLegalEntityId, groupId }];
      const currentAssignments = (form.getValues('groupAssignments') as CompanyUserGroupAssignment[]) ?? [];
      const restoredAssignments = restoreReconciledAssignmentsIfNeeded(
        groupId,
        currentAssignments,
        initialUser,
        selectedLegalEntityGroups,
        hasChangedGroupSelection,
      );
      if (restoredAssignments) {
        form.setValue('groupAssignments', restoredAssignments, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: false,
        });
        return;
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
    try {
      await submitUserDetailsForm(data, initialUser, hasChangedGroupSelection, t, () => {
        router.push(USERS_LIST_HREF);
      });
    } catch (error) {
      const errorTitle = submitErrorTitle(error, initialUser, t);
      notify({
        title: errorTitle,
        type: ToastType.Error,
        duration: NOTIFY_DURATION_MS,
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
      <UserDetailsHeading
        initialUser={initialUser}
        heading={t('heading')}
        headingWithName={t('headingWithName', {
          firstName: initialUser?.firstName ?? '',
          lastName: initialUser?.lastName ?? '',
        })}
        activeLabel={t('status.active')}
        inactiveLabel={t('status.inactive')}
      />

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
                    value={titleSelectValue(form.watch('title') as string)}
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
                      aria-describedby={describedById(firstNameError, 'first-name')}
                      disabled={isSaving}
                      {...form.register('firstName')}
                    />
                    <UserDetailsFieldError suffix="first-name" message={firstNameError} />
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
                      aria-describedby={describedById(lastNameError, 'last-name')}
                      disabled={isSaving}
                      {...form.register('lastName')}
                    />
                    <UserDetailsFieldError suffix="last-name" message={lastNameError} />
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
                      aria-describedby={describedById(emailError, 'email')}
                      disabled={isSaving}
                      {...form.register('email')}
                    />
                    <UserDetailsFieldError suffix="email" message={emailError} />
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
                      aria-describedby={describedById(phoneError, 'phone')}
                      disabled={isSaving}
                      {...form.register('phone')}
                    />
                    <UserDetailsFieldError suffix="phone" message={phoneError} />
                  </div>
                </div>

                <UserDetailsGroupsSection
                  groupsLoading={groupsLoading}
                  groupsError={groupsError}
                  loadingLabel={t('form.loadingGroups')}
                  tryAgainLabel={t('tryAgain')}
                  onRetry={handleRetryLoadGroups}
                  selectedLegalEntityGroups={selectedLegalEntityGroups}
                  companyHeading={t('form.userGroupForCompany', {
                    company: selectedLegalEntityGroups?.legalEntityName ?? '',
                  })}
                  selectedGroupId={groupPicker.selectedGroupId}
                  selectedGroupLabel={groupPicker.selectedGroupLabel}
                  groupPlaceholderLabel={groupPlaceholderLabel}
                  contactOnlyLabel={contactOnlyLabel}
                  selectableCatalogGroups={groupPicker.selectableCatalogGroups}
                  isSaving={isSaving}
                  groupAriaRequired={createGroupAriaRequired(initialUser)}
                  groupError={groupError}
                  onGroupChange={updateGroupAssignment}
                  otherHeaderCompanyGroupSections={otherHeaderCompanyGroupSections}
                  headingForCompany={(companyName) => t('form.userGroupForCompany', { company: companyName })}
                />
              </div>
            </div>

            <UserDetailsActiveToggle
              checked={active}
              disabled={isSaving}
              label={activeCopy.label}
              helper={activeCopy.helper}
              onCheckedChange={handleActiveChange}
            />

            <div className="flex flex-wrap gap-8">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(USERS_LIST_HREF)}
                disabled={isSaving}
                className="font-headlines tracking-[var(--desktop-spacing-action-button)]"
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isUserDetailsSaveDisabled(isDirty, isSaving, groupsLoading, groupsError)}
                className="font-headlines tracking-[var(--desktop-spacing-action-button)]"
              >
                {saveButtonLabel(isSaving, t)}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
