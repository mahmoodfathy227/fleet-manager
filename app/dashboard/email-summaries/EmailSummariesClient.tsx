'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Mail, Search, Calendar, User, FileText, Eye, X, CheckCircle, AlertCircle } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Label } from '@/components/ui/Label'

interface EmailSummary {
  id: number
  email_subject?: string | null
  sender_email?: string | null
  sender_name?: string | null
  email_content?: string | null
  received_at?: string | null
  summary?: string | null
  recommended_actions?: {
    immediate?: string[]
    followUp?: string[]
    dashboardUpdates?: string[]
    notifications?: string[]
  } | null
  contextual_notes?: string | null
  status?: string | null
  reviewed_by?: number | null
  reviewed_at?: string | null
  action_taken?: boolean | null
  action_notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

interface EmailSummariesClientProps {
  initialSummaries: EmailSummary[]
}

export default function EmailSummariesClient({ initialSummaries }: EmailSummariesClientProps) {
  const [summaries, setSummaries] = useState<EmailSummary[]>(initialSummaries)
  const [filteredSummaries, setFilteredSummaries] = useState<EmailSummary[]>(initialSummaries)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedSummary, setSelectedSummary] = useState<EmailSummary | null>(null)
  const [acknowledging, setAcknowledging] = useState<number | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const supabase = createClient()

  useEffect(() => {
    // Filter summaries based on search term
    if (!searchTerm.trim()) {
      setFilteredSummaries(summaries)
    } else {
      const filtered = summaries.filter((summary) => {
        const searchLower = searchTerm.toLowerCase()
        return (
          summary.sender_email?.toLowerCase().includes(searchLower) ||
          summary.sender_name?.toLowerCase().includes(searchLower) ||
          summary.email_subject?.toLowerCase().includes(searchLower) ||
          summary.summary?.toLowerCase().includes(searchLower) ||
          summary.contextual_notes?.toLowerCase().includes(searchLower) ||
          summary.status?.toLowerCase().includes(searchLower)
        )
      })
      setFilteredSummaries(filtered)
    }
  }, [searchTerm, summaries])

  const refreshSummaries = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('email_summaries')
        .select('*')
        .order('received_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      setSummaries(data || [])
      setFilteredSummaries(data || [])
    } catch (error) {
      console.error('Error refreshing email summaries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcknowledge = async (summaryId: number, newStatus: 'reviewed' | 'actioned') => {
    setAcknowledging(summaryId)
    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('You must be logged in to acknowledge summaries')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .maybeSingle()

      const updateData: any = {
        status: newStatus,
        reviewed_by: userData?.id || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      if (newStatus === 'actioned' && actionNotes) {
        updateData.action_taken = true
        updateData.action_notes = actionNotes
      }

      const { error } = await supabase
        .from('email_summaries')
        .update(updateData)
        .eq('id', summaryId)

      if (error) throw error

      // Refresh the summaries list
      await refreshSummaries()

      // Update selected summary if it's the one being acknowledged
      if (selectedSummary && selectedSummary.id === summaryId) {
        setSelectedSummary({
          ...selectedSummary,
          ...updateData,
        })
      }

      // Close modal if acknowledging
      if (newStatus === 'actioned') {
        setSelectedSummary(null)
        setActionNotes('')
      }
    } catch (error) {
      console.error('Error acknowledging email summary:', error)
      alert('Failed to acknowledge email summary')
    } finally {
      setAcknowledging(null)
    }
  }

  return (
    <Card>
      <CardHeader className="bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-slate-900 text-base font-semibold">
            <Mail className="mr-2 h-5 w-5 text-slate-500" />
            Email Summaries ({filteredSummaries.length})
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshSummaries}
            disabled={loading}
            className="text-slate-600 border-slate-300 hover:bg-slate-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by sender email, name, subject, summary, or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Email Summaries Table */}
        {filteredSummaries.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No email summaries found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Try adjusting your search terms' : 'No email summaries have been sent yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received At</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummaries.map((summary) => (
                  <TableRow key={summary.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">
                          {summary.received_at
                            ? formatDateTime(summary.received_at)
                            : summary.created_at
                              ? formatDateTime(summary.created_at)
                              : 'N/A'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-sm">
                            {summary.sender_name || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {summary.sender_email || 'No email'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{summary.email_subject || 'No subject'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-700">
                        {summary.summary
                          ? (summary.summary.length > 100
                            ? summary.summary.substring(0, 100) + '...'
                            : summary.summary)
                          : 'No summary'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${summary.status === 'new'
                          ? 'bg-blue-100 text-blue-800'
                          : summary.status === 'reviewed'
                            ? 'bg-yellow-100 text-yellow-800'
                            : summary.status === 'actioned'
                              ? 'bg-green-100 text-green-800'
                              : summary.status === 'archived'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}>
                        {summary.status || 'new'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {summary.recommended_actions ? (
                        <div className="flex flex-col space-y-1">
                          {summary.recommended_actions.immediate && summary.recommended_actions.immediate.length > 0 && (
                            <span className="text-xs text-red-600">
                              {summary.recommended_actions.immediate.length} immediate
                            </span>
                          )}
                          {summary.recommended_actions.followUp && summary.recommended_actions.followUp.length > 0 && (
                            <span className="text-xs text-orange-600">
                              {summary.recommended_actions.followUp.length} follow-up
                            </span>
                          )}
                          {summary.action_taken && (
                            <span className="text-xs text-green-600">✓ Action taken</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No actions</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSummary(summary)}
                        className="text-slate-600 hover:text-primary hover:bg-primary/10"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Detailed View Modal */}
      {selectedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center justify-between sticky top-0">
              <h2 className="text-xl font-bold text-slate-900">Email Summary Details</h2>
              <button
                onClick={() => {
                  setSelectedSummary(null)
                  setActionNotes('')
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Sender</Label>
                  <div className="mt-1">
                    <div className="font-medium">{selectedSummary.sender_name || 'Unknown'}</div>
                    <div className="text-sm text-gray-600">{selectedSummary.sender_email || 'No email'}</div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Received At</Label>
                  <div className="mt-1 text-sm">
                    {selectedSummary.received_at
                      ? formatDateTime(selectedSummary.received_at)
                      : selectedSummary.created_at
                        ? formatDateTime(selectedSummary.created_at)
                        : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div>
                <Label className="text-sm font-medium text-gray-500">Subject</Label>
                <div className="mt-1 font-medium">{selectedSummary.email_subject || 'No subject'}</div>
              </div>

              {/* Status */}
              <div>
                <Label className="text-sm font-medium text-gray-500">Status</Label>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedSummary.status === 'new'
                      ? 'bg-blue-100 text-blue-800'
                      : selectedSummary.status === 'reviewed'
                        ? 'bg-yellow-100 text-yellow-800'
                        : selectedSummary.status === 'actioned'
                          ? 'bg-green-100 text-green-800'
                          : selectedSummary.status === 'archived'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}>
                    {selectedSummary.status || 'new'}
                  </span>
                  {selectedSummary.reviewed_at && (
                    <span className="ml-2 text-xs text-gray-500">
                      Reviewed: {formatDateTime(selectedSummary.reviewed_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Email Content */}
              {selectedSummary.email_content && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Email Content</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded border border-gray-200 max-h-60 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-sans">{selectedSummary.email_content}</pre>
                  </div>
                </div>
              )}

              {/* Summary */}
              {selectedSummary.summary && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Summary</Label>
                  <div className="mt-1 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm">{selectedSummary.summary}</p>
                  </div>
                </div>
              )}

              {/* Recommended Actions */}
              {selectedSummary.recommended_actions && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Recommended Actions</Label>
                  <div className="mt-1 space-y-3">
                    {selectedSummary.recommended_actions.immediate && selectedSummary.recommended_actions.immediate.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-red-700 mb-1">Immediate Actions:</div>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {selectedSummary.recommended_actions.immediate.map((action, idx) => (
                            <li key={idx} className="text-red-600">{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedSummary.recommended_actions.followUp && selectedSummary.recommended_actions.followUp.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-orange-700 mb-1">Follow-up Actions:</div>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {selectedSummary.recommended_actions.followUp.map((action, idx) => (
                            <li key={idx} className="text-orange-600">{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedSummary.recommended_actions.dashboardUpdates && selectedSummary.recommended_actions.dashboardUpdates.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-blue-700 mb-1">Dashboard Updates:</div>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {selectedSummary.recommended_actions.dashboardUpdates.map((action, idx) => (
                            <li key={idx} className="text-blue-600">{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedSummary.recommended_actions.notifications && selectedSummary.recommended_actions.notifications.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-purple-700 mb-1">Notifications:</div>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {selectedSummary.recommended_actions.notifications.map((action, idx) => (
                            <li key={idx} className="text-purple-600">{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contextual Notes */}
              {selectedSummary.contextual_notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Contextual Notes</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded border border-gray-200">
                    <p className="text-sm">{selectedSummary.contextual_notes}</p>
                  </div>
                </div>
              )}

              {/* Action Notes */}
              {selectedSummary.action_notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Action Notes</Label>
                  <div className="mt-1 p-3 bg-green-50 rounded border border-green-200">
                    <p className="text-sm">{selectedSummary.action_notes}</p>
                  </div>
                </div>
              )}

              {/* Action Notes Input (for actioned status) */}
              {selectedSummary.status !== 'actioned' && (
                <div>
                  <Label htmlFor="action-notes" className="text-sm font-medium text-gray-500">
                    Action Notes (optional)
                  </Label>
                  <textarea
                    id="action-notes"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Add notes about actions taken..."
                    rows={3}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedSummary(null)
                    setActionNotes('')
                  }}
                >
                  Close
                </Button>
                {selectedSummary.status === 'new' && (
                  <Button
                    onClick={() => handleAcknowledge(selectedSummary.id, 'reviewed')}
                    disabled={acknowledging === selectedSummary.id}
                    variant="secondary"
                  >
                    {acknowledging === selectedSummary.id ? (
                      'Acknowledging...'
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Reviewed
                      </>
                    )}
                  </Button>
                )}
                {selectedSummary.status !== 'actioned' && (
                  <Button
                    onClick={() => handleAcknowledge(selectedSummary.id, 'actioned')}
                    disabled={acknowledging === selectedSummary.id}
                  >
                    {acknowledging === selectedSummary.id ? (
                      'Processing...'
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Actioned
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

