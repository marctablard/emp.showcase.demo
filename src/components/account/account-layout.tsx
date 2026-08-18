'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  HandHelping,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  PackageMinus,
  Percent,
  Pin,
  Receipt,
  Settings,
  User,
  UserCog,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { BreadcrumbContent } from '@/lib/breadcrumb';
import { UiBreadcrumb } from '../ui/molecules/ui-breadcrumb';
import { AccountSidebar } from './account-sidebar';

interface AccountLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbContent[];
}

export function AccountLayout({ children, breadcrumbs }: AccountLayoutProps) {
  const t = useTranslations('account');
  const [showSidebarOffcanvas, setShowSidebarOffcanvas] = useState(false);
  // Figma: the persistent sidebar appears from tablet (768) up; only below that a drawer is used.
  const isDesktop = useBreakpoint('sm');

  // Toggle sidebar offcanvas visibility
  const toggleSidebarOffcanvas = () => {
    setShowSidebarOffcanvas(!showSidebarOffcanvas);
  };

  useEffect(() => {
    if (!showSidebarOffcanvas) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [showSidebarOffcanvas]);

  // Dashboard (standalone item)
  const sidebarItems = [
    {
      href: '/account',
      title: t('sidebar.dashboard'),
      icon: <LayoutDashboard className="h-6 w-6" />,
      active: true,
    },
  ];

  // Sidebar groups with their items
  const sidebarGroups = [
    {
      title: t('sidebar.groups.selfService'),
      items: [
        {
          href: '/account/tickets',
          title: t('sidebar.items.supportTickets'),
          icon: <HandHelping className="h-6 w-6" />,
          counter: 4,
          badgeVariant: 'success' as const,
        },
        {
          href: '/account/calendar',
          title: t('sidebar.items.serviceCalendar'),
          icon: <CalendarDays className="h-6 w-6" />,
        },
        {
          href: '/account/training',
          title: t('sidebar.items.trainingMaterial'),
          icon: <BookOpen className="h-6 w-6" />,
          counter: 1,
        },
      ],
    },
    {
      title: t('sidebar.groups.orderManagement'),
      items: [
        {
          href: '/account/approvals',
          title: t('sidebar.items.approvals'),
          icon: <ClipboardCheck className="h-6 w-6" />,
        },
        {
          href: '/account/orders',
          title: t('sidebar.items.orderHistory'),
          icon: <History className="h-6 w-6" />,
        },
        {
          href: '/account/invoices',
          title: t('sidebar.items.invoicesPayments'),
          icon: <Receipt className="h-6 w-6" />,
        },
        {
          href: '/account/quotes',
          title: t('sidebar.items.quotes'),
          icon: <Percent className="h-6 w-6" />,
        },
        {
          href: '/account/returns',
          title: t('sidebar.items.returnsClaims'),
          icon: <PackageMinus className="h-6 w-6" />,
          counter: 1,
        },
      ],
    },
    {
      title: t('sidebar.groups.myOrganisation'),
      items: [
        {
          href: '/account/wishlists',
          title: t('sidebar.items.wishlists'),
          icon: <Pin className="h-6 w-6" />,
        },
        {
          href: '/account/products',
          title: t('sidebar.items.productsMaintenance'),
          icon: <Wrench className="h-6 w-6" />,
        },
        {
          href: '/account/company',
          title: t('sidebar.items.companyManagement'),
          icon: <Building2 className="h-6 w-6" />,
        },
        {
          href: '/account/addresses',
          title: t('sidebar.items.addressManagement'),
          icon: <MapPin className="h-6 w-6" />,
        },
        {
          href: '/account/users',
          title: t('sidebar.items.userManagement'),
          icon: <UserCog className="h-6 w-6" />,
        },
        {
          href: '/account/payment-options',
          title: t('sidebar.items.paymentOptions'),
          icon: <CreditCard className="h-6 w-6" />,
        },
        {
          href: '/account/contracts',
          title: t('sidebar.items.contractsAgreements'),
          icon: <FileText className="h-6 w-6" />,
          counter: 1,
        },
      ],
    },
    {
      title: t('sidebar.groups.myAccount'),
      items: [
        {
          href: '/account/profile',
          title: t('sidebar.items.personalData'),
          icon: <User className="h-6 w-6" />,
        },
        {
          href: '/account/settings',
          title: t('sidebar.items.accountSettings'),
          icon: <Settings className="h-6 w-6" />,
        },
        {
          href: '/account/logout',
          title: t('logout'),
          icon: <LogOut className="h-6 w-6" />,
        },
      ],
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {breadcrumbs && <UiBreadcrumb items={breadcrumbs} className="content-container md:gap-x-6" />}

      {/* Mobile Menu Button - only visible on mobile */}
      {!isDesktop && (
        <div className="px-4 py-4">
          <Button variant="secondary" onClick={toggleSidebarOffcanvas} className="w-full justify-start">
            <LayoutDashboard className="h-6 w-6" /> {t('sidebar.menu')}
          </Button>
        </div>
      )}

      {/*
        items-start + no min-h-screen: the tall desktop sidebar must not stretch <main>
        and invent empty space above the site footer.
        mt-4 / mb-4 keep a 1rem gap under breadcrumbs and above the site footer.
        sm:mx-4 / md:mx-9 (SHOW-320) align the side margins with the Figma grid.
      */}
      <div className="mt-4 mb-4 flex items-start sm:mx-4 md:mx-9">
        {/* Desktop Sidebar - always visible on desktop */}
        {isDesktop && <AccountSidebar items={sidebarItems} groups={sidebarGroups} />}

        {/* Mobile Off-canvas Sidebar */}
        {!isDesktop && showSidebarOffcanvas && (
          <>
            {/* Backdrop - closes the sidebar when clicked */}
            <div className="fixed inset-0 z-40 bg-black/20" onClick={toggleSidebarOffcanvas} aria-hidden="true" />

            {/* Keep the last menu items above the 58px mobile bottom bar. */}
            <div className="fixed left-0 top-0 bottom-[58px] h-[calc(100dvh-58px)] max-w-[320px] w-full bg-surface-page z-50 overflow-y-auto overscroll-contain shadow-lg">
              <div className="flex justify-end p-4">
                <Button variant="link" size="icon" onClick={toggleSidebarOffcanvas} className="text-black">
                  <X />
                </Button>
              </div>

              <AccountSidebar items={sidebarItems} groups={sidebarGroups} scrollable={false} />
            </div>
          </>
        )}

        <main className="@container w-full min-w-0 px-4 sm:px-0 sm:ml-4">{children}</main>
      </div>
    </div>
  );
}

export default AccountLayout;
