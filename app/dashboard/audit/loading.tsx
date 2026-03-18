import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>

      <TableSkeleton 
        rows={10} 
        columns={6}
        headers={['ID', 'Table', 'Record ID', 'Action', 'Changed By', 'Change Time']}
      />
    </div>
  )
}

