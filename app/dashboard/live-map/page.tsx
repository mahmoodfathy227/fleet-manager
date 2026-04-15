import LiveOperationsPanel from '@/app/dashboard/LiveOperationsPanel'
import { MapPinned } from 'lucide-react'

export default function LiveMapPage() {
  console.debug('[fleet-dashboard] live-map: full LiveOperationsPanel (map + details)')

  return (
    <div className="space-y-5 max-w-[1800px] mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Live Fleet Map</h1>
          <p className="text-sm text-slate-500">
            Full-screen live map for active and idle vehicle locations.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
          <MapPinned className="h-4 w-4 text-slate-500" />
          Map view
        </div>
      </div>

      <LiveOperationsPanel mode="full-screen" />
    </div>
  )
}
