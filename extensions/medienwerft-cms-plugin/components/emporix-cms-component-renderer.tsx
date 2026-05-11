'use client';

import { useContext, useMemo } from 'react';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import client from '@/platform/client';
import type { CMSComponent } from '@/platform/services/model/cms';
import { EmporixCMSContext } from '../context/emporix-cms-context';
import type { CMSComponentService } from '../services/CMSComponentService';
import CMSSetupMissingDialog from './cms-setup-missing-banner';

interface EmporixCMSComponentRendererProps {
  components: CMSComponent[];
  theme?: string;
}

/**
 * Renders CMS components based on their type.
 * Applies highlight styling when a component is selected in the editor.
 */
export default function EmporixCMSComponentRenderer({ components, theme }: EmporixCMSComponentRendererProps) {
  const context = useContext(EmporixCMSContext);
  const highlightedComponentId = context?.highlightedComponentId ?? null;
  const isEditorMode = context?.isEditorMode ?? false;

  // The DI binding is a singleton — `theme` is only a per-call arg to
  // `getDefinition`, not a service-scoping dimension — so we resolve once.
  const definitionService = useMemo<CMSComponentService | null>(() => {
    if (!client.isBound('EmporixCMSComponentService')) return null;
    return client.get<CMSComponentService>('EmporixCMSComponentService');
  }, []);

  if (!definitionService) {
    return <CMSSetupMissingDialog />;
  }

  const renderComponent = (component: CMSComponent) => {
    const entry = definitionService.getDefinition(component.type, theme);

    if (!entry) {
      getLogger().warn({ componentType: component.type }, 'Component type not found in definition map');
      return null;
    }

    const Component = entry.component;
    const mappedProps = entry.mapProps(component.props);

    if (isEditorMode) {
      return (
        <div
          key={component.id}
          className={
            highlightedComponentId === component.id
              ? cn('ring-2 ring-offset-2 [--tw-ring-color:var(--color-cms-highlight)]')
              : ''
          }
          data-component-id={component.id}
        >
          <Component {...mappedProps} />
        </div>
      );
    }

    return <Component key={component.id} {...mappedProps} />;
  };

  return <>{components.map(renderComponent)}</>;
}
