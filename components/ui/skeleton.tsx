import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200/70', className)}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <div className="pt-2 flex gap-2">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-3.5 px-4">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

