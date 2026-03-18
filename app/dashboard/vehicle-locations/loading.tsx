import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-10 w-56 rounded-lg" />
      </div>

      <TableSkeleton 
        rows={8} 
        columns={7}
        headers={['Spare Vehicle', 'Status', 'Location Name', 'Address', 'Coordinates', 'Last Updated', 'Actions']}
      />
    </div>
  )
}

