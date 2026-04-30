'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { FileText, List, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { Project } from '@/platform/services/model/project/project';
import { ProjectStatusBadge } from './project-status-badge';

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => Promise<void>;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const t = useTranslations('account.projects');
  const locale = useLocale();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const name =
    (project.name as Record<string, string>)?.[locale] ?? (project.name as Record<string, string>)?.en ?? project.id;

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete(project.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="border border-border-primary rounded-md p-5 bg-surface-page hover:shadow-md transition-shadow flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-text-headings truncate">{name}</h3>
          {project.comment && <p className="text-sm text-text-secondary line-clamp-2 mt-0.5">{project.comment}</p>}
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      {/* Dates */}
      <div className="flex gap-4 text-sm text-text-secondary">
        {project.startDate && (
          <span>
            {t('startDate')}: {format(new Date(project.startDate), 'dd MMM yyyy')}
          </span>
        )}
        {project.endDate && (
          <span>
            {t('endDate')}: {format(new Date(project.endDate), 'dd MMM yyyy')}
          </span>
        )}
      </div>

      {/* Quick-access icons + actions */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border-primary">
        <div className="flex gap-1">
          <Link href={`/account/projects/${project.id}?tab=shoppingLists`}>
            <Button variant="neutral" size="icon" title={t('tabs.shoppingLists')}>
              <List className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/account/projects/${project.id}?tab=orders`}>
            <Button variant="neutral" size="icon" title={t('tabs.orders')}>
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/account/projects/${project.id}?tab=documents`}>
            <Button variant="neutral" size="icon" title={t('tabs.documents')}>
              <FileText className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="flex gap-2 items-center">
          {confirmDelete && <span className="text-xs text-text-error">{t('confirmDelete').split('?')[0]}?</span>}
          <Button
            variant="neutral"
            size="icon"
            className="text-text-secondary hover:text-text-error"
            onClick={handleDelete}
            disabled={deleting}
            title={t('deleteProject')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Link href={`/account/projects/${project.id}`}>
            <Button variant="secondary" size="small">
              View
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
