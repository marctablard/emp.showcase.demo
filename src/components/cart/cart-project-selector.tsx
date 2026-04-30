'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FolderKanban, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import type { Project } from '@/platform/services/model/project/project';

interface CartProjectSelectorProps {
  cartId: string;
  /** Pre-selected project ID (e.g. from shopping list context or existing cart mixin) */
  initialProjectId?: string;
  onProjectSelected?: (projectId: string | null) => void;
}

const PROJECT_CART_STORAGE_KEY = 'emporix_cart_project';

export function CartProjectSelector({ cartId, initialProjectId, onProjectSelected }: CartProjectSelectorProps) {
  const t = useTranslations('account.projects.projectSelector');
  const locale = useLocale();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    // Prefer initialProjectId (from cart mixin or shopping list context) over localStorage
    if (initialProjectId) return initialProjectId;
    if (typeof window !== 'undefined') {
      return localStorage.getItem(PROJECT_CART_STORAGE_KEY + cartId) ?? null;
    }
    return null;
  });

  // Sync initialProjectId changes (e.g. cart data loads asynchronously after mount)
  useEffect(() => {
    if (initialProjectId && !selectedId) {
      setSelectedId(initialProjectId);
    }
  }, [initialProjectId, selectedId]);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        // Show all non-closed projects so customers can assign any active project
        const active = (data as Project[]).filter((p) => p.status !== 'closed');
        setProjects(active);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const persistProjectToCart = useCallback(
    async (projectId: string | null) => {
      setSaving(true);
      try {
        await fetch(`/api/cart/${cartId}/project`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });
      } catch {
        // Non-fatal: mixin update is best-effort; localStorage is the fallback
      } finally {
        setSaving(false);
      }
    },
    [cartId],
  );

  const handleSelect = useCallback(
    (value: string) => {
      const newId = value === '__none__' ? null : value;
      setSelectedId(newId);
      if (typeof window !== 'undefined') {
        if (newId) {
          localStorage.setItem(PROJECT_CART_STORAGE_KEY + cartId, newId);
        } else {
          localStorage.removeItem(PROJECT_CART_STORAGE_KEY + cartId);
        }
      }
      onProjectSelected?.(newId);
      void persistProjectToCart(newId);
    },
    [cartId, onProjectSelected, persistProjectToCart],
  );

  const handleClear = () => handleSelect('__none__');

  if (loading || projects.length === 0) return null;

  return (
    <div className="flex items-center gap-3 py-4 border-b border-border-primary">
      <FolderKanban className="h-5 w-5 text-text-secondary shrink-0" />
      <Label className="text-base font-medium text-text-headings whitespace-nowrap cursor-default">{t('label')}</Label>
      <Select value={selectedId ?? '__none__'} onValueChange={handleSelect} disabled={saving || loading}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={t('placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{t('placeholder')}</SelectItem>
          {projects.map((p) => {
            const name = (p.name as Record<string, string>)?.[locale] ?? (p.name as Record<string, string>)?.en ?? p.id;
            return (
              <SelectItem key={p.id} value={p.id}>
                {name}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {saving && <Spinner variant="xs" className="shrink-0" />}
      {selectedId && !saving && (
        <Button
          variant="neutral"
          size="icon"
          className="shrink-0"
          onClick={handleClear}
          disabled={saving}
          title={t('clearSelection')}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
