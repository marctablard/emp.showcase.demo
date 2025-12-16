'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApprovals } from '@/hooks/approval/useApprovals';
import { Approval, ApprovalStatus } from '@/platform/services/model/approval';
import { ApprovalStatusBadge } from './approval-status-badge';

interface ApprovalsListProps {
  initialApprovals?: Approval[];
}

export function ApprovalsList({ initialApprovals }: ApprovalsListProps) {
  const t = useTranslations('orders.Approval');
  const tStatus = useTranslations('orders.ApprovalStatus');
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus | ''>('');
  const [filterResourceType, setFilterResourceType] = useState<string>('');

  const { approvals, loading, error, filterApprovals, refreshApprovals } = useApprovals(initialApprovals);

  const handleFilter = () => {
    const filter: Partial<Approval> = {};

    if (filterStatus) {
      filter.status = filterStatus;
    }

    /*
    if (filterResourceType) {
      filter.resourceType = filterResourceType;
    }
    */

    filterApprovals(filter);
  };

  const handleClearFilter = () => {
    setFilterStatus('');
    setFilterResourceType('');
    refreshApprovals();
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
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as ApprovalStatus)}>
              <SelectTrigger>
                <SelectValue placeholder={t('filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('allStatuses')}</SelectItem>
                <SelectItem value="PENDING">{tStatus('PENDING')}</SelectItem>
                <SelectItem value="APPROVED">{tStatus('APPROVED')}</SelectItem>
                <SelectItem value="DECLINED">{tStatus('DECLINED')}</SelectItem>
                <SelectItem value="EXPIRED">{tStatus('EXPIRED')}</SelectItem>
                <SelectItem value="CLOSED">{tStatus('CLOSED')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder={t('filterByResourceType')}
              value={filterResourceType}
              onChange={(e) => setFilterResourceType(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleFilter}>{t('filter')}</Button>
            <Button variant="neutral" onClick={handleClearFilter}>
              {t('clearFilter')}
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('id')}</TableHead>
                <TableHead>{t('resourceType')}</TableHead>
                <TableHead>{t('action')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('requestor')}</TableHead>
                <TableHead>{t('approver')}</TableHead>
                <TableHead>{t('createdAt')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((approval) => (
                <TableRow key={approval.id}>
                  <TableCell className="font-medium">{approval.id}</TableCell>
                  <TableCell>{approval.resourceType}</TableCell>
                  <TableCell>{approval.action}</TableCell>
                  <TableCell>
                    <ApprovalStatusBadge status={approval.status} />
                  </TableCell>
                  <TableCell>{approval.requestor.userId}</TableCell>
                  <TableCell>{approval.approver.userId}</TableCell>
                  <TableCell>{formatDate(approval.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={`/account/company/approval/${approval.id}`} passHref>
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
      </CardContent>
    </Card>
  );
}
