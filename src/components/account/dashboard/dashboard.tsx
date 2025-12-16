'use client';

import React, { useCallback, useMemo } from 'react';
import { Layout, Layouts, Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { isEqual } from 'lodash';
import { useLocalDashboardStore } from '@/lib/client/dashboard';
import { AiHelperCard } from './cards/ai-helper-card';
import { DocumentsCard } from './cards/documents-card';
import { MyInvoicesCard } from './cards/my-invoices-card';
import { MyOrdersCard } from './cards/my-orders-card';
import { NotificationCard } from './cards/notification-card';
import { TicketCard } from './cards/ticket-card';
// Import card components from the cards folder
import { WeatherCard } from './cards/weather-card';

interface DashboardProps {
  isCustomizable: boolean;
  layouts: Layouts;
  layoutChanged: (layouts: Layouts) => void;
}

export default function Dashboard({ isCustomizable, layouts, layoutChanged }: DashboardProps) {
  const state = useLocalDashboardStore();

  const ResponsiveReactGridLayout = WidthProvider(Responsive);

  const onBreakpointChange = (breakpoint: string) => {
    state.currentBreakpoint = breakpoint;
  };

  const onLayoutChange = useCallback(
    (layout: Layout[], newLayouts: Layouts) => {
      if (!isEqual(layouts, newLayouts)) {
        // TODO this triggers a re-render of the dashboard component
        // when it changes the state of the Config-Store... no idea why
        layoutChanged(newLayouts);
      }
      const currentLayout = state.currentLayout;
      if (!isEqual(layout, currentLayout)) {
        state.currentLayout = layout;
      }
    },
    [layouts, layoutChanged, state],
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
        breakpoints={{ lg: 1280, md: 1024, sm: 768 }}
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
