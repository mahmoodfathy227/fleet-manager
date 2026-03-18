'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { FileText, Upload, X, Edit2, Trash2, Download } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Document {
  id: number
  file_name: string | null
  file_type: string | null
  file_path: string | null
  file_url: string | null
  doc_type: string | null
  uploaded_at: string
  uploaded_by: number | null
}

interface CertificateType {
  key: string
  name: string
  expiryField: string
}

const CERTIFICATE_TYPES: CertificateType[] = [
  { key: 'registration_expiry_date', name: 'Vehicle Plate Certificate', expiryField: 'registration_expiry_date' },
  { key: 'insurance_expiry_date', name: 'Vehicle Insurance Certificate', expiryField: 'insurance_expiry_date' },
  { key: 'mot_date', name: 'MOT Certificate', expiryField: 'mot_date' },
  { key: 'tax_date', name: 'Vehicle Tax Certificate', expiryField: 'tax_date' },
  { key: 'loler_expiry_date', name: 'LOLER Certificate', expiryField: 'loler_expiry_date' },
  { key: 'first_aid_expiry', name: 'First Aid Kit Certificate', expiryField: 'first_aid_expiry' },
  { key: 'fire_extinguisher_expiry', name: 'Fire Extinguisher Certificate', expiryField: 'fire_extinguisher_expiry' },
  { key: 'iva', name: 'IVA Certificate', expiryField: '' },
  { key: 'lpg_safety_check', name: 'LPG Safety Check', expiryField: '' },
  { key: 'interim_service_certificate', name: 'Interim Service Certificate', expiryField: '' },
  { key: 'pmi_document', name: 'PMI Document', expiryField: '' },
]

export default function VehicleComplianceDocuments({ vehicleId }: { vehicleId: number }) {
  const supabase = createClient()
  const [documents, setDocuments] = useState<Document[]>([])
  const [vehicle, setVehicle] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedCertificateType, setSelectedCertificateType] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingDocType, setEditingDocType] = useState('')

  useEffect(() => {
    loadVehicle()
    loadDocuments()
  }, [vehicleId])

  const loadVehicle = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .single()
    if (data) {
      setVehicle(data)
    }
  }

  const loadDocuments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('document_vehicle_links')
      .select('documents (id, file_name, file_type, file_path, file_url, doc_type, uploaded_at, uploaded_by)')
      .eq('vehicle_id', vehicleId)

    if (error) {
      console.error('Error fetching vehicle documents', error)
      setDocuments([])
    } else {
      const docs = (data || [])
        .map((row: any) => row.documents)
        .filter(Boolean)
        .sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
      setDocuments(docs || [])
    }
    setLoading(false)
  }

  // Map certificate keys to document type names
  const certKeyToDocType: { [key: string]: string } = {
    'registration_expiry_date': 'Vehicle Plate Certificate',
    'insurance_expiry_date': 'Vehicle Insurance Certificate',
    'mot_date': 'MOT Certificate',
    'tax_date': 'Vehicle Tax Certificate',
    'loler_expiry_date': 'LOLER Certificate',
    'first_aid_expiry': 'First Aid Kit Certificate',
    'fire_extinguisher_expiry': 'Fire Extinguisher Certificate',
    'iva': 'IVA Certificate',
    'lpg_safety_check': 'LPG Safety Check',
    'repair_invoice': 'Repair Invoice',
    'interim_service_certificate': 'Interim Service Certificate',
    'pmi_document': 'PMI Document',
  }

  const REPAIR_DOC_TYPES = ['Repair Invoice', 'Repair Document']

  // Alternate doc_type values (from Documents tab) that should match each certificate type. Case-insensitive.
  const certTypeAlternates: { [key: string]: string[] } = {
    'registration_expiry_date': ['Vehicle Plate Certificate', 'Vehicle Plate', 'Registration', 'Plate Certificate'],
    'insurance_expiry_date': ['Vehicle Insurance Certificate', 'Vehicle Insurance', 'Insurance'],
    'mot_date': ['MOT Certificate', 'MOT', 'Mot'],
    'tax_date': ['Vehicle Tax Certificate', 'Vehicle Tax', 'Tax'],
    'loler_expiry_date': ['LOLER Certificate', 'LOLER'],
    'first_aid_expiry': ['First Aid Kit Certificate', 'First Aid', 'First Aid Certificate'],
    'fire_extinguisher_expiry': ['Fire Extinguisher Certificate', 'Fire Extinguisher', 'Fire Ext'],
    'iva': ['IVA Certificate', 'IVA'],
    'lpg_safety_check': ['LPG Safety Check', 'LPG'],
    'interim_service_certificate': ['Interim Service Certificate', 'Interim Service', 'Interim'],
    'pmi_document': ['PMI Document', 'PMI'],
    'repair_invoice': ['Repair Invoice', 'Repair Document', 'Repair', 'Parts', 'Repair Invoice / Parts'],
  }

  const docMatchesCertType = (doc: Document, certType: string) => {
    const docType = (doc.doc_type || '').trim()
    if (!docType) return false
    const canonical = certKeyToDocType[certType] || certType
    if (docType === canonical) return true
    const alternates = certTypeAlternates[certType]
    if (!alternates) return false
    const lower = docType.toLowerCase()
    return alternates.some(alt => alt.toLowerCase() === lower)
  }

  // Resolve doc_type (e.g. "MOT Certificate") to cert key (e.g. "mot_date") for dropdown value
  const getCertKeyForDocType = (docType: string | null) => {
    if (!docType) return ''
    const d = docType.trim()
    const found = Object.entries(certKeyToDocType).find(([, name]) => name === d)
    if (found) return found[0]
    const altFound = Object.entries(certTypeAlternates).find(([, alts]) =>
      alts.some(a => a.toLowerCase() === d.toLowerCase())
    )
    return altFound ? altFound[0] : ''
  }

  // Get certificate types to display (IVA only if N1; LPG only if lpg_fuelled; PHV/PSV maintenance docs by type; Repair always)
  const getCertificateTypes = () => {
    let types = CERTIFICATE_TYPES.filter(cert =>
      cert.key !== 'iva' && cert.key !== 'lpg_safety_check' &&
      cert.key !== 'interim_service_certificate' && cert.key !== 'pmi_document'
    )
    if (vehicle?.vehicle_category === 'N1') types.push(CERTIFICATE_TYPES.find(c => c.key === 'iva')!)
    if (vehicle?.lpg_fuelled) types.push(CERTIFICATE_TYPES.find(c => c.key === 'lpg_safety_check')!)
    if (vehicle?.vehicle_type === 'PHV') types.push(CERTIFICATE_TYPES.find(c => c.key === 'interim_service_certificate')!)
    if (vehicle?.vehicle_type === 'PSV') types.push(CERTIFICATE_TYPES.find(c => c.key === 'pmi_document')!)
    types.push({ key: 'repair_invoice', name: 'Repair Invoice / Parts', expiryField: '' })
    return types
  }

  const getDocumentsByType = (certType: string) => {
    if (certType === 'repair_invoice') {
      return documents.filter(doc =>
        doc.doc_type && (
          REPAIR_DOC_TYPES.includes(doc.doc_type) ||
          certTypeAlternates['repair_invoice'].some(alt => alt.toLowerCase() === (doc.doc_type || '').toLowerCase())
        )
      )
    }
    const docTypeName = certKeyToDocType[certType] || certType
    return documents.filter(doc => doc.doc_type === docTypeName || docMatchesCertType(doc, certType))
  }

  // Documents that don't match any certificate type (e.g. uploaded in Documents tab with different/empty type)
  const getUnassignedDocuments = () => {
    const certTypes = getCertificateTypes()
    return documents.filter(doc => {
      const dt = (doc.doc_type || '').trim()
      if (!dt) return true
      const matchesAny = certTypes.some(cert => docMatchesCertType(doc, cert.key))
      return !matchesAny
    })
  }

  /** View URL on our domain; requires auth. Only when file_path is set. */
  const getDocumentViewUrl = (path: string | null) => {
    if (!path || path.includes('..')) return null
    return `/api/documents/view?bucket=VEHICLE_DOCUMENTS&path=${encodeURIComponent(path)}`
  }

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      setError('Please select at least one file.')
      return
    }
    if (!selectedCertificateType) {
      setError('Please select a certificate type.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      // Verify user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('You must be logged in to upload documents. Please refresh the page and try again.')
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.name.split('.').pop() || 'bin'
        const ts = Date.now()
        const rand = Math.random().toString(36).slice(2, 8)
        const storagePath = `vehicles/${vehicleId}/${selectedCertificateType}/${ts}_${rand}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('VEHICLE_DOCUMENTS')
          .upload(storagePath, file, { cacheControl: '3600', upsert: false })
        if (uploadErr) {
          console.error('Storage upload error:', uploadErr)
          throw new Error(`Failed to upload file: ${uploadErr.message}`)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('VEHICLE_DOCUMENTS')
          .getPublicUrl(storagePath)

        // Convert certificate key to document type name
        const docTypeName = certKeyToDocType[selectedCertificateType] || selectedCertificateType
        
        // Insert document record and link
        const { data: docRow, error: docErr } = await supabase.from('documents').insert({
          file_name: file.name,
          file_type: file.type,
          file_path: storagePath,
          file_url: publicUrl,
          doc_type: docTypeName,
          uploaded_by: null, // Can be updated later to track user
        }).select('id').single()
        if (docErr) {
          console.error('Document insert error:', docErr)
          console.error('Error details:', {
            message: docErr.message,
            details: docErr.details,
            hint: docErr.hint,
            code: docErr.code
          })
          console.error('Insert data:', {
            file_name: file.name,
            file_type: file.type,
            file_path: storagePath,
            file_url: publicUrl,
            doc_type: selectedCertificateType,
          })
          throw new Error(`Failed to save document record: ${docErr.message}. ${docErr.hint || ''}`)
        }
        if (docRow?.id) {
          const { error: linkErr } = await supabase.from('document_vehicle_links').insert({
            document_id: docRow.id,
            vehicle_id: vehicleId,
          })
          if (linkErr) throw linkErr
        }
      }
      setFiles(null)
      setSelectedCertificateType('')
      setShowUpload(false)
      loadDocuments()
    } catch (err: any) {
      console.error('Upload failed', err)
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleEditDocType = async (docId: number, newDocType: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ doc_type: newDocType || null })
        .eq('id', docId)

      if (error) throw error
      setEditingDoc(null)
      setEditingDocType('')
      loadDocuments()
    } catch (err: any) {
      console.error('Update failed', err)
      setError(err.message || 'Update failed')
    }
  }

  const handleDelete = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const doc = documents.find(d => d.id === docId)
      if (doc?.file_path) {
        const { error: deleteErr } = await supabase.storage
          .from('VEHICLE_DOCUMENTS')
          .remove([doc.file_path])
        if (deleteErr) console.error('Storage delete error', deleteErr)
      }

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId)

      if (error) throw error
      loadDocuments()
    } catch (err: any) {
      console.error('Delete failed', err)
      setError(err.message || 'Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="bg-navy text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Compliance Documents</span>
            </CardTitle>
            <Button size="sm" variant="secondary" onClick={() => setShowUpload(!showUpload)}>
              {showUpload ? 'Cancel' : 'Upload Document'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {showUpload && (
            <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Upload New Document</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="certType">Certificate Type *</Label>
                  <Select
                    id="certType"
                    value={selectedCertificateType}
                    onChange={(e) => setSelectedCertificateType(e.target.value)}
                  >
                    <option value="">Select certificate type...</option>
                    {getCertificateTypes().map(cert => (
                      <option key={cert.key} value={cert.key}>
                        {cert.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Files * (multiple allowed)</Label>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => setFiles(e.target.files)}
                  />
                  <p className="text-xs text-gray-500">Select one or more files per certificate type (e.g. policy + vehicle schedule for insurance).</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleUpload} disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowUpload(false)
                    setError(null)
                    setFiles(null)
                    setSelectedCertificateType('')
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-sm text-gray-600">Loading documents...</div>
          ) : (
            <div className="space-y-6">
              {getCertificateTypes().map(cert => {
                const certDocs = getDocumentsByType(cert.key)
                return (
                  <div key={cert.key} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{cert.name}</h4>
                        {vehicle && cert.expiryField && vehicle[cert.expiryField] && (
                          <p className="text-sm text-gray-600">
                            Expiry: {formatDate(vehicle[cert.expiryField])}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {certDocs.length} document{certDocs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {certDocs.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No documents uploaded</p>
                    ) : (
                      <div className="space-y-2">
                        {certDocs.map(doc => {
                          const url = getDocumentViewUrl(doc.file_path)
                          return (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                            >
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {doc.file_name || 'File'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(doc.uploaded_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 flex-shrink-0">
                                {editingDoc?.id === doc.id ? (
                                  <>
                                    <Select
                                      value={editingDocType}
                                      onChange={(e) => setEditingDocType(e.target.value)}
                                      className="text-xs"
                                    >
                                      <option value="">None</option>
                                      {getCertificateTypes().map(c => (
                                        <option key={c.key} value={c.key}>
                                          {c.name}
                                        </option>
                                      ))}
                                    </Select>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleEditDocType(doc.id, certKeyToDocType[editingDocType] || editingDocType)}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingDoc(null)
                                        setEditingDocType('')
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    {url && (
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800"
                                        title="View/Download"
                                      >
                                        <Download className="h-4 w-4" />
                                      </a>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingDoc(doc)
                                        setEditingDocType(getCertKeyForDocType(doc.doc_type))
                                      }}
                                      title="Edit document type"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDelete(doc.id)}
                                      title="Delete"
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Other documents: from Documents tab that don't match a certificate type */}
              {getUnassignedDocuments().length > 0 && (
                <div className="border rounded-lg p-4 border-amber-200 bg-amber-50/30">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">Other documents</h4>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Uploaded in Documents tab or with a different type. Assign a certificate type below to move them into the right section.
                      </p>
                    </div>
                    <span className="text-sm text-gray-500">
                      {getUnassignedDocuments().length} document{getUnassignedDocuments().length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {getUnassignedDocuments().map(doc => {
                      const url = getDocumentViewUrl(doc.file_path)
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2 bg-white rounded border border-amber-100"
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {doc.file_name || 'File'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {doc.doc_type ? `${doc.doc_type} · ` : ''}{new Date(doc.uploaded_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {editingDoc?.id === doc.id ? (
                              <>
                                <Select
                                  value={editingDocType}
                                  onChange={(e) => setEditingDocType(e.target.value)}
                                  className="text-xs"
                                >
                                  <option value="">None</option>
                                  {getCertificateTypes().map(c => (
                                    <option key={c.key} value={c.key}>
                                      {c.name}
                                    </option>
                                  ))}
                                </Select>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleEditDocType(doc.id, editingDocType ? (certKeyToDocType[editingDocType] || editingDocType) : '')}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingDoc(null)
                                    setEditingDocType('')
                                  }}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                {url && (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                    title="View/Download"
                                  >
                                    <Download className="h-4 w-4" />
                                  </a>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingDoc(doc)
                                    setEditingDocType(getCertKeyForDocType(doc.doc_type))
                                  }}
                                  title="Assign certificate type"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(doc.id)}
                                  title="Delete"
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

