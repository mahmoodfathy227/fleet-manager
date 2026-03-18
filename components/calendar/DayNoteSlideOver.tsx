'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { formatDateTime } from '@/lib/utils'
import { X, Trash2, Pencil, Check } from 'lucide-react'
import type { CalendarDayNote } from '@/lib/calendarNotes'

interface DayNoteSlideOverProps {
  isOpen: boolean
  onClose: () => void
  selectedDate: string | null
  selectedDateLabel: string
  notes: CalendarDayNote[]
  newNoteText: string
  isSaving: boolean
  onNewNoteChange: (text: string) => void
  onAddNote: () => void
  onUpdateNote: (id: number, note_text: string) => void
  onDeleteNote: (id: number) => void
  error: string | null
}

export function DayNoteSlideOver({
  isOpen,
  onClose,
  selectedDate,
  selectedDateLabel,
  notes,
  newNoteText,
  isSaving,
  onNewNoteChange,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  error,
}: DayNoteSlideOverProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId != null) {
          setEditingId(null)
          setEditText('')
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose, editingId])

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 150)
  }, [isOpen])

  useEffect(() => {
    if (editingId == null) return
    const n = notes.find((x) => x.id === editingId)
    setEditText(n?.note_text ?? '')
  }, [editingId, notes])

  if (!isOpen) return null

  const startEdit = (n: CalendarDayNote) => {
    setEditingId(n.id)
    setEditText(n.note_text)
  }

  const saveEdit = () => {
    if (editingId != null && editText.trim() !== '') {
      onUpdateNote(editingId, editText.trim())
      setEditingId(null)
      setEditText('')
    }
  }

  const deleteOne = (id: number) => {
    if (confirm('Delete this update? This cannot be undone.')) onDeleteNote(id)
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-row items-center justify-between gap-4 h-14 px-6 bg-slate-50 border-b border-slate-200">
        <h2 id="day-note-title" className="text-lg font-semibold text-slate-700 tracking-tight">
          Day updates — {selectedDateLabel}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {notes.length > 0 && (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li
                  key={n.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm"
                >
                  {editingId === n.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={saveEdit}
                          disabled={isSaving || !editText.trim()}
                          leftIcon={<Check className="h-4 w-4" />}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => { setEditingId(null); setEditText(''); }}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-slate-600 mb-2 space-y-0.5">
                        <span className="block">
                          Posted by {n.created_by_name ?? 'Unknown'} at {formatDateTime(n.created_at)}
                        </span>
                        {n.updated_at && (n.updated_by_name || n.created_by_name) && (
                          <span className="block text-slate-500">
                            Last updated by {n.updated_by_name ?? n.created_by_name} at {formatDateTime(n.updated_at)}
                          </span>
                        )}
                      </p>
                      <p className="text-slate-900 whitespace-pre-wrap">{n.note_text}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(n)}
                          className="text-xs text-slate-600 hover:text-primary flex items-center gap-1"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteOne(n.id)}
                          className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </>
                  )}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Label htmlFor="day-note-new">Add update</Label>
          <textarea
            id="day-note-new"
            ref={textareaRef}
            value={newNoteText}
            onChange={(e) => onNewNoteChange(e.target.value)}
            placeholder="Add an update for this day…"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y min-h-[100px]"
          />
          <Button
            type="button"
            onClick={onAddNote}
            disabled={isSaving || !newNoteText.trim()}
            isLoading={isSaving}
          >
            Add update
          </Button>
        </div>
      </div>
    </div>
  )
}
