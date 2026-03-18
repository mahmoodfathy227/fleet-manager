import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      <TableSkeleton 
        rows={8} 
        columns={8}
        headers={['Date/Time', 'Caller', 'Type', 'Subject', 'Related To', 'Priority', 'Status', 'Actions']}
      />
    </div>
  )
}

