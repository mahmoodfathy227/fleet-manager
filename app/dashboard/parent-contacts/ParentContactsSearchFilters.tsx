'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const BASE_PATH = '/dashboard/parent-contacts'

export function ParentContactsSearchFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const get = (k: string) => searchParams?.get(k) ?? ''
  const paramStr = searchParams?.toString() ?? ''

  const searchInputRef = useRef<HTMLInputElement>(null)
  const isSearchFocusedRef = useRef(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [search, setSearch] = useState(get('search') || '')
  const [relationship, setRelationship] = useState(get('relationship') || 'all')

  useEffect(() => {
    if (!isSearchFocusedRef.current) {
      setSearch(get('search') || '')
    }
    setRelationship(get('relationship') || 'all')
  }, [searchParams])

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [])

  const pushQuery = (params: URLSearchParams) => {
    const q = params.toString()
    startTransition(() => {
      router.push(q ? `${BASE_PATH}?${q}` : BASE_PATH)
    })
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(paramStr)
      params.delete('page')
      if (value.trim()) {
        params.set('search', value.trim())
      } else {
        params.delete('search')
      }
      console.debug('[ParentContactsSearchFilters] search updated', { hasValue: Boolean(value.trim()) })
      pushQuery(params)
    }, 400)
  }

  const updateRelationship = (value: string) => {
    setRelationship(value)
    const params = new URLSearchParams(paramStr)
    params.delete('page')
    if (value && value !== 'all') {
      params.set('relationship', value)
    } else {
      params.delete('relationship')
    }
    console.debug('[ParentContactsSearchFilters] relationship updated', { value })
    pushQuery(params)
  }

  const clearFilters = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    setSearch('')
    setRelationship('all')
    console.debug('[ParentContactsSearchFilters] filters cleared')
    startTransition(() => router.push(BASE_PATH))
  }

  const hasActiveFilters = search.trim() !== '' || relationship !== 'all'

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label htmlFor="parent-contact-search" className="mb-2 block text-sm font-medium text-gray-700">
            Search name, phone, or email
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <Input
              ref={searchInputRef}
              id="parent-contact-search"
              type="search"
              placeholder="e.g. Sarah, 079…, @gmail"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                isSearchFocusedRef.current = true
              }}
              onBlur={() => {
                isSearchFocusedRef.current = false
              }}
              className="pl-10"
              autoComplete="off"
            />
            {search ? (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="w-full md:w-52">
          <label htmlFor="parent-contact-relationship" className="mb-2 block text-sm font-medium text-gray-700">
            Relationship
          </label>
          <Select
            id="parent-contact-relationship"
            value={relationship}
            onChange={(e) => updateRelationship(e.target.value)}
            disabled={isPending}
          >
            <option value="all">All</option>
            <option value="Mother">Mother</option>
            <option value="Father">Father</option>
            <option value="Guardian">Guardian</option>
            <option value="other">Other</option>
          </Select>
        </div>

        {hasActiveFilters ? (
          <div className="w-full md:w-auto">
            <Button type="button" variant="secondary" onClick={clearFilters} disabled={isPending}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
