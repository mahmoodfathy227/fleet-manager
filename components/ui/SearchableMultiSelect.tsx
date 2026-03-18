'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { ChevronDown, Search, X } from 'lucide-react'

export interface SearchableMultiSelectOption {
  value: string
  label: string
}

interface SearchableMultiSelectProps {
  options: SearchableMultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  id?: string
  className?: string
  emptyLabel?: string
}

export function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  id,
  className,
  emptyLabel = 'None',
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOptions = value
    .map((v) => options.find((o) => o.value === v))
    .filter(Boolean) as SearchableMultiSelectOption[]
  const displaySummary =
    selectedOptions.length === 0
      ? ''
      : selectedOptions.length === 1
        ? selectedOptions[0].label
        : `${selectedOptions.length} selected`

  const filtered =
    search.trim()
      ? options.filter((o) =>
          String(o.label).toLowerCase().includes(search.toLowerCase())
        )
      : options

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  useEffect(() => {
    if (open && containerRef.current && typeof document !== 'undefined') {
      const rect = containerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 200),
      })
    }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement
        if (!target.closest('[data-multi-select-dropdown]')) setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const toggleOption = (optValue: string) => {
    if (optValue === '') {
      onChange([])
      return
    }
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue))
    } else {
      onChange([...value, optValue])
    }
  }

  const dropdownContent = open && typeof document !== 'undefined' && (
    <div
      data-multi-select-dropdown
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
            onChange={(e) => setSearch(e.target.value)}
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
        <button
          type="button"
          onClick={() => toggleOption('')}
          className={cn(
            'w-full rounded-md px-2.5 py-1.5 text-left text-sm',
            value.length === 0
              ? 'bg-[#023E8A]/10 text-[#023E8A] font-medium'
              : 'text-slate-700 hover:bg-slate-100'
          )}
        >
          {emptyLabel}
        </button>
        {filtered.length === 0 ? (
          <div className="py-4 text-center text-sm text-slate-500">No matches</div>
        ) : (
          filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleOption(opt.value)}
              className={cn(
                'w-full rounded-md px-2.5 py-1.5 text-left text-sm',
                value.includes(opt.value)
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
          'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-left',
          'focus:outline-none focus:ring-2 focus:ring-[#023E8A] focus:ring-offset-2 focus:border-transparent'
        )}
      >
        {selectedOptions.length > 0 ? (
          <>
            {selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 rounded-md bg-[#023E8A]/10 px-2 py-0.5 text-xs font-medium text-[#023E8A]"
              >
                {opt.label}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(value.filter((v) => v !== opt.value))
                  }}
                  className="hover:bg-[#023E8A]/20 rounded p-0.5"
                  aria-label={`Remove ${opt.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </>
        ) : (
          <span className="text-slate-500">{placeholder}</span>
        )}
        <ChevronDown
          className={cn('ml-auto h-4 w-4 flex-shrink-0 text-slate-400', open && 'rotate-180')}
        />
      </button>
      {typeof document !== 'undefined' && dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  )
}
