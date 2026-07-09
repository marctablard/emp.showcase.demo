'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { FileText, List, Receipt, Settings } from 'lucide-react';
import {
  AccountDetailContainer,
  AccountDetailHeader,
  AccountDetailStatus,
} from '@/components/account/shared/account-detail';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProject } from '@/hooks/projects/useProject';
import { useRouter } from '@/i18n/navigation';
import { ProjectDocumentsTab } from './project-documents-tab';
import { ProjectOrdersTab } from './project-orders-tab';
import { ProjectOverviewTab } from './project-overview-tab';
import { ProjectShoppingListsTab } from './project-shopping-lists-tab';
import { ProjectStatusBadge } from './project-status-badge';

interface ProjectDetailProps {
  projectId: string;
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const t = useTranslations('account.projects');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeTab = searchParams.get('tab') ?? 'overview';

  const {
    project,
    shoppingLists,
    media,
    loading,
    error,
    updateProject,
    createShoppingList,
    deleteShoppingList,
    addItemToList,
    removeItemFromList,
    addListToCart,
    uploadMedia,
    deleteMedia,
  } = useProject(projectId);

  useEffect(() => {}, []);

  const handleTabChange = (tab: string) => {
    router.replace(`/account/projects/${projectId}?tab=${tab}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center border border-border-primary bg-surface-page">
        <Spinner color="primary" variant="md" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="border border-border-primary bg-surface-page p-6 text-center">
        <p className="text-text-error">{error?.message ?? t('notFound')}</p>
        <UiLink type="Link" href="/account/projects" variant="primary" size="m" className="mt-4 inline-block">
          {t('backToProjects')}
        </UiLink>
      </div>
    );
  }

  const name =
    (project.name as Record<string, string>)?.[locale] ?? (project.name as Record<string, string>)?.en ?? project.id;

  return (
    <AccountDetailContainer>
      <AccountDetailHeader
        eyebrow={t('projectDetails')}
        title={name}
        aside={
          <AccountDetailStatus label={t('status')}>
            <ProjectStatusBadge status={project.status} emphasized />
          </AccountDetailStatus>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid h-auto w-full grid-cols-4 rounded-none border-b-2 border-border-primary bg-surface-image-background p-0">
          {(
            [
              { value: 'overview', icon: <Settings className="h-5 w-5" />, label: t('tabs.overview') },
              { value: 'shoppingLists', icon: <List className="h-5 w-5" />, label: t('tabs.shoppingLists') },
              { value: 'orders', icon: <Receipt className="h-5 w-5" />, label: t('tabs.orders') },
              { value: 'documents', icon: <FileText className="h-5 w-5" />, label: t('tabs.documents') },
            ] as const
          ).map(({ value, icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="-mb-0.5 gap-2 rounded-none border-r border-b-2 border-r-border-primary border-b-transparent
                bg-transparent px-4 py-3.5 text-sm font-medium text-text-placeholders shadow-none transition-colors
                last:border-r-0
                data-[state=active]:border-b-border-action data-[state=active]:font-semibold
                data-[state=active]:text-text-headings data-[state=active]:shadow-none
                [&_svg]:opacity-50 [&_svg]:data-[state=active]:opacity-100
                hover:bg-surface-page/50 hover:text-text-body"
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <ProjectOverviewTab project={project} onSave={updateProject} />
        </TabsContent>

        <TabsContent value="shoppingLists" className="mt-0">
          <ProjectShoppingListsTab
            projectId={projectId}
            lists={shoppingLists}
            onCreateList={createShoppingList}
            onDeleteList={deleteShoppingList}
            onAddItem={addItemToList}
            onRemoveItem={removeItemFromList}
            onAddToCart={addListToCart}
          />
        </TabsContent>

        <TabsContent value="orders" className="mt-0">
          <ProjectOrdersTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="documents" className="mt-0">
          <ProjectDocumentsTab media={media} onUpload={uploadMedia} onDelete={deleteMedia} />
        </TabsContent>
      </Tabs>
    </AccountDetailContainer>
  );
}
