import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50 border-b border-slate-200">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="pt-6">
            <TableSkeleton rows={7} columns={1} />
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50 border-b border-slate-200">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="pt-6">
            <TableSkeleton rows={3} columns={1} />
          </CardContent>
        </Card>
        <div className="md:col-span-2">
          <Card className="border-slate-200">
            <CardHeader className="bg-slate-50 border-b border-slate-200">
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

