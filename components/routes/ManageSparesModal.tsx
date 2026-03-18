'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { formatDateTime, formatDateTimeForInput } from '@/lib/utils'
import type { RouteSpareRow } from '@/hooks/useRouteSpares'
import { getEffectiveSpareForType } from '@/hooks/useRouteSpares'
import { Loader2, User, Users, Truck } from 'lucide-react'

type SpareType = 'driver' | 'pa' | 'vehicle'

const ENDS_PRESETS = [
  { value: 'none', label: 'Until cleared' },
  { value: '1h', label: '1 hour' },
  { value: 'today', label: 'Today end (23:59)' },
  { value: 'tomorrow', label: 'Tomorrow morning (07:00)' },
  { value: 'custom', label: 'Custom date & time' },
] as const

function toEndsAt(preset: string, customValue: string): string | null {
  const now = new Date()
  switch (preset) {
    case 'none':
      return null
    case '1h':
      now.setHours(now.getHours() + 1)
      return now.toISOString()
    case 'today': {
      const end = new Date(now)
      end.setHours(23, 59, 0, 0)
      return end.toISOString()
    }
    case 'tomorrow': {
      const tom = new Date(now)
      tom.setDate(tom.getDate() + 1)
      tom.setHours(7, 0, 0, 0)
      return tom.toISOString()
    }
    case 'custom':
      return customValue ? new Date(customValue).toISOString() : null
    default:
      return null
  }
}

interface ManageSparesModalProps {
  isOpen: boolean
  onClose: () => void
  routeId: number
  spares: RouteSpareRow[]
  onSuccess: () => void
  canSet: boolean
  canClear: boolean
}

interface Option {
  id: number
  label: string
}

export function ManageSparesModal({
  isOpen,
  onClose,
  routeId,
  spares,
  onSuccess,
  canSet,
  canClear,
}: ManageSparesModalProps) {
  const [tab, setTab] = useState<SpareType>('driver')
  const [drivers, setDrivers] = useState<Option[]>([])
  const [pas, setPas] = useState<Option[]>([])
  const [vehicles, setVehicles] = useState<Option[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearConfirmId, setClearConfirmId] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Set form state per type
  const [entityId, setEntityId] = useState<string>('')
  const [startsAt, setStartsAt] = useState('')
  const [endsPreset, setEndsPreset] = useState<string>('none')
  const [endsCustom, setEndsCustom] = useState('')
  const [reason, setReason] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (!isOpen || routeId == null) return
    setError(null)
    setClearConfirmId(null)
    const now = new Date()
    setStartsAt(formatDateTimeForInput(now))
    setEndsPreset('none')
    setEndsCustom('')
    setReason('')
    setEntityId('')

    async function load() {
      setOptionsLoading(true)
      try {
        const [driversRes, pasRes, vehiclesRes] = await Promise.all([
          supabase
            .from('drivers')
            .select('employee_id, employees(full_name)')
            .order('employee_id'),
          supabase
            .from('passenger_assistants')
            .select('employee_id, employees(full_name)')
            .order('employee_id'),
          supabase
            .from('vehicles')
            .select('id, vehicle_identifier, registration')
            .eq('off_the_road', false)
            .order('vehicle_identifier'),
        ])
        setDrivers(
          (driversRes.data ?? []).map((d: any) => ({
            id: d.employee_id,
            label: d.employees?.full_name ?? `Driver ${d.employee_id}`,
          }))
        )
        setPas(
          (pasRes.data ?? []).map((p: any) => ({
            id: p.employee_id,
            label: p.employees?.full_name ?? `PA ${p.employee_id}`,
          }))
        )
        setVehicles(
          (vehiclesRes.data ?? []).map((v: any) => ({
            id: v.id,
            label: v.vehicle_identifier || v.registration || `Vehicle ${v.id}`,
          }))
        )
      } catch (e) {
        setError('Failed to load drivers, PAs, or vehicles')
      } finally {
        setOptionsLoading(false)
      }
    }
    load()
  }, [isOpen, routeId, supabase])

  const currentSpareDriver = getEffectiveSpareForType(spares, 'driver')
  const currentSparePa = getEffectiveSpareForType(spares, 'pa')
  const currentSpareVehicle = getEffectiveSpareForType(spares, 'vehicle')

  const currentByTab =
    tab === 'driver' ? currentSpareDriver : tab === 'pa' ? currentSparePa : currentSpareVehicle

  const optionsByTab = tab === 'driver' ? drivers : tab === 'pa' ? pas : vehicles

  const handleClear = async (id: string) => {
    setClearing(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('route_spares')
      .update({
        is_active: false,
        ends_at: new Date().toISOString(),
      })
      .eq('id', id)
    setClearing(false)
    setClearConfirmId(null)
    if (updateError) {
      setError(updateError.message)
      return
    }
    onSuccess()
  }

  const handleSetSpare = async () => {
    const eId = entityId ? parseInt(entityId, 10) : null
    if (eId == null || Number.isNaN(eId)) {
      setError('Please select a ' + (tab === 'driver' ? 'driver' : tab === 'pa' ? 'PA' : 'vehicle'))
      return
    }
    setSaving(true)
    setError(null)
    const starts = startsAt ? new Date(startsAt).toISOString() : new Date().toISOString()
    const ends = toEndsAt(endsPreset, endsCustom)

    const row: Record<string, unknown> = {
      route_id: routeId,
      spare_type: tab,
      starts_at: starts,
      ends_at: ends,
      reason: reason.trim() || null,
      is_active: true,
    }
    if (tab === 'driver') row.driver_employee_id = eId
    else if (tab === 'pa') row.pa_employee_id = eId
    else row.vehicle_id = eId

    const { error: insertError } = await supabase.from('route_spares').insert(row)
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    onSuccess()
    setEntityId('')
    setReason('')
  }

  const spareLabel = (s: RouteSpareRow, options: Option[]) => {
    const id = s.driver_employee_id ?? s.pa_employee_id ?? s.vehicle_id
    const opt = options.find((o) => o.id === id)
    return opt?.label ?? String(id)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage route spares" className="max-w-lg">
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          {(['driver', 'pa', 'vehicle'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === t
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t === 'driver' && <User className="h-4 w-4" />}
              {t === 'pa' && <Users className="h-4 w-4" />}
              {t === 'vehicle' && <Truck className="h-4 w-4" />}
              {t === 'driver' ? 'Spare Driver' : t === 'pa' ? 'Spare PA' : 'Spare Vehicle'}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {currentByTab && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Current spare
            </p>
            <p className="font-medium text-slate-900">
              {spareLabel(
                currentByTab,
                tab === 'driver' ? drivers : tab === 'pa' ? pas : vehicles
              )}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              {currentByTab.ends_at
                ? `Until ${formatDateTime(currentByTab.ends_at)}`
                : 'Until cleared'}
            </p>
            {currentByTab.reason && (
              <p className="text-sm text-slate-500 mt-1">Reason: {currentByTab.reason}</p>
            )}
            {canClear && (
              <div className="mt-2">
                {clearConfirmId === currentByTab.id ? (
                  <span className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={clearing}
                      onClick={() => handleClear(currentByTab.id)}
                    >
                      {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Confirm clear
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setClearConfirmId(null)}
                    >
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setClearConfirmId(currentByTab.id)}
                  >
                    Clear spare
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {canSet && (
          <div className="rounded-lg border border-slate-200 p-3 space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Set spare
            </p>
            {optionsLoading ? (
              <p className="text-sm text-slate-500">Loading options…</p>
            ) : (
              <>
                <div>
                  <Label>
                    {tab === 'driver' ? 'Driver' : tab === 'pa' ? 'Passenger Assistant' : 'Vehicle'}
                  </Label>
                  <Select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    className="mt-1"
                  >
                    <option value="">Select…</option>
                    {optionsByTab.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Starts at (optional, default now)</Label>
                  <Input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Ends at</Label>
                  <Select
                    value={endsPreset}
                    onChange={(e) => setEndsPreset(e.target.value)}
                    className="mt-1"
                  >
                    {ENDS_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                  {endsPreset === 'custom' && (
                    <Input
                      type="datetime-local"
                      value={endsCustom}
                      onChange={(e) => setEndsCustom(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>
                <div>
                  <Label>Reason (optional)</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Cover for absence"
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={handleSetSpare}
                  disabled={saving || !entityId}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save spare'
                  )}
                </Button>
              </>
            )}
          </div>
        )}

        {!canSet && !currentByTab && (
          <p className="text-sm text-slate-500">You don’t have permission to set or clear spares.</p>
        )}
      </div>
    </Modal>
  )
}
