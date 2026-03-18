import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      <TableSkeleton 
        rows={8} 
        columns={8}
        headers={['ID', 'Vehicle Identifier', 'Registration', 'Make/Model', 'Vehicle Type', 'Status', 'MOT Date', 'Actions']}
      />
    </div>
  )
}

