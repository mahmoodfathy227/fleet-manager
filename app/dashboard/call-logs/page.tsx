import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/Button'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Plus, Phone } from 'lucide-react'
import { CallLogsTableClient } from './CallLogsTableClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function CallLogsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
            <Phone className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Call Logs</h1>
            <p className="text-sm text-slate-500">Track all phone calls and communications</p>
          </div>
        </div>
        <Link href="/dashboard/call-logs/create" prefetch={true}>
          <Button className="bg-primary hover:bg-primary/90 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Log Call
          </Button>
        </Link>
      </div>

      <Suspense fallback={<TableSkeleton rows={5} columns={8} />}>
        <CallLogsTableClient />
      </Suspense>
    </div>
  )
}
