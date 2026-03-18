'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  Car,
  Video,
  Image as ImageIcon,
  Eye,
  Download,
  Route as RouteIcon
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'

interface VehiclePreCheck {
  id: number
  check_date: string
  session_type: string
  completed_at: string
  lights_working: boolean
  mirrors_adjusted: boolean
  tires_condition: boolean
  body_damage: boolean
  windows_clean: boolean
  dashboard_lights: boolean
  horn_working: boolean
  wipers_working: boolean
  seatbelts_working: boolean
  interior_clean: boolean
  first_aid_kit: boolean
  fire_extinguisher: boolean
  warning_triangle: boolean
  emergency_kit: boolean
  engine_oil_level: boolean
  coolant_level: boolean
  brake_fluid: boolean
  fuel_level_adequate: boolean
  notes: string | null
  issues_found: string | null
  media_urls: Array<{ type: 'video' | 'image'; url: string; thumbnail?: string }> | null
  vehicle: {
    vehicle_identifier: string | null
    registration: string | null
    plate_number: string | null
    make: string | null
    model: string | null
  } | null
  route_session: {
    routes: {
      route_number: string | null
    } | null
  } | null
}

interface DriverPreChecksProps {
  driverId: number
}

export default function DriverPreChecks({ driverId }: DriverPreChecksProps) {
  const [preChecks, setPreChecks] = useState<VehiclePreCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedCheck, setSelectedCheck] = useState<VehiclePreCheck | null>(null)

  useEffect(() => {
    loadPreChecks()
  }, [driverId, selectedDate])

  const loadPreChecks = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('vehicle_pre_checks')
      .select(`
        *,
        vehicle:vehicle_id(
          vehicle_identifier,
          registration,
          plate_number,
          make,
          model
        ),
        route_session:route_session_id(
          routes(route_number)
        )
      `)
      .eq('driver_id', driverId)
      .eq('check_date', selectedDate)
      .order('completed_at', { ascending: false })

    if (!error && data) {
      setPreChecks(data)
    }
    setLoading(false)
  }

  const getCheckStatus = (check: VehiclePreCheck) => {
    const allChecks = [
      check.lights_working,
      check.mirrors_adjusted,
      check.tires_condition,
      check.body_damage,
      check.windows_clean,
      check.dashboard_lights,
      check.horn_working,
      check.wipers_working,
      check.seatbelts_working,
      check.interior_clean,
      check.first_aid_kit,
      check.fire_extinguisher,
      check.warning_triangle,
      check.emergency_kit,
      check.engine_oil_level,
      check.coolant_level,
      check.brake_fluid,
      check.fuel_level_adequate,
    ]

    const passed = allChecks.filter(Boolean).length
    const total = allChecks.length
    const hasIssues = check.issues_found && check.issues_found.trim().length > 0

    if (passed === total && !hasIssues) {
      return { status: 'complete', label: 'All Checks Passed', color: 'bg-green-100 text-green-800' }
    }
    if (hasIssues) {
      return { status: 'issues', label: 'Issues Found', color: 'bg-red-100 text-red-800' }
    }
    return { status: 'partial', label: `${passed}/${total} Passed`, color: 'bg-yellow-100 text-yellow-800' }
  }

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <Calendar className="h-5 w-5 text-gray-500" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pre-Checks List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
          <p className="mt-2 text-gray-600">Loading pre-checks...</p>
        </div>
      ) : preChecks.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No pre-checks found for {formatDate(selectedDate)}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {preChecks.map((check) => {
            const status = getCheckStatus(check)
            const vehicle = check.vehicle
            const route = check.route_session?.routes

            return (
              <Card key={check.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center space-x-4">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatDateTime(check.completed_at)}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${check.session_type === 'AM'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-primary/10 text-primary'
                          }`}>
                          {check.session_type}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <Car className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">
                            <strong>Vehicle:</strong> {vehicle?.registration || vehicle?.vehicle_identifier || 'N/A'}
                          </span>
                        </div>
                        {route?.route_number && (
                          <div className="flex items-center space-x-2">
                            <RouteIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                              <strong>Route:</strong> {route.route_number}
                            </span>
                          </div>
                        )}
                        {check.media_urls && check.media_urls.length > 0 && (
                          <div className="flex items-center space-x-2">
                            <Video className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                              {check.media_urls.filter(m => m.type === 'video').length} video(s)
                            </span>
                            <ImageIcon className="h-4 w-4 text-gray-400 ml-2" />
                            <span className="text-gray-600">
                              {check.media_urls.filter(m => m.type === 'image').length} photo(s)
                            </span>
                          </div>
                        )}
                      </div>

                      {check.issues_found && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-red-900">Issues Found:</p>
                              <p className="text-sm text-red-700 mt-1">{check.issues_found}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {check.notes && (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>Notes:</strong> {check.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => setSelectedCheck(check)}
                      variant="secondary"
                      size="sm"
                      className="ml-4"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Detail Modal - Same as VehiclePreChecks */}
      {selectedCheck && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="bg-navy text-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Pre-Check Details</CardTitle>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedCheck(null)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Vehicle</p>
                  <p className="font-medium">
                    {selectedCheck.vehicle?.registration || selectedCheck.vehicle?.vehicle_identifier || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Route</p>
                  <p className="font-medium">{selectedCheck.route_session?.routes?.route_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Session Type</p>
                  <p className="font-medium">{selectedCheck.session_type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Check Date</p>
                  <p className="font-medium">{formatDate(selectedCheck.check_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Completed At</p>
                  <p className="font-medium">{formatDateTime(selectedCheck.completed_at)}</p>
                </div>
              </div>

              {/* Check Results */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Check Results</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Lights Working', value: selectedCheck.lights_working },
                    { label: 'Mirrors Adjusted', value: selectedCheck.mirrors_adjusted },
                    { label: 'Tires Condition', value: selectedCheck.tires_condition },
                    { label: 'No Body Damage', value: selectedCheck.body_damage },
                    { label: 'Windows Clean', value: selectedCheck.windows_clean },
                    { label: 'Dashboard Lights', value: selectedCheck.dashboard_lights },
                    { label: 'Horn Working', value: selectedCheck.horn_working },
                    { label: 'Wipers Working', value: selectedCheck.wipers_working },
                    { label: 'Seatbelts Working', value: selectedCheck.seatbelts_working },
                    { label: 'Interior Clean', value: selectedCheck.interior_clean },
                    { label: 'First Aid Kit', value: selectedCheck.first_aid_kit },
                    { label: 'Fire Extinguisher', value: selectedCheck.fire_extinguisher },
                    { label: 'Warning Triangle', value: selectedCheck.warning_triangle },
                    { label: 'Emergency Kit', value: selectedCheck.emergency_kit },
                    { label: 'Engine Oil Level', value: selectedCheck.engine_oil_level },
                    { label: 'Coolant Level', value: selectedCheck.coolant_level },
                    { label: 'Brake Fluid', value: selectedCheck.brake_fluid },
                    { label: 'Fuel Level', value: selectedCheck.fuel_level_adequate },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center space-x-2">
                      {item.value ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="text-sm">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Issues and Notes */}
              {selectedCheck.issues_found && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-2">Issues Found</h4>
                  <p className="text-sm text-red-700">{selectedCheck.issues_found}</p>
                </div>
              )}

              {selectedCheck.notes && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-700">{selectedCheck.notes}</p>
                </div>
              )}

              {/* Media */}
              {selectedCheck.media_urls && selectedCheck.media_urls.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-4">Media Attachments</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedCheck.media_urls.map((media, index) => (
                      <div key={index} className="relative">
                        {media.type === 'video' ? (
                          <video
                            src={media.url}
                            controls
                            className="w-full h-48 object-cover rounded-lg border-2 border-gray-300"
                          />
                        ) : (
                          <img
                            src={media.url}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg border-2 border-gray-300"
                          />
                        )}
                        <a
                          href={media.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 bg-navy text-white p-1 rounded hover:bg-navy/80"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

