'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { accountTableRowClass } from '@/components/account/shared/account-list';
import { Badge } from '@/components/ui/badge';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { TableData } from '../types';
import { formatDate } from '../utils';
import { WidgetSkeleton } from './WidgetSkeleton';
import { AiWidgetFrame, aiTableCellClass as cellClass, aiTableHeadClass as headClass } from './ai-widget-kit';

interface TableRendererProps {
  data: TableData;
}

const isNumeric = (type: string) => type === 'number' || type === 'currency';

export const TableRenderer: React.FC<TableRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');
  const headers = Array.isArray(data.headers) ? data.headers : [];
  const columnTypes = data.columnTypes ?? [];

  if (data.rows == null) {
    return <WidgetSkeleton rows={2} />;
  }

  const validRows = data.rows.filter((row): row is string[] => Array.isArray(row));
  const getColumnType = (index: number): string => columnTypes[index] || 'text';

  const formatCellValue = (value: string, type: string, testId: string): React.ReactNode => {
    if (!value || value === 'undefined' || value === 'null') return t('emptyValue');

    switch (type) {
      case 'date':
        return value.trim() ? formatDate(value.trim()) : t('emptyValue');
      case 'currency':
        return <span className="font-medium">{value}</span>;
      case 'status':
        return (
          <Badge variant="outline" size="status">
            {value}
          </Badge>
        );
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1' ? '✓' : '✗';
      case 'link':
        return (
          <UiLink type="A" href={value} variant="primary" className="break-all" data-testid={testId}>
            {value}
          </UiLink>
        );
      default:
        return value;
    }
  };

  return (
    <div className="space-y-2">
      {data.title ? <p className="px-1 text-sm font-semibold text-text-headings">{data.title}</p> : null}
      <AiWidgetFrame className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              {headers.map((header, index) => (
                <TableHead
                  key={`${header}-${index}`}
                  className={cn(
                    headClass,
                    index === 0 && 'pl-4',
                    index === headers.length - 1 && 'pr-4',
                    isNumeric(getColumnType(index)) && 'text-right',
                  )}
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {validRows.map((row, rowIndex) => (
              <TableRow key={rowIndex} className={accountTableRowClass(rowIndex)}>
                {row.map((cell, cellIndex) => (
                  <TableCell
                    key={cellIndex}
                    className={cn(
                      cellClass,
                      cellIndex === 0 && 'pl-4',
                      cellIndex === row.length - 1 && 'pr-4',
                      isNumeric(getColumnType(cellIndex)) && 'text-right tabular-nums',
                    )}
                  >
                    {formatCellValue(String(cell), getColumnType(cellIndex), `aiTable-link-${rowIndex}-${cellIndex}`)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {validRows.length === 0 ? (
          <p className="px-4 py-4 text-center text-sm text-text-placeholders">{t('noDataAvailable')}</p>
        ) : null}
      </AiWidgetFrame>
    </div>
  );
};
