import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ProductTileSkeleton() {
  return (
    <Card shadow="default" rounded="md" className="border-0 gap-4 h-full flex flex-col">
      <CardHeader className="flex-shrink-0 no-underline flex-grow">
        <CardDescription className="font-medium text-base text-text-body">
          <Skeleton className="h-4 w-2/4" />
        </CardDescription>
        <CardTitle className="flex gap-2 justify-between">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-[50px] w-[50px]" />
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-64 w-full" />

        <div className="flex flex-col gap-2">
          <div className="w-full space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-1/5" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-1/5" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-1/5" />
            </div>
          </div>

          <div className="flex gap-2">
            <Skeleton className="h-10 w-30" />
            <Skeleton className="h-10 w-30" />
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <div className="flex flex-col gap-1 w-full">
          <Skeleton className="h-4 w-2/4" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex justify-between">
            <div className="flex flex-col gap-1 w-3/4">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-5 w-1/3" />
            </div>
            <Skeleton className="h-[50px] w-[50px] self-end" />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
