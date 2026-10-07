import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export default function NoMarginMainLayout({ children }: Props) {
  return <main>{children}</main>;
}
