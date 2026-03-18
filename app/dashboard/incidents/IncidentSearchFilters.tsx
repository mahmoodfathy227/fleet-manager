'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

export function IncidentSearchFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const get = (k: string) => searchParams?.get(k) ?? ''
  const paramStr = searchParams?.toString() ?? ''

  const searchInputRef = useRef<HTMLInputElement>(null)
  const isSearchFocusedRef = useRef(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [search, setSearch] = useState(get('search') || '')
  const [status, setStatus] = useState(get('status') || 'all')

  useEffect(() => {
    if (!isSearchFocusedRef.current) {
      setSearch(get('search') || '')
    }
    setStatus(get('status') || 'all')
  }, [searchParams])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  const updateFilters = (updates: Record<string, string>) => {
    startTransition(() => {
      const params = new URLSearchParams(paramStr)
      if (get('route_session_id')) {
        params.set('route_session_id', get('route_session_id'))
      }
      Object.entries(updates).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })
      router.push(`?${params.toString()}`)
    })
  }

  const handleSearchChange = (value: string) => {
    // Update local state immediately for responsive typing
    setSearch(value)
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Debounce URL update to reduce server requests
    searchTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(paramStr)
      if (get('route_session_id')) {
        params.set('route_session_id', get('route_session_id'))
      }
      if (value.trim()) {
        params.set('search', value.trim())
      } else {
        params.delete('search')
      }
      
      startTransition(() => {
        router.push(`?${params.toString()}`)
      })
    }, 400)
  }

  const clearFilters = () => {
    // Clear any pending search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    setSearch('')
    setStatus('all')
    const params = new URLSearchParams()
    if (get('route_session_id')) {
      params.set('route_session_id', get('route_session_id'))
    }
    startTransition(() => {
      router.push(params.toString() ? `?${params.toString()}` : '/dashboard/incidents')
    })
  }

  const hasActiveFilters = search.trim() !== '' || status !== 'all'

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label htmlFor="search" className="mb-2 block text-sm font-medium text-gray-700">
            Search by type, description, reference, employee or route
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              ref={searchInputRef}
              id="search"
              type="text"
              placeholder="Search incidents..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                isSearchFocusedRef.current = true
              }}
              onBlur={() => {
                isSearchFocusedRef.current = false
              }}
              className="pl-10"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="w-full md:w-40">
          <label htmlFor="status" className="mb-2 block text-sm font-medium text-gray-700">
            Status
          </label>
          <Select
            id="status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              updateFilters({ status: e.target.value })
            }}
            disabled={isPending}
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </Select>
        </div>

        {hasActiveFilters && (
          <div className="w-full md:w-auto">
            <Button type="button" variant="secondary" onClick={clearFilters} disabled={isPending}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
