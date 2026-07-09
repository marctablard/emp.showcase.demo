'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { FileText, FolderKanban, Plus, Receipt, ShoppingCart, Trash2 } from 'lucide-react';
import {
  AccountListContainer,
  accountTableBadgeCellClass,
  accountTableBadgeHeadClass,
  accountTableHeadClass,
  accountTableHeadRowClass,
  accountTableRowClass,
  shortenId,
} from '@/components/account/shared/account-list';
import { AccountPageHeader } from '@/components/account/shared/account-page-header';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProjects } from '@/hooks/projects/useProjects';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { ProjectCreateDto } from '@/platform/services/model/project/project';
import { CreateProjectModal } from './create-project-modal';
import { ProjectStatusBadge } from './project-status-badge';

export function ProjectsList() {
  const t = useTranslations('account.projects');
  const tGroups = useTranslations('account.sidebar.groups');
  const locale = useLocale();
  const { projects, loading, error, createProject, deleteProject } = useProjects();
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const router = useRouter();

  const handleCreate = async (data: ProjectCreateDto) => {
    await createProject(data);
  };

  const handleDelete = async (projectId: string) => {
    if (confirmDeleteId !== projectId) {
      setConfirmDeleteId(projectId);
      return;
    }
    setDeletingId(projectId);
    try {
      await deleteProject(projectId);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AccountPageHeader
        eyebrow={tGroups('myOrganisation')}
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('newProject')}
          </Button>
        }
      />

      {error ? (
        <div className="bg-surface-error border border-border-error text-text-error px-4 py-3">{error.message}</div>
      ) : (
        <AccountListContainer>
          <Table>
            <TableHeader>
              <TableRow className={accountTableHeadRowClass}>
                <TableHead className={accountTableHeadClass}>{t('projectId')}</TableHead>
                <TableHead className={accountTableHeadClass}>{t('projectName')}</TableHead>
                <TableHead className={accountTableHeadClass}>{t('startDate')}</TableHead>
                <TableHead className={accountTableHeadClass}>{t('endDate')}</TableHead>
                <TableHead className={accountTableBadgeHeadClass}>{t('status')}</TableHead>
                <TableHead className={cn(accountTableHeadClass, 'text-center')}>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex items-center justify-center">
                      <Spinner color="primary" variant="md" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-text-placeholders">
                      <FolderKanban className="h-10 w-10 text-text-on-disabled" />
                      <p className="font-medium text-text-headings">{t('noProjects')}</p>
                      <p className="text-sm">{t('noProjectsDescription')}</p>
                      <Button onClick={() => setShowCreate(true)} variant="secondary" className="gap-2 mt-1">
                        <Plus className="h-4 w-4" />
                        {t('createProject')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project, index) => {
                  const name =
                    (project.name as Record<string, string>)?.[locale] ??
                    (project.name as Record<string, string>)?.en ??
                    project.id;

                  return (
                    <TableRow
                      key={project.id}
                      className={accountTableRowClass(index, { clickable: true })}
                      onClick={() => router.push(`/account/projects/${project.id}`)}
                    >
                      <TableCell className="px-2 py-4 font-medium" onClick={(e) => e.stopPropagation()}>
                        <span title={project.id}>
                          <UiLink type="Link" href={`/account/projects/${project.id}`} variant="primary">
                            {shortenId(project.id)}
                          </UiLink>
                        </span>
                      </TableCell>
                      <TableCell className="px-2 py-4">{name}</TableCell>
                      <TableCell className="px-2 py-4">
                        {project.startDate ? format(new Date(project.startDate), 'dd.MM.yyyy') : '–'}
                      </TableCell>
                      <TableCell className="px-2 py-4">
                        {project.endDate ? format(new Date(project.endDate), 'dd.MM.yyyy') : '–'}
                      </TableCell>
                      <TableCell className={accountTableBadgeCellClass}>
                        <ProjectStatusBadge status={project.status} />
                      </TableCell>
                      <TableCell className="px-2 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/account/projects/${project.id}?tab=shoppingLists`}>
                            <Button variant="neutral" size="icon" title={t('tabs.shoppingLists')}>
                              <ShoppingCart className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/account/projects/${project.id}?tab=orders`}>
                            <Button variant="neutral" size="icon" title={t('tabs.orders')}>
                              <Receipt className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/account/projects/${project.id}?tab=documents`}>
                            <Button variant="neutral" size="icon" title={t('tabs.documents')}>
                              <FileText className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="neutral"
                            size="icon"
                            className={cn(
                              'ml-2',
                              confirmDeleteId === project.id
                                ? 'text-text-error'
                                : 'text-text-placeholders hover:text-text-error',
                            )}
                            onClick={() => handleDelete(project.id)}
                            disabled={deletingId === project.id}
                            title={confirmDeleteId === project.id ? t('confirmDelete') : t('deleteProject')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </AccountListContainer>
      )}

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={handleCreate} />
    </div>
  );
}
