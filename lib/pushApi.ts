/**
 * Push notifications API client.
 * All calls require Supabase JWT; session is read dynamically (no stored JWT).
 */

import { createClient } from '@/lib/supabase/client'

const BASE =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL
    ? process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL.replace(/\/$/, '')
    : ''

export type AudienceType = 'single_user' | 'route_parents' | 'route_crew'

export interface RegisterDevicePayload {
  deviceId: string
  token: string
  platform: 'android' | 'ios' | 'web'
}

export interface SendNotificationPayload {
  audienceType: AudienceType
  title: string
  body: string
  deepLink?: string
  metadata?: Record<string, unknown>
  targetUserId?: string
  routeId?: number
}

export interface SendNotificationResult {
  notificationId: string
  recipientCount: number
  tokenCount: number
  sentCount: number
  failedCount: number
}

export interface InboxItem {
  notificationId: string
  title: string
  body: string
  createdAt: string
  readAt: string | null
  deepLink: string | null
  metadata: Record<string, unknown> | null
  audienceType: string
  routeId: number | null
}

export interface MyInboxResult {
  items: InboxItem[]
}

/** Get current Supabase access token. Throws if not authenticated. */
export async function getJwt(): Promise<string> {
  const supabase = createClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error) throw new Error(`Session error: ${error.message}`)
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

async function callFn<T>(
  path: string,
  options: {
    method: 'GET' | 'POST'
    body?: unknown
    searchParams?: Record<string, string>
  }
): Promise<T> {
  const jwt = await getJwt()
  const url =
    options.searchParams && Object.keys(options.searchParams).length > 0
      ? `${BASE}${path}?${new URLSearchParams(options.searchParams).toString()}`
      : `${BASE}${path}`
  const res = await fetch(url, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  })
  const data = (await res.json()) as T | { error?: string }
  if (!res.ok) {
    const msg = typeof (data as { error?: string }).error === 'string'
      ? (data as { error: string }).error
      : `Request failed: ${res.status}`
    throw new Error(msg)
  }
  return data as T
}

export const pushApi = {
  async registerDevice(payload: RegisterDevicePayload): Promise<{ ok: boolean }> {
    return callFn<{ ok: boolean }>('/registerDevice', { method: 'POST', body: payload })
  },

  async sendNotification(payload: SendNotificationPayload): Promise<SendNotificationResult> {
    return callFn<SendNotificationResult>('/sendNotification', { method: 'POST', body: payload })
  },

  async myInbox(limit: number = 50): Promise<MyInboxResult> {
    return callFn<MyInboxResult>('/myInbox', {
      method: 'GET',
      searchParams: { limit: String(limit) },
    })
  },

  async markRead(notificationId: string): Promise<{ ok: boolean }> {
    return callFn<{ ok: boolean }>('/markRead', {
      method: 'POST',
      body: { notificationId },
    })
  },
}
