import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DriverCardSkeleton() {
  return (
    <Card className="p-4 rounded-2xl bg-white border-none shadow-sm">
      <div className="flex items-start gap-4 animate-pulse">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-3/5 rounded" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-1/4 rounded-full" />
            <Skeleton className="h-4 w-1/4 rounded-full" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-4 w-1/5 rounded" />
            <Skeleton className="h-4 w-1/5 rounded" />
            <Skeleton className="h-4 w-1/5 rounded" />
          </div>
        </div>
      </div>
      <Skeleton className="w-full h-12 mt-4 rounded-xl" />
    </Card>
  );
}