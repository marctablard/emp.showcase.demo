'use client';

import React, { useTransition } from 'react';
import { acquireNavigationWaitCursorLease, useGlobalCursor } from '@/hooks/common/useGlobalCursor';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { getBrowseTargetSignature } from '@/utils/browseNavigation';

export function PlpPendingLink({ href, children, className, ...props }: React.ComponentProps<typeof Link>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useGlobalCursor(isPending);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Let browser handle modifier keys/middle clicks normally (open in new tab etc)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }

    // For standard clicks, use transition to show loading feedback
    if (e.defaultPrevented) return;
    e.preventDefault();
    const browseTargetSignature = typeof href === 'string' ? getBrowseTargetSignature(href) : null;

    if (browseTargetSignature) {
      acquireNavigationWaitCursorLease(browseTargetSignature);
    }

    startTransition(() => {
      // @ts-expect-error - router.push types might complain about string but it's fine for our navigation wrapper
      router.push(href);
    });
  };

  return (
    <>
      <Link href={href} onClick={handleClick} className={className} {...props}>
        {children}
      </Link>
      {isPending && <div className="fixed inset-0 z-[99999]" aria-hidden="true" />}
    </>
  );
}
