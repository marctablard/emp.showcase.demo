import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export default function DefaultMainLayout({ children }: Props) {
  // Clearance for the fixed header (same tokens as CMS pages / pre-COP-4863).
  return <main className="flex-grow mt-17 sm:mt-36 md:mt-52">{children}</main>;
}
