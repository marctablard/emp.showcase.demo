'use client';

import React, { useCallback, useMemo } from 'react';
import type { Layout, Layouts } from 'react-grid-layout';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { isEqual } from 'lodash';
import { breakpoints } from '@/lib/breakpoints';
import { useLocalDashboardStore } from '@/lib/client/dashboard';
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

  const layoutItems = useMemo(() => {
    return [
      <div key="ai-helper" className="h-full relative">
        <AiHelperCard className="h-full" />
      </div>,
      <div key="weather" className="h-full overflow-auto relative">
        <WeatherCard className="h-full" />
      </div>,
      <div key="notification" className="h-full relative">
        <NotificationCard className="h-full" />
      </div>,
      <div key="ticket" className="h-full relative">
        <TicketCard className="h-full" />
      </div>,
      <div key="orders" className="h-full relative">
        <MyOrdersCard className="h-full" />
      </div>,
      <div key="invoices" className="h-full relative">
        <MyInvoicesCard className="h-full" />
      </div>,
      <div key="documents" className="h-full relative">
        <DocumentsCard className="h-full" />
      </div>,
    ];
  }, []);

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
