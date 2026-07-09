'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { Pencil, X } from 'lucide-react';
import { AccountSpecTable, SpecNoteRow, SpecRow, SpecSection } from '@/components/account/shared/account-spec-table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Project, ProjectStatus, ProjectUpdateDto } from '@/platform/services/model/project/project';
import { ProjectStatusBadge } from './project-status-badge';

interface ProjectOverviewTabProps {
  project: Project;
  onSave: (data: ProjectUpdateDto) => Promise<Project>;
}

const emDash = <span className="text-text-on-disabled">–</span>;

export function ProjectOverviewTab({ project, onSave }: ProjectOverviewTabProps) {
  const t = useTranslations('account.projects');

  const [editing, setEditing] = useState(false);
  const [nameEn, setNameEn] = useState((project.name as Record<string, string>)?.en ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [startDate, setStartDate] = useState(project.startDate ? project.startDate.split('T')[0] : '');
  const [endDate, setEndDate] = useState(project.endDate ? project.endDate.split('T')[0] : '');
  const [comment, setComment] = useState(project.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    setNameEn((project.name as Record<string, string>)?.en ?? (project.name as Record<string, string>)?.de ?? '');
    setStatus(project.status);
    setStartDate(project.startDate ? project.startDate.split('T')[0] : '');
    setEndDate(project.endDate ? project.endDate.split('T')[0] : '');
    setComment(project.comment ?? '');
    setEditing(false);
  }, [project]);

  const handleCancel = () => {
    setNameEn((project.name as Record<string, string>)?.en ?? (project.name as Record<string, string>)?.de ?? '');
    setStatus(project.status);
    setStartDate(project.startDate ? project.startDate.split('T')[0] : '');
    setEndDate(project.endDate ? project.endDate.split('T')[0] : '');
    setComment(project.comment ?? '');
    setSaveResult(null);
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      await onSave({
        name: { en: nameEn },
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        comment: comment || undefined,
      });
      setSaveResult('success');
      setEditing(false);
    } catch {
      setSaveResult('error');
    } finally {
      setSaving(false);
    }
  };

  const nameEn_ = (project.name as Record<string, string>)?.en ?? (project.name as Record<string, string>)?.de;

  /* ── READ-ONLY VIEW ── */
  if (!editing) {
    return (
      <>
        {saveResult === 'success' && (
          <div className="border-b border-border-primary px-4 py-4 sm:px-6">
            <Alert className="bg-surface-success border-border-success">
              <AlertDescription className="text-text-body">{t('overview.saveSuccess')}</AlertDescription>
            </Alert>
          </div>
        )}

        <AccountSpecTable>
          <SpecSection title={t('overview.projectInfo')}>
            <SpecRow
              left={{ label: t('projectName'), value: nameEn_ || emDash }}
              right={{ label: t('status'), value: <ProjectStatusBadge status={project.status} /> }}
            />
            <SpecRow
              left={{
                label: t('startDate'),
                value: project.startDate ? format(new Date(project.startDate), 'dd MMM yyyy') : emDash,
              }}
              right={{
                label: t('endDate'),
                value: project.endDate ? format(new Date(project.endDate), 'dd MMM yyyy') : emDash,
              }}
            />
            {project.modifiedAt ? (
              <SpecRow
                left={{
                  label: t('overview.lastModified'),
                  value: format(new Date(project.modifiedAt), 'dd MMM yyyy HH:mm'),
                }}
              />
            ) : null}
          </SpecSection>

          {project.comment ? <SpecNoteRow title={t('comment')}>{project.comment}</SpecNoteRow> : null}
        </AccountSpecTable>

        <footer className="flex justify-end px-4 py-4 sm:px-6">
          <Button
            variant="secondary"
            size="small"
            className="gap-2"
            onClick={() => {
              setSaveResult(null);
              setEditing(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            {t('overview.edit')}
          </Button>
        </footer>
      </>
    );
  }

  /* ── EDIT VIEW ── */
  return (
    <>
      {saveResult === 'error' && (
        <div className="border-b border-border-primary px-4 py-4 sm:px-6">
          <Alert className="bg-surface-error border-border-error">
            <AlertDescription className="text-text-error">{t('overview.saveError')}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="grid gap-5 px-4 py-4 sm:px-6">
        <div className="grid gap-1.5">
          <Label>{t('status')}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{t('statuses.open')}</SelectItem>
              <SelectItem value="hold">{t('statuses.hold')}</SelectItem>
              <SelectItem value="closed">{t('statuses.closed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>{t('projectName')}</Label>
          <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label>{t('startDate')}</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('endDate')}</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>{t('comment')}</Label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('commentPlaceholder')}
            rows={3}
          />
        </div>
      </div>

      <footer className="flex items-center gap-3 border-t border-border-primary px-4 py-4 sm:px-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t('overview.saving') : t('overview.saveChanges')}
        </Button>
        <Button variant="secondary" onClick={handleCancel} disabled={saving} className="gap-2">
          <X className="h-4 w-4" />
          {t('overview.cancel')}
        </Button>
      </footer>
    </>
  );
}
