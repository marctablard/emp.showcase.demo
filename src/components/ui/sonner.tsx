'use client';

import { useTheme } from 'next-themes';
import type { ToasterProps } from 'sonner';
import { Toaster as Sonner } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group mx-Auto"
      data-x-position="right"
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
