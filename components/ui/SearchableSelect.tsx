'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { ChevronDown, Search, X } from 'lucide-react'

export interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  onSearchChange?: (search: string) => void
  placeholder?: string
  id?: string
  className?: string
  emptyLabel?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  onSearchChange,
  placeholder = 'Select...',
  id,
  className,
  emptyLabel = 'None',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = value ? options.find((o) => o.value === value) : null
  const displayValue = selected ? selected.label : ''
  const filtered = search.trim()
    ? options.filter((o) =>
        String(o.label).toLowerCase().includes(search.toLowerCase())
      )
    : options

  const optionsWithEmpty = [
    { value: '', label: emptyLabel },
    ...options,
  ]
  const filteredWithEmpty = search.trim()
    ? filtered.length
      ? [{ value: '', label: emptyLabel }, ...filtered]
      : filtered
    : optionsWithEmpty

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  useEffect(() => {
    if (open && containerRef.current && typeof document !== 'undefined') {
      const rect = containerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement
        if (!target.closest('[data-searchable-select-dropdown]')) setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const dropdownContent = open && typeof document !== 'undefined' && (
    <div
      data-searchable-select-dropdown
      className="fixed z-[9999] rounded-lg border border-slate-200 bg-white shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        minWidth: 200,
      }}
    >
      <div className="border-b border-slate-100 p-1.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); onSearchChange?.(e.target.value) }}
            placeholder="Search..."
            className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#023E8A]"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {filteredWithEmpty.length === 0 ? (
          <div className="py-4 text-center text-sm text-slate-500">No matches</div>
        ) : (
          filteredWithEmpty.map((opt) => (
            <button
              key={opt.value === '' ? '__none__' : opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={cn(
                'w-full rounded-md px-2.5 py-1.5 text-left text-sm',
                opt.value === value
                  ? 'bg-[#023E8A]/10 text-[#023E8A] font-medium'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              {opt.label}
            </button>
          ))
        )}
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-left',
          'focus:outline-none focus:ring-2 focus:ring-[#023E8A] focus:ring-offset-2 focus:border-transparent',
          'h-9 min-h-9'
        )}
      >
        <span className={displayValue ? 'text-slate-900' : 'text-slate-500'}>
          {displayValue || placeholder}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-slate-400 flex-shrink-0', open && 'rotate-180')}
        />
      </button>
      {typeof document !== 'undefined' && dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  )
}
