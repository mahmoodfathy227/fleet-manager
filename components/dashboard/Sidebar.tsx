'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { canAccessRoute } from '@/lib/permissions'
import {
  LayoutDashboard,
  Users,
  Car,
  School,
  Route,
  UserCheck,
  AlertCircle,
  ClipboardList,
  UserCog,
  MapPin,
  Phone,
  Calendar,
  CalendarDays,
  BarChart3,
  Bell,
  ChevronDown,
  Briefcase,
  TrendingUp,
  Mail,
  Shield,
  LogOut,
  Truck,
  Menu,
  X,
  Activity,
  ClipboardCheck,
  GraduationCap,
  FileCheck,
  BadgeCheck,
  FileText,
  Wrench,
  User,
} from 'lucide-react'
import { useNotificationCount } from '@/hooks/useNotificationCount'
import { useComplianceNotificationCount } from '@/hooks/useComplianceNotificationCount'
import { useRouteActivityNotificationCount } from '@/hooks/useRouteActivityNotificationCount'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

interface NavGroup {
  name: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
}

const topLevelItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Calendar', href: '/dashboard/calendar', icon: CalendarDays },
  { name: 'Compliance', href: '/dashboard/compliance', icon: ClipboardCheck },
  { name: 'Route Activity', href: '/dashboard/route-activity', icon: Activity },
  { name: 'School Overview', href: '/dashboard/school-overview', icon: GraduationCap },
  { name: 'Spares', href: '/dashboard/spares', icon: Wrench },
]

const navigationGroups: NavGroup[] = [
  {
    name: 'People',
    icon: Users,
    items: [
      { name: 'Employees', href: '/dashboard/employees', icon: Users },
      { name: 'Drivers', href: '/dashboard/drivers', icon: UserCog },
      { name: 'Passenger Assistants', href: '/dashboard/assistants', icon: UserCheck },
      { name: 'Passengers', href: '/dashboard/passengers', icon: Users },
    ],
  },
  {
    name: 'Operations',
    icon: Briefcase,
    items: [
      { name: 'Routes', href: '/dashboard/routes', icon: Route },
      { name: 'Schools', href: '/dashboard/schools', icon: School },
      { name: 'Incidents', href: '/dashboard/incidents', icon: AlertCircle },
      { name: 'Appointments', href: '/dashboard/appointments', icon: Calendar },
      { name: 'Call Logs', href: '/dashboard/call-logs', icon: Phone },
      { name: 'Email Summaries', href: '/dashboard/email-summaries', icon: Mail },
    ],
  },
  {
    name: 'Vehicles',
    icon: Car,
    items: [
      { name: 'Vehicles', href: '/dashboard/vehicles', icon: Car },
      { name: 'Vehicle Locations', href: '/dashboard/vehicle-locations', icon: MapPin },
    ],
  },
  {
    name: 'Maintenance',
    icon: ClipboardCheck,
    items: [
      { name: 'Maintenance Questions', href: '/dashboard/maintenance/questions', icon: ClipboardList },
    ],
  },
  {
    name: 'Reports',
    icon: TrendingUp,
    items: [
      { name: 'Daily Summaries', href: '/dashboard/summaries', icon: FileText },
      { name: 'Daily Vehicle Checks', href: '/dashboard/vehicle-pre-checks', icon: ClipboardList },
      { name: 'Employee Certificates', href: '/dashboard/certificates-expiry/employees', icon: BadgeCheck },
      { name: 'Vehicle Certificates', href: '/dashboard/certificates-expiry/vehicles', icon: FileCheck },
    ],
  },
  {
    name: 'Admin',
    icon: Shield,
    items: [
      { name: 'Document Requirements', href: '/dashboard/admin/document-requirements', icon: FileText },
      { name: 'Users', href: '/dashboard/admin/users', icon: Users },
      { name: 'Role Management', href: '/dashboard/admin/roles', icon: Shield },
      { name: 'User Approvals', href: '/dashboard/admin/user-approvals', icon: UserCheck },
      { name: 'Send Notification', href: '/dashboard/admin/notifications', icon: Bell },
    ],
  },
  {
    name: 'Account',
    icon: User,
    items: [
      { name: 'My Notifications', href: '/dashboard/my-notifications', icon: Bell },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { permissions, loading: permissionsLoading } = usePermissions()
  const { count: notificationCount } = useNotificationCount()
  const { count: complianceCount } = useComplianceNotificationCount()
  const { count: routeActivityCount } = useRouteActivityNotificationCount()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const canAccess = useMemo(() => (href: string) => canAccessRoute(href, permissions), [permissions])
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [displayName, setDisplayName] = useState('User')
  const [displayRole, setDisplayRole] = useState('Member')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  const isItemActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname === href || (pathname ?? '').startsWith(href + '/')
  }

  const isGroupActive = (items: NavItem[]) => {
    return items.some((item) => isItemActive(item.href))
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  useEffect(() => {
    const groupsToExpand = new Set<string>()
    navigationGroups.forEach((group) => {
      const hasActive = group.items.some((item) => {
        if (item.href === '/dashboard') {
          return pathname === '/dashboard'
        }
        return pathname === item.href || (pathname ?? '').startsWith(item.href + '/')
      })
      if (hasActive) {
        groupsToExpand.add(group.name)
      }
    })
    setExpandedGroups(groupsToExpand)
  }, [pathname])

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) return
        const { data } = await supabase
          .from('users')
          .select('full_name, role, email, avatar_url')
          .eq('email', user.email)
          .maybeSingle()
        const name = data?.full_name || data?.email || user.email
        setDisplayName(name)
        setDisplayRole(data?.role || 'Member')
        setAvatarUrl((data as { avatar_url?: string } | null)?.avatar_url ?? null)
      } catch {
        // best-effort; keep defaults
      }
    }
    loadProfile()
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="relative flex h-28 items-center justify-center border-b border-slate-200/60 transition-all duration-300 py-4">
        <img
          src="/assets/countylogofin.png"
          alt="CountyCars"
          className="h-24 w-auto object-contain"
        />
        <button
          className="lg:hidden absolute right-4 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          onClick={() => setIsMobileOpen(false)}
        >
          <X className="h-5 w-5 text-slate-500" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin space-y-1">
        {/* Top-level items */}
        <div className="space-y-1 mb-4 pb-4 border-b border-slate-200/60">
          {topLevelItems.filter((item) => permissionsLoading || canAccess(item.href)).map((item) => {
            const isActive = isItemActive(item.href)
            let badgeCount = 0
            let showBadge = false
            if (item.href === '/dashboard/compliance') {
              badgeCount = complianceCount
              showBadge = complianceCount > 0
            } else if (item.href === '/dashboard/route-activity') {
              badgeCount = routeActivityCount
              showBadge = routeActivityCount > 0
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={true}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <item.icon
                  className={cn(
                    'h-[18px] w-[18px] flex-shrink-0 transition-colors',
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                  )}
                />
                <span className="flex-1">{item.name}</span>
                {showBadge && (
                  <span className={cn(
                    "flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full",
                    isActive ? "bg-white/20 text-white" : "bg-rose-500 text-white"
                  )}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Collapsible groups */}
        {navigationGroups.map((group) => {
          const visibleItems = group.items.filter((item) => permissionsLoading || canAccess(item.href))
          if (visibleItems.length === 0) return null
          const isExpanded = expandedGroups.has(group.name)
          const hasActiveItem = isGroupActive(visibleItems)

          return (
            <div key={group.name} className="mb-1">
              <button
                onClick={() => toggleGroup(group.name)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200',
                  hasActiveItem
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <div className="flex items-center gap-3">
                  <group.icon className={cn(
                    "h-[18px] w-[18px] flex-shrink-0",
                    hasActiveItem ? "text-primary" : "text-slate-400"
                  )} />
                  <span>{group.name}</span>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  hasActiveItem ? "text-primary" : "text-slate-400",
                  isExpanded && "rotate-180"
                )} />
              </button>

              <div className={cn(
                "overflow-hidden transition-all duration-200 ease-in-out",
                isExpanded ? "max-h-[400px] opacity-100 mt-1" : "max-h-0 opacity-0"
              )}>
                <div className="ml-4 space-y-1 border-l-2 border-slate-200 pl-3">
                  {visibleItems.map((item) => {
                    const isActive = isItemActive(item.href)
                    const showBadge = item.href === '/dashboard/notifications' && notificationCount > 0

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        prefetch={true}
                        className={cn(
                          'group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150',
                          isActive
                            ? 'bg-primary/10 text-primary border-l-2 border-primary -ml-[11px] pl-[21px]'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        )}
                      >
                        <item.icon
                          className={cn(
                            'h-4 w-4 flex-shrink-0 transition-colors',
                            isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-500'
                          )}
                        />
                        <span className="flex-1">{item.name}</span>
                        {showBadge && (
                          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-rose-500 rounded-full">
                            {notificationCount > 99 ? '99+' : notificationCount}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer with Profile + Logout */}
      <div className="border-t border-slate-200/60 p-4 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (displayName || 'U').trim().charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{displayName}</p>
            <p className="text-xs text-slate-500">{displayRole}</p>
          </div>
        </div>
        <Link
          href="/dashboard/profile"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        >
          <User className="h-4 w-4" />
          <span>Profile</span>
        </Link>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          <span>{isLoggingOut ? 'Logging out...' : 'Sign out'}</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-xl shadow-lg border border-slate-200"
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="h-5 w-5 text-slate-600" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/60 transition-transform duration-300 lg:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent}
      </aside>
    </>
  )
}
