'use client';

import { type ReactNode, createContext, useContext, useMemo } from 'react';

const CategoryDisplayLabelIndexContext = createContext<Record<string, string>>({});

export function CategoryDisplayLabelIndexProvider({
  labelIndex,
  children,
}: {
  labelIndex: Record<string, string>;
  children: ReactNode;
}) {
  const value = useMemo(() => labelIndex, [labelIndex]);
  return (
    <CategoryDisplayLabelIndexContext.Provider value={value}>{children}</CategoryDisplayLabelIndexContext.Provider>
  );
}

export function useCategoryDisplayLabelIndex(): Record<string, string> {
  return useContext(CategoryDisplayLabelIndexContext);
}
