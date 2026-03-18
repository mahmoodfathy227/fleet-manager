import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>

      <TableSkeleton 
        rows={8} 
        columns={8}
        headers={['Employee ID', 'Full Name', 'Phone', 'Status', 'TAS Badge Number', 'TAS Badge Expiry', 'DBS Number', 'Actions']}
      />
    </div>
  )
}

