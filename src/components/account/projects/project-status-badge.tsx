import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { ProjectStatus } from '@/platform/services/model/project/project';

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  /** Larger treatment for detail-page headers, matching the order detail status. */
  emphasized?: boolean;
}

const statusVariantMap: Record<ProjectStatus, 'information' | 'success' | 'warning'> = {
  open: 'success',
  hold: 'warning',
  closed: 'information',
};

export function ProjectStatusBadge({ status, emphasized = false }: ProjectStatusBadgeProps) {
  const t = useTranslations('account.projects.statuses');
  return (
    <Badge
      variant={statusVariantMap[status]}
      size="status"
      className={emphasized ? 'h-10 min-h-10 px-6 text-sm tracking-[1.5px] shadow-sm' : undefined}
    >
      {t(status)}
    </Badge>
  );
}
