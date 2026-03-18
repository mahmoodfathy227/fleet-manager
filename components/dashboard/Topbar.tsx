'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, Menu, User, ChevronRight } from 'lucide-react'
import { useState } from 'react'

export function Topbar() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 backdrop-blur-md px-6 shadow-sm">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Menu className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Fleet Management System</h2>
          <nav className="hidden md:flex items-center text-sm text-gray-500">
            <span>Dashboard</span>
          </nav>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* User menu */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-900">Admin</p>
            <p className="text-xs text-gray-500">Fleet Manager</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200" />

        {/* Logout button */}
        <button
          onClick={handleLogout}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{loading ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </header>
  )
}
