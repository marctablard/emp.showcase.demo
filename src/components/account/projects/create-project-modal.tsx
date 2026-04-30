'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ProjectCreateDto, ProjectStatus } from '@/platform/services/model/project/project';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (data: ProjectCreateDto) => Promise<void>;
}

export function CreateProjectModal({ open, onClose, onCreated }: CreateProjectModalProps) {
  const t = useTranslations('account.projects');

  const [nameEn, setNameEn] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('open');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setNameEn('');
    setStatus('open');
    setStartDate('');
    setEndDate('');
    setComment('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!nameEn.trim()) {
      setError(t('projectNameEn') + ' is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onCreated({
        name: { en: nameEn.trim() },
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        comment: comment || undefined,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{t('createProject')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-1.5">
            <Label htmlFor="name-en">{t('projectName')} *</Label>
            <Input
              id="name-en"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="My first project"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="status">{t('status')}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">{t('statuses.open')}</SelectItem>
                  <SelectItem value="hold">{t('statuses.hold')}</SelectItem>
                  <SelectItem value="closed">{t('statuses.closed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="start-date">{t('startDate')}</Label>
              <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="end-date">{t('endDate')}</Label>
              <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="comment">{t('comment')}</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('commentPlaceholder')}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-text-error">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? '...' : t('createProject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
