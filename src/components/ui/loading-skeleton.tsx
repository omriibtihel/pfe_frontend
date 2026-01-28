import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div className={cn("animate-pulse bg-muted rounded", className)} />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <LoadingSkeleton className="h-4 w-1/3" />
      <LoadingSkeleton className="h-8 w-1/2" />
      <LoadingSkeleton className="h-4 w-2/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="border-b border-border p-4">
        <LoadingSkeleton className="h-6 w-1/4" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <LoadingSkeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <LoadingSkeleton className="h-4 w-1/3" />
              <LoadingSkeleton className="h-3 w-1/4" />
            </div>
            <LoadingSkeleton className="h-8 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <LoadingSkeleton className="h-8 w-48" />
          <LoadingSkeleton className="h-4 w-72" />
        </div>
        <LoadingSkeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <TableSkeleton />
    </div>
  );
}

export default LoadingSkeleton;
