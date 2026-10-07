'use client';

import React, { useCallback, useMemo } from 'react';
import type { Layout, Layouts } from 'react-grid-layout';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { isEqual } from 'lodash';
import { breakpoints } from '@/lib/breakpoints';
import { useLocalDashboardStore } from '@/lib/client/dashboard';
import { cn } from '@/lib/utils';
import { AiHelperCard } from './cards/ai-helper-card';
import { DocumentsCard } from './cards/documents-card';
import { MyInvoicesCard } from './cards/my-invoices-card';
import { MyOrdersCard } from './cards/my-orders-card';
import { NotificationCard } from './cards/notification-card';
import { TicketCard } from './cards/ticket-card';
// Import card components from the cards folder
import { WeatherCard } from './cards/weather-card';

// Created once at module scope: calling WidthProvider() during render produces a new component
// type on every render, which remounts the whole grid and drops its DOM/measurement state.
const ResponsiveReactGridLayout = WidthProvider(Responsive);

interface DashboardProps {
  isCustomizable: boolean;
  layouts: Layouts;
  layoutChanged: (layouts: Layouts) => void;
}

export default function Dashboard({ isCustomizable, layouts, layoutChanged }: DashboardProps) {
  // Subscribe to the setters only — the store deliberately holds layout state that must not
  // re-render this component when it changes.
  const setCurrentBreakpoint = useLocalDashboardStore((s) => s.setCurrentBreakpoint);
  const setCurrentLayout = useLocalDashboardStore((s) => s.setCurrentLayout);

  const onBreakpointChange = (breakpoint: string) => {
    setCurrentBreakpoint(breakpoint);
  };

  const onLayoutChange = useCallback(
    (layout: Layout[], newLayouts: Layouts) => {
      if (!isEqual(layouts, newLayouts)) {
        layoutChanged(newLayouts);
      }
      // Read through getState() so this callback does not need the layout as a dependency.
      const currentLayout = useLocalDashboardStore.getState().currentLayout;
      if (!isEqual(layout, currentLayout)) {
        setCurrentLayout(layout);
      }
    },
    [layouts, layoutChanged, setCurrentLayout],
  );

  // GridItem only re-renders when its children change, so a toggle of isDraggable/isResizable alone
  // never reaches the items: the children must depend on isCustomizable. Same keys keep card state.
  const layoutItems = useMemo(() => {
    const itemClass = cn('h-full relative', isCustomizable && 'cursor-move');
    return [
      <div key="ai-helper" className={itemClass}>
        <AiHelperCard className="h-full" />
      </div>,
      <div key="weather" className={cn(itemClass, 'overflow-auto')}>
        <WeatherCard className="h-full" />
      </div>,
      <div key="notification" className={itemClass}>
        <NotificationCard className="h-full" />
      </div>,
      <div key="ticket" className={itemClass}>
        <TicketCard className="h-full" />
      </div>,
      <div key="orders" className={itemClass}>
        <MyOrdersCard className="h-full" />
      </div>,
      <div key="invoices" className={itemClass}>
        <MyInvoicesCard className="h-full" />
      </div>,
      <div key="documents" className={itemClass}>
        <DocumentsCard className="h-full" />
      </div>,
    ];
  }, [isCustomizable]);

  return (
    <div className="relative">
      <ResponsiveReactGridLayout
        layouts={layouts}
        measureBeforeMount={false}
        onBreakpointChange={onBreakpointChange}
        onLayoutChange={onLayoutChange}
        breakpoints={{ lg: breakpoints.lg, md: breakpoints.md, sm: breakpoints.sm }}
        cols={{ lg: 3, md: 3, sm: 1 }}
        rowHeight={20}
        isDraggable={isCustomizable}
        isResizable={isCustomizable}
      >
        {layoutItems}
      </ResponsiveReactGridLayout>
    </div>
  );
}
