import { Sidebar } from '@/components/dashboard/Sidebar'
import { RouteGuard } from '@/components/dashboard/RouteGuard'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RouteGuard>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="min-h-full p-4 lg:p-8 max-w-full">
            {children}
          </div>
        </main>
      </div>
    </RouteGuard>
  )
}
