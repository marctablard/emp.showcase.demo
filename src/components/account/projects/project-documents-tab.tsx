'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { Download, Eye, File, FileImage, FileText, FileVideo, Trash2, Upload, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ProjectMediaAsset } from '@/platform/services/model/project/project';

interface ProjectDocumentsTabProps {
  media: ProjectMediaAsset[];
  onUpload: (file: File) => Promise<ProjectMediaAsset>;
  onDelete: (mediaId: string) => Promise<void>;
}

function FileTypeIcon({ contentType }: { contentType: string }) {
  const cls = 'h-4 w-4 shrink-0 text-text-secondary';
  if (contentType.startsWith('image/')) return <FileImage className={cls} />;
  if (contentType === 'application/pdf') return <FileText className={cls} />;
  if (contentType.startsWith('video/')) return <FileVideo className={cls} />;
  return <File className={cls} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewable(contentType: string): boolean {
  return contentType === 'application/pdf' || contentType.startsWith('image/');
}

function PreviewModal({ asset, onClose }: { asset: ProjectMediaAsset; onClose: () => void }) {
  const isImage = asset.contentType.startsWith('image/');
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="truncate text-base font-medium">{asset.fileName}</DialogTitle>
            <Button variant="neutral" size="icon" onClick={onClose} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="mt-2 rounded overflow-hidden bg-surface-image-background" style={{ minHeight: '60vh' }}>
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.url} alt={asset.fileName} className="w-full h-auto object-contain max-h-[75vh]" />
          ) : (
            <iframe src={asset.url} title={asset.fileName} className="w-full border-0" style={{ height: '75vh' }} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectDocumentsTab({ media, onUpload, onDelete }: ProjectDocumentsTabProps) {
  const t = useTranslations('account.projects.documents');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<ProjectMediaAsset | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      await onUpload(file);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 4000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t('uploadError'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (mediaId: string) => {
    if (deleteConfirm !== mediaId) {
      setDeleteConfirm(mediaId);
      return;
    }
    setDeleting(mediaId);
    try {
      await onDelete(mediaId);
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      {previewAsset && <PreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />}

      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            {uploadSuccess && (
              <Alert className="bg-surface-success border-border-success">
                <AlertDescription className="text-text-body">{t('uploadSuccess')}</AlertDescription>
              </Alert>
            )}
            {uploadError && (
              <Alert className="bg-surface-error border-border-error">
                <AlertDescription className="text-text-error">{uploadError}</AlertDescription>
              </Alert>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.zip,.txt"
          />
          <Button
            variant="secondary"
            size="small"
            className="gap-2 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Spinner /> : <Upload className="h-4 w-4" />}
            {uploading ? t('uploading') : t('upload')}
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="text-base">
              <TableHead className="!h-14 font-bold">
                <span className="inline-flex items-center gap-1">{t('fileName')}</span>
              </TableHead>
              <TableHead className="!h-14 w-40 font-bold">
                <span className="inline-flex items-center gap-1">{t('type')}</span>
              </TableHead>
              <TableHead className="!h-14 w-36 font-bold">
                <span className="inline-flex items-center gap-1">{t('uploaded')}</span>
              </TableHead>
              <TableHead className="!h-14 w-28 text-right font-bold" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {media.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-text-secondary">
                    <FileText className="h-10 w-10 text-text-on-disabled" />
                    <p className="font-medium text-text-headings">{t('noDocuments')}</p>
                    <p className="text-sm">{t('noDocumentsDescription')}</p>
                    <Button
                      variant="secondary"
                      size="small"
                      className="gap-2 mt-1"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4" />
                      {t('upload')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              media.map((asset, index) => (
                <TableRow
                  key={asset.id}
                  className={cn(
                    'hover:bg-surface-image-background text-base',
                    index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                  )}
                >
                  <TableCell className="px-2 py-4">
                    <div className="flex items-center gap-2">
                      <FileTypeIcon contentType={asset.contentType} />
                      <div className="min-w-0">
                        <span className="font-medium truncate block max-w-xs">{asset.fileName}</span>
                        {asset.bytes != null && (
                          <span className="text-xs text-text-secondary">{formatBytes(asset.bytes)}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-4 text-text-secondary">{asset.contentType}</TableCell>
                  <TableCell className="px-2 py-4 text-text-secondary">
                    {asset.createdAt ? format(new Date(asset.createdAt), 'dd.MM.yyyy') : '–'}
                  </TableCell>
                  <TableCell className="px-2 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {isPreviewable(asset.contentType) && (
                        <Button
                          variant="neutral"
                          size="icon"
                          title={t('preview')}
                          onClick={() => setPreviewAsset(asset)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {asset.url && (
                        <a href={asset.url} download={asset.fileName} target="_blank" rel="noopener noreferrer">
                          <Button variant="neutral" size="icon" title={t('download')}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="neutral"
                        size="icon"
                        className={cn(
                          deleteConfirm === asset.id ? 'text-text-error' : 'text-text-secondary hover:text-text-error',
                        )}
                        disabled={deleting === asset.id}
                        onClick={() => handleDelete(asset.id)}
                        title={deleteConfirm === asset.id ? t('confirmDelete') : t('delete')}
                      >
                        {deleting === asset.id ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
