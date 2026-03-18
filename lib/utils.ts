import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null): string {
  if (!date) return 'N/A'
  const d = new Date(date)
  return d.toLocaleDateString('en-GB', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return 'N/A'
  const d = new Date(date)
  return d.toLocaleString('en-GB', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatTime(date: string | Date | null): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleTimeString('en-GB', { 
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Formats a date string for HTML date input (YYYY-MM-DD)
 * Ensures dates are displayed correctly in UK format
 */
export function formatDateForInput(date: string | Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  // Ensure we're working with local date, not UTC
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Format for input[type="datetime-local"]: YYYY-MM-DDThh:mm */
export function formatDateTimeForInput(date: string | Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  const y = d.getFullYear()
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${M}-${D}T${h}:${m}`
}

/**
 * Parses a date input value (YYYY-MM-DD) to ensure correct date handling
 */
export function parseDateInput(value: string): string {
  if (!value) return ''
  // Date input always returns YYYY-MM-DD format
  // Parse and reformat to ensure correct date
  const d = new Date(value + 'T00:00:00')
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Generate a UUID v4 with fallback for environments that don't support crypto.randomUUID()
 */
export function generateUUID(): string {
  // Try to use the native crypto.randomUUID() if available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  
  // Fallback implementation for older browsers
  // This generates a v4 UUID using Math.random()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/** Simple email format validation. Empty string is valid (optional field). */
export function isValidEmail(value: string): boolean {
  if (!value || !value.trim()) return true
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value.trim())
}

/** Phone validation: optional; if provided, allow digits, spaces, dashes, parentheses, plus; require at least 10 digits. */
export function isValidPhone(value: string): boolean {
  if (!value || !value.trim()) return true
  const digitsOnly = value.replace(/\D/g, '')
  return digitsOnly.length >= 10
}

