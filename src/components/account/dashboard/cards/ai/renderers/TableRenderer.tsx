'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { TableData } from '../types';
import { formatDate } from '../utils';

interface TableRendererProps {
  data: TableData;
}

export const TableRenderer: React.FC<TableRendererProps> = ({ data }) => {
  const { title, headers, rows, columnTypes = [] } = data;

  const validRows = (rows || []).filter((row): row is string[] => Array.isArray(row));

  const getColumnType = (index: number): string => {
    return columnTypes[index] || 'text';
  };

  const formatCellValue = (value: string, type: string): React.ReactNode => {
    if (!value || value === 'undefined' || value === 'null') return '-';

    switch (type) {
      case 'date':
        try {
          const dateValue = value.trim();
          if (!dateValue) return '-';
          return formatDate(dateValue);
        } catch {
          return value;
        }
      case 'currency':
        return <span className="font-medium">{value}</span>;
      case 'number':
        return <span className="text-right">{value}</span>;
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
          <a href={value} className="text-text-action hover:text-text-action-hover underline">
            {value}
          </a>
        );
      default:
        return value;
    }
  };

  return (
    <div className="space-y-3">
      {title && <div className="text-lg font-semibold text-text-headings">{title}</div>}
      <div className="bg-surface-primary rounded-xl border border-border-primary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-action border-b border-border-primary">
                {headers.map((header, index) => (
                  <th
                    key={index}
                    className={`px-4 py-3 text-left text-sm font-semibold text-text-on-action ${
                      getColumnType(index) === 'number' || getColumnType(index) === 'currency' ? 'text-right' : ''
                    }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {validRows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-border-primary last:border-b-0 bg-surface-primary hover:bg-surface-hover transition-colors"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`px-4 py-3 text-sm text-text-body ${
                        getColumnType(cellIndex) === 'number' || getColumnType(cellIndex) === 'currency'
                          ? 'text-right'
                          : ''
                      }`}
                    >
                      {formatCellValue(String(cell), getColumnType(cellIndex))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {validRows.length === 0 && <div className="text-center py-8 text-text-body text-sm">No data available</div>}
    </div>
  );
};
