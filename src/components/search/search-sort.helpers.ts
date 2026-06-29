import type { SearchSortOption } from '@/platform/services/model/common';

export const resolveSearchSortSelection = (sortStr: string | undefined): { id: string; direction: string } | null => {
  if (!sortStr) return null;
  const parts = sortStr.split(':');
  if (parts.length !== 2) return null;
  return { id: parts[0], direction: parts[1] };
};

export const resolveNextSortForOption = (option: SearchSortOption, currentSortStr: string | undefined): string => {
  const selection = resolveSearchSortSelection(currentSortStr);
  if (selection && selection.id === option.id) {
    const nextDir = selection.direction === 'asc' ? 'desc' : 'asc';
    return `${option.id}:${nextDir}`;
  }
  return `${option.id}:${option.defaultDirection}`;
};

export const resolveToggledSort = (currentSortStr: string | undefined): string | undefined => {
  const selection = resolveSearchSortSelection(currentSortStr);
  if (!selection) return currentSortStr;
  return `${selection.id}:${selection.direction === 'asc' ? 'desc' : 'asc'}`;
};
