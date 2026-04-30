'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { FileText, List, Receipt, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { H2 } from '@/components/ui/h';
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
      <div className="flex justify-center items-center min-h-[300px]">
        <Spinner color="primary" variant="md" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-text-error">{error?.message ?? t('notFound')}</p>
          <UiLink type="Link" href="/account/projects" variant="primary" size="m" className="mt-4 inline-block">
            {t('backToProjects')}
          </UiLink>
        </CardContent>
      </Card>
    );
  }

  const name =
    (project.name as Record<string, string>)?.[locale] ?? (project.name as Record<string, string>)?.en ?? project.id;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <H2 variant="h4">{name}</H2>
            <ProjectStatusBadge status={project.status} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full h-auto p-0 bg-transparent rounded-none border-b border-border-primary grid grid-cols-4">
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
              className="gap-2 rounded-none px-4 py-3 bg-transparent shadow-none
                text-text-secondary font-medium text-base
                data-[state=active]:bg-transparent data-[state=active]:shadow-none
                data-[state=active]:text-text-headings data-[state=active]:font-semibold
                [&_svg]:data-[state=active]:opacity-100 [&_svg]:opacity-50
                hover:text-text-body hover:bg-transparent transition-colors"
            >
              {icon}
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview">
            <ProjectOverviewTab project={project} onSave={updateProject} />
          </TabsContent>

          <TabsContent value="shoppingLists">
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

          <TabsContent value="orders">
            <ProjectOrdersTab projectId={projectId} />
          </TabsContent>

          <TabsContent value="documents">
            <ProjectDocumentsTab media={media} onUpload={uploadMedia} onDelete={deleteMedia} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
