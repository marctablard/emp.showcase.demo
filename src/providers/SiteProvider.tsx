'use client';
import { ReactNode, createContext, useContext } from 'react';

export const SiteContext = createContext<string | undefined>(undefined);
type Props = {
  children: ReactNode;
  siteCode: string;
};

export default function SiteProvider({ children, siteCode }: Props) {
  const prevSiteCode = useContext(SiteContext);
  return <SiteContext.Provider value={prevSiteCode || siteCode}>{children}</SiteContext.Provider>;
}
