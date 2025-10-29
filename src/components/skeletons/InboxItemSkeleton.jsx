import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function InboxItemSkeleton() {
  return (
    <Card className="p-4 rounded-xl bg-white border-none">
      <div className="flex items-center gap-4 animate-pulse">
        <Skeleton className="w-14 h-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="h-3 w-1/4 rounded" />
          </div>
          <Skeleton className="h-3 w-4/5 rounded" />
          <div className="flex gap-2">
             <Skeleton className="h-5 w-1/4 rounded-full" />
             <Skeleton className="h-5 w-1/5 rounded-full" />
          </div>
        </div>
      </div>
    </Card>
  );
}