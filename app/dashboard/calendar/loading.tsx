import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <Card className="border-slate-200">
        <CardHeader className="bg-slate-50 border-b border-slate-200">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden h-[400px] bg-slate-200">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-full min-h-[60px]" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
