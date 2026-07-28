'use client';

import { useTheme } from 'next-themes';
import type { ToasterProps } from 'sonner';
import { Toaster as Sonner } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group mx-auto"
      data-x-position="right"
      expand
      visibleToasts={9}
      style={
        {
          '--width': '90%',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
