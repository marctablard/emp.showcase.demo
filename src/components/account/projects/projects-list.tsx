'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { FileText, FolderKanban, Plus, Receipt, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { H1 } from '@/components/ui/h';
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
      <div className="flex items-center justify-between">
        <H1>{t('title')}</H1>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('newProject')}
        </Button>
      </div>

      {error ? (
        <div className="bg-surface-error border border-border-error text-text-error px-4 py-3 rounded">
          {error.message}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold">{t('projectName')}</TableHead>
              <TableHead className="font-bold">{t('status')}</TableHead>
              <TableHead className="font-bold">{t('startDate')}</TableHead>
              <TableHead className="font-bold">{t('endDate')}</TableHead>
              <TableHead className="font-bold text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <Spinner color="primary" variant="md" />
                  </div>
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-text-secondary">
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
                    className={cn(
                      'hover:bg-surface-image-background cursor-pointer text-base',
                      index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                    )}
                    onClick={() => router.push(`/account/projects/${project.id}`)}
                  >
                    <TableCell className="px-2 py-4 font-medium">
                      <div>
                        <UiLink
                          type="Link"
                          href={`/account/projects/${project.id}`}
                          variant="primary"
                          size="m"
                          onClick={() => {}}
                        >
                          {name}
                        </UiLink>
                        {project.comment && (
                          <p className="text-sm text-text-secondary mt-0.5 truncate max-w-xs">{project.comment}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-4">
                      <ProjectStatusBadge status={project.status} />
                    </TableCell>
                    <TableCell className="px-2 py-4">
                      {project.startDate ? format(new Date(project.startDate), 'dd.MM.yyyy') : '–'}
                    </TableCell>
                    <TableCell className="px-2 py-4">
                      {project.endDate ? format(new Date(project.endDate), 'dd.MM.yyyy') : '–'}
                    </TableCell>
                    <TableCell className="px-2 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
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
                              : 'text-text-secondary hover:text-text-error',
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
      )}

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={handleCreate} />
    </div>
  );
}
