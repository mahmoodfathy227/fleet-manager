import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> { }

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-slate-200',
        className
      )}
      role="status"
      aria-label="Loading..."
      {...props}
    />
  )
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  headers
}: {
  rows?: number
  columns?: number
  headers?: string[]
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" role="status" aria-label="Loading table...">
      <div className="w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              {headers ? (
                headers.map((header, i) => (
                  <th
                    key={i}
                    className={cn(
                      'h-12 px-4 text-left align-middle font-semibold text-slate-700',
                      i === 0 && 'rounded-tl-xl',
                      i === headers.length - 1 && 'rounded-tr-xl'
                    )}
                  >
                    {header}
                  </th>
                ))
              ) : (
                Array.from({ length: columns }).map((_, i) => (
                  <th
                    key={i}
                    className={cn(
                      'h-12 px-4 text-left align-middle font-semibold text-slate-700',
                      i === 0 && 'rounded-tl-xl',
                      i === columns - 1 && 'rounded-tr-xl'
                    )}
                  >
                    <div className="h-4 w-24 rounded-md bg-slate-200" />
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  'border-b border-slate-100',
                  rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                )}
              >
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="p-4 align-middle">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" role="status" aria-label="Loading card...">
      <div className="bg-slate-50 border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-4">
        <Skeleton className="h-5 w-1/3" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  )
}

export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" role="status" aria-label="Loading form...">
      <Skeleton className="mb-6 h-7 w-1/4" />
      <div className="space-y-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <div className="flex justify-end space-x-3 pt-4">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

export function DetailViewSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading details...">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <div className="flex space-x-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <CardSkeleton />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-40 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <StatsSkeleton />
      <div className="grid gap-6 md:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  )
}
