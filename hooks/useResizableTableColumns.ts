'use client'

import {
  createElement,
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactElement,
} from 'react'

const MIN_COL_PX = 48

/**
 * Persisted resizable column widths for data tables (localStorage).
 * Drag the right edge of each header cell to resize.
 */
export function useResizableTableColumns(storageKey: string, defaultWidths: number[]) {
  const columnCount = defaultWidths.length
  const [widths, setWidths] = useState<number[]>(() => defaultWidths.map((w) => Math.max(MIN_COL_PX, w)))

  useEffect(() => {
    console.debug('[fleet] useResizableTableColumns: hook active', storageKey)
  }, [storageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed) || parsed.length !== columnCount) return
      const next = parsed.map((x) =>
        typeof x === 'number' && Number.isFinite(x) ? Math.max(MIN_COL_PX, x) : MIN_COL_PX
      )
      setWidths(next)
      console.debug('[fleet] useResizableTableColumns: restored widths from storage', storageKey)
    } catch {
      /* ignore */
    }
  }, [storageKey, columnCount])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths))
    } catch {
      /* ignore */
    }
  }, [storageKey, widths])

  const onMouseDownResize = useCallback((colIndex: number, e: MouseEvent<HTMLSpanElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidths = [...widths]
    const onMove = (ev: globalThis.MouseEvent) => {
      const delta = ev.clientX - startX
      setWidths(() => {
        const next = [...startWidths]
        next[colIndex] = Math.max(MIN_COL_PX, startWidths[colIndex] + delta)
        return next
      })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [widths])

  const colGroup = createElement(
    'colgroup',
    null,
    ...widths.map((w, i) =>
      createElement('col', { key: i, style: { width: `${w}px` } as CSSProperties })
    )
  ) as ReactElement

  const resizeHandle = (colIndex: number) =>
    createElement('span', {
      className:
        'absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize hover:bg-slate-300/50 active:bg-primary/25',
      onMouseDown: (e: MouseEvent<HTMLSpanElement>) => onMouseDownResize(colIndex, e),
      'aria-hidden': true,
      title: 'Drag to widen column',
    })

  return { colGroup, resizeHandle }
}
