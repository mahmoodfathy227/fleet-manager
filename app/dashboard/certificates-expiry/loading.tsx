import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Filter tabs skeleton */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl">
        <div className="flex space-x-8 px-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="py-4">
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Tables skeleton */}
      <div className="space-y-6">
        <TableSkeleton
          rows={5}
          columns={5}
          headers={['Name', 'Identifier', 'Certificate Type', 'Expiry Date', 'Days Remaining']}
        />
      </div>
    </div>
  )
}

