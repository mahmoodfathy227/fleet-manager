'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Upload, Loader2, X } from 'lucide-react'

const BUCKET = 'MAINTENANCE_ICONS'
const ACCEPT = 'image/*'

interface IconPathUploadProps {
  value: string
  onChange: (path: string) => void
  disabled?: boolean
}

export function IconPathUpload({ value, onChange, disabled }: IconPathUploadProps) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const publicUrl = value
    ? supabase.storage.from(BUCKET).getPublicUrl(value).data.publicUrl
    : null

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    setError(null)
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `icons/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    setUploading(false)
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    onChange(path)
  }

  function handleRemove() {
    onChange('')
    setError(null)
  }

  return (
    <div>
      <Label>Icon image</Label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload from PC
            </>
          )}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={disabled}>
            <X className="mr-2 h-4 w-4" />
            Remove
          </Button>
        )}
      </div>
      {publicUrl && value && (
        <div className="mt-3 flex items-center gap-3">
          <img
            src={publicUrl}
            alt="Icon preview"
            className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
          />
          <span className="text-xs text-slate-500 truncate max-w-[200px]" title={value}>
            {value}
          </span>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
