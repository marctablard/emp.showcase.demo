import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { ProjectStatus } from '@/platform/services/model/project/project';

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
}

const statusVariantMap: Record<ProjectStatus, 'information' | 'success' | 'warning'> = {
  open: 'success',
  hold: 'warning',
  closed: 'information',
};

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const t = useTranslations('account.projects.statuses');
  return (
    <Badge variant={statusVariantMap[status]} size="status">
      {t(status)}
    </Badge>
  );
}
