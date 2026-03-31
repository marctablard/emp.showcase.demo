import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export default function DefaultMainLayout({ children }: Props) {
  return <main className="flex-grow mt-17 sm:mt-36 md:mt-52">{children}</main>;
}
