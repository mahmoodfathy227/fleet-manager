'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { pushApi, type AudienceType, type SendNotificationResult } from '@/lib/pushApi'

interface RouteRow {
  id: number
  route_number: string | null
}

export default function AdminNotificationsPage() {
  const [audienceType, setAudienceType] = useState<AudienceType>('single_user')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [deepLink, setDeepLink] = useState('')
  const [metadataText, setMetadataText] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [routeId, setRouteId] = useState('')
  const [routes, setRoutes] = useState<Array<{ id: number; label: string }>>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SendNotificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isRouteAudience = audienceType === 'route_parents' || audienceType === 'route_crew'
  const isValid =
    title.trim() !== '' &&
    body.trim() !== '' &&
    (audienceType !== 'single_user' ? routeId !== '' : targetUserId.trim() !== '')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data, error: e } = await supabase
        .from('routes')
        .select('id, route_number')
        .order('id')
        .limit(500)
      if (e) return
      const rows = (data ?? []) as RouteRow[]
      setRoutes(rows.map((r) => ({ id: r.id, label: r.route_number ?? String(r.id) })))
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    if (!isValid || busy) return

    let metadata: Record<string, unknown> | undefined
    if (metadataText.trim()) {
      try {
        metadata = JSON.parse(metadataText) as Record<string, unknown>
      } catch {
        setError('Invalid JSON in metadata')
        return
      }
    }

    const payload = {
      audienceType,
      title: title.trim(),
      body: body.trim(),
      ...(deepLink.trim() && { deepLink: deepLink.trim() }),
      ...(metadata && { metadata }),
      ...(audienceType === 'single_user'
        ? { targetUserId: targetUserId.trim() }
        : { routeId: parseInt(routeId, 10) }),
    }

    setBusy(true)
    try {
      const res = await pushApi.sendNotification(payload)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 820, padding: 24, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 700 }}>Send push notification</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Audience</label>
          <select
            value={audienceType}
            onChange={(e) => setAudienceType(e.target.value as AudienceType)}
            style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
          >
            <option value="single_user">single_user</option>
            <option value="route_parents">route_parents</option>
            <option value="route_crew">route_crew</option>
          </select>
        </div>

        {audienceType === 'single_user' && (
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
              targetUserId (UUID)
            </label>
            <input
              type="text"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="User UUID"
              style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
            />
          </div>
        )}

        {isRouteAudience && (
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Route</label>
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
            >
              <option value="">Select route</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Body *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Deep link</label>
          <input
            type="text"
            value={deepLink}
            onChange={(e) => setDeepLink(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
            Metadata (JSON)
          </label>
          <textarea
            value={metadataText}
            onChange={(e) => setMetadataText(e.target.value)}
            placeholder='{"key": "value"}'
            rows={2}
            style={{ width: '100%', padding: '8px 12px', fontSize: 14, fontFamily: 'monospace' }}
          />
        </div>

        {error && (
          <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 6 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || busy}
          style={{
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 500,
            cursor: isValid && !busy ? 'pointer' : 'not-allowed',
            opacity: isValid && !busy ? 1 : 0.6,
          }}
        >
          {busy ? 'Sending…' : 'Send notification'}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ marginBottom: 12, fontSize: 18, fontWeight: 600 }}>Result</h2>
          <pre
            style={{
              padding: 16,
              background: '#f1f5f9',
              borderRadius: 6,
              overflow: 'auto',
              fontSize: 13,
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
