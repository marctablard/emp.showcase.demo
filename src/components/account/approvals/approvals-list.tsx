'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { APPROVALS_PER_PAGE } from '@/components/account/account-table-constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useApprovals } from '@/hooks/approval/useApprovals';
import type { Approval, ApprovalStatus } from '@/platform/services/model/approval';
import { ApprovalStatusBadge } from './approval-status-badge';

interface ApprovalsListProps {
  initialApprovals?: Approval[];
}

export function ApprovalsList({ initialApprovals }: ApprovalsListProps) {
  const t = useTranslations('orders.Approval');
  const tStatus = useTranslations('orders.ApprovalStatus');
  const tAction = useTranslations('orders.ApprovalAction');
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus | '_ALL_'>('_ALL_');
  const [currentPage, setCurrentPage] = useState(1);
  const { approvals, loading, error, filterApprovals, refreshApprovals } = useApprovals(initialApprovals);

  const totalPages = Math.max(1, Math.ceil(approvals.length / APPROVALS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const visibleApprovals = useMemo(
    () => approvals.slice((safeCurrentPage - 1) * APPROVALS_PER_PAGE, safeCurrentPage * APPROVALS_PER_PAGE),
    [approvals, safeCurrentPage],
  );

  const handleFilter = (status: ApprovalStatus | '_ALL_') => {
    const filter: Partial<Approval> = {};
    setFilterStatus(status);
    setCurrentPage(1);
    if (status !== '_ALL_') {
      filter.status = status;
    }
    filterApprovals(filter);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('approvalsList')}</CardTitle>
          <CardDescription>{t('approvalsListDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="flex flex-col items-center space-y-2">
            <Spinner color="primary" variant="md" />
            <div>{t('loading')}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('approvalsList')}</CardTitle>
          <CardDescription>{t('approvalsListDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-surface-error p-4 rounded-md text-text-error">
            {t('errorLoadingApprovals')}: {error.message}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => refreshApprovals()}>{t('tryAgain')}</Button>
        </CardFooter>
      </Card>
    );
  }

  if (approvals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('approvalsList')}</CardTitle>
          <CardDescription>{t('approvalsListDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-text-placeholders">{t('noApprovalsFound')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('approvalsList')}</CardTitle>
        <CardDescription>{t('approvalsListDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Select value={filterStatus} onValueChange={(value) => handleFilter(value as ApprovalStatus)}>
              <SelectTrigger>
                <SelectValue placeholder={t('filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_ALL_">{t('allStatuses')}</SelectItem>
                <SelectItem value="PENDING">{tStatus('PENDING')}</SelectItem>
                <SelectItem value="APPROVED">{tStatus('APPROVED')}</SelectItem>
                <SelectItem value="DECLINED">{tStatus('DECLINED')}</SelectItem>
                <SelectItem value="EXPIRED">{tStatus('EXPIRED')}</SelectItem>
                <SelectItem value="CLOSED">{tStatus('CLOSED')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('id')}</TableHead>
                <TableHead>{t('action')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('requestor')}</TableHead>
                <TableHead>{t('approver')}</TableHead>
                <TableHead>{t('createdAt')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleApprovals.map((approval) => (
                <TableRow key={approval.id}>
                  <TableCell className="font-medium">{approval.id}</TableCell>
                  <TableCell>{tAction(approval.action)}</TableCell>
                  <TableCell>
                    <ApprovalStatusBadge status={approval.status} />
                  </TableCell>
                  <TableCell>{approval.requestor.userId}</TableCell>
                  <TableCell>{approval.approver.userId}</TableCell>
                  <TableCell>{formatDate(approval.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={`/account/approvals/${approval.id}`} passHref>
                      <Button variant="link" size="default">
                        {t('view')}
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          className="px-3"
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          pageIndicator={t('pageIndicator', { current: safeCurrentPage, total: totalPages })}
          previousLabel={t('previous')}
          nextLabel={t('next')}
          onPreviousPage={() => setCurrentPage((p) => Math.max(1, Math.min(p, totalPages) - 1))}
          onNextPage={() => setCurrentPage((p) => Math.min(totalPages, Math.min(p, totalPages) + 1))}
        />
      </CardContent>
    </Card>
  );
}
