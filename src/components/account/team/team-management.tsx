'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Trash, UserPlus } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTeam } from '@/hooks/company/useTeam';
import useCustomer from '@/hooks/customer/useCustomer';
import { useToast } from '@/hooks/ui/useToast';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import { CustomerRole } from '@/platform/services/model/customer/roles';
import type { CompanyGroup, CompanyRole, TeamMember } from '@/platform/services/model/team/team';
import { AccountListContainer, accountTableHeadClass } from '../shared/account-list';
import { AccountPageHeader } from '../shared/account-page-header';
import { MemberRoleDialog } from './member-role-dialog';
import { TeamMemberDialog } from './team-member-dialog';

const ROLE_BADGE_VARIANT: Record<CompanyRole, BadgeVariant> = {
  ADMIN: 'information',
  BUYER: 'success',
  REQUESTER: 'warning',
  CONTACT: 'secondary',
  OTHER: 'muted',
};

/** Order groups so the most significant role is shown first, custom groups last. */
const ROLE_PRIORITY: CompanyRole[] = ['ADMIN', 'BUYER', 'REQUESTER', 'CONTACT', 'OTHER'];

export function TeamManagement() {
  const t = useTranslations('account.Team');
  const tGroups = useTranslations('account.sidebar.groups');
  const { toast } = useToast();
  const { members, groups, loading, error, refresh, createMember, changeGroups, removeMember } = useTeam();
  const { customer } = useCustomer();

  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);

  const memberGroups = (member: TeamMember): CompanyGroup[] =>
    member.groupIds
      .map((id) => groupById.get(id))
      .filter((group): group is CompanyGroup => Boolean(group))
      .sort((a, b) => ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role));

  const isAdmin = !!customer?.roles?.includes(CustomerRole.B2B_ADMIN);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [roleDialogMember, setRoleDialogMember] = useState<TeamMember | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const memberName = (member: TeamMember) =>
    `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || member.email || member.customerId;

  const handleRemove = async (member: TeamMember) => {
    if (!window.confirm(t('confirmRemove', { name: memberName(member) }))) {
      return;
    }
    setRemovingId(member.customerId);
    try {
      await removeMember(member.customerId);
      toast({ title: t('removeSuccessTitle'), description: t('removeSuccess'), variant: 'success' });
    } catch (err) {
      getLogger().error({ err }, 'Failed to remove team member');
      toast({ title: t('error'), description: t('removeError'), variant: 'destructive' });
    } finally {
      setRemovingId(null);
    }
  };

  const renderBody = () => {
    if (loading && members.length === 0) {
      return (
        <AccountListContainer className="flex justify-center py-12">
          <Spinner />
        </AccountListContainer>
      );
    }

    if (error) {
      return (
        <AccountListContainer className="space-y-4 py-12 text-center">
          <p className="text-text-error">{t('errorLoading')}</p>
          <Button variant="secondary" onClick={() => refresh()}>
            {t('tryAgain')}
          </Button>
        </AccountListContainer>
      );
    }

    if (members.length === 0) {
      return (
        <AccountListContainer className="py-12 text-center">
          <p className="text-text-placeholders">{t('noMembers')}</p>
        </AccountListContainer>
      );
    }

    return (
      <AccountListContainer>
        <Table>
          <TableHeader>
            <TableRow className="text-sm xl:text-base">
              <TableHead className={accountTableHeadClass}>{t('name')}</TableHead>
              <TableHead className={accountTableHeadClass}>{t('email')}</TableHead>
              <TableHead className={accountTableHeadClass}>{t('role')}</TableHead>
              {isAdmin && (
                <TableHead className={cn(accountTableHeadClass, 'w-[120px] text-center')}>{t('actions')}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member, index) => (
              <TableRow
                key={member.customerId}
                className={cn(
                  'text-sm xl:text-base hover:bg-surface-image-background',
                  index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                )}
              >
                <TableCell className="px-2 py-4 font-medium">
                  <div className="flex items-center gap-2">
                    {memberName(member)}
                    {member.primary && (
                      <Badge variant="outline" size="status">
                        {t('primary')}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-2 py-4">{member.email ?? '—'}</TableCell>
                <TableCell className="px-2 py-4">
                  <div className="flex flex-wrap gap-1">
                    {memberGroups(member).length === 0 ? (
                      <span className="text-text-placeholders">—</span>
                    ) : (
                      memberGroups(member).map((group) => (
                        <Badge key={group.id} variant={ROLE_BADGE_VARIANT[group.role]} size="status">
                          {group.role === 'OTHER' ? (group.name ?? group.id) : t(`roleLabels.${group.role}`)}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                {isAdmin && (
                  <TableCell className="px-2 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="neutral"
                        size="icon"
                        onClick={() => setRoleDialogMember(member)}
                        title={t('manageGroups')}
                        aria-label={t('manageGroups')}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="neutral"
                        size="icon"
                        onClick={() => handleRemove(member)}
                        disabled={removingId === member.customerId}
                        title={t('removeMember')}
                        aria-label={t('removeMember')}
                      >
                        {removingId === member.customerId ? <Spinner variant="sm" /> : <Trash className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AccountListContainer>
    );
  };

  return (
    <div className="space-y-6">
      <AccountPageHeader
        eyebrow={tGroups('myOrganisation')}
        title={t('title')}
        description={t('description')}
        actions={
          isAdmin ? (
            <Button onClick={() => setIsCreateOpen(true)} data-testid="team-addMember">
              <UserPlus className="mr-2 h-4 w-4" />
              {t('addMember')}
            </Button>
          ) : undefined
        }
      />

      {!isAdmin && <p className="text-sm text-text-placeholders">{t('adminOnlyNotice')}</p>}

      {renderBody()}

      <TeamMemberDialog isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} groups={groups} onCreate={createMember} />
      <MemberRoleDialog
        isOpen={roleDialogMember !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRoleDialogMember(null);
          }
        }}
        member={roleDialogMember}
        groups={groups}
        onChangeGroups={changeGroups}
      />
    </div>
  );
}

export default TeamManagement;
