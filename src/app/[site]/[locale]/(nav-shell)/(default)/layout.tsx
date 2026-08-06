import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export default function DefaultMainLayout({ children }: Props) {
  return <main className="flex-grow mt-17 sm:mt-30 md:mt-44">{children}</main>;
}
