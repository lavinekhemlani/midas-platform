// src/components/account/ManageUploadsForm.tsx
'use client'

import React, { useState, useRef, ChangeEvent } from 'react'
import { Loader2, Upload, FileText, Trash2, CheckCircle, Paperclip, Lock } from 'lucide-react'
import { Organization, StoredFile } from '@/lib/data'
import { logger } from '@/lib/logger'

interface ManageUploadsFormProps {
  initialData: Organization
  orgId: string
  onUpdateSuccess: (message: string) => void
}

// Define allowed file types and size limits
const ALLOWED_FILE_TYPES = {
  corp_profile: [
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  manual_financials: [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
}
const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const FileUploader = ({
  fieldType,
  label,
  orgId,
  onUpdateSuccess,
  disabled,
}: {
  fieldType: 'corp_profile' | 'manual_financials'
  label: string
  orgId: string
  onUpdateSuccess: (message: string) => void
  disabled: boolean
}) => {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!ALLOWED_FILE_TYPES[fieldType].includes(file.type)) {
      return `Invalid file type. Allowed types for ${fieldType === 'corp_profile' ? 'corporate profile' : 'financial documents'}: ${ALLOWED_FILE_TYPES[fieldType].join(', ')}`
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File is too large (max ${MAX_FILE_SIZE_MB}MB). Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`
    }

    return null
  }

  const handleUpload = async (fileToUpload: File | null) => {
    if (!fileToUpload) return

    // Validate file before uploading
    const validationError = validateFile(fileToUpload)
    if (validationError) {
      setError(validationError)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      // 1. Get Presigned URL - ensure we're using user/org directory structure
      const presignResponse = await fetch(
        `/api/upload/presign?type=${fieldType}&fileName=${encodeURIComponent(fileToUpload.name)}&contentType=${encodeURIComponent(fileToUpload.type)}&orgId=${orgId}`
      )
      if (!presignResponse.ok) {
        const errData = await presignResponse.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to prepare file upload.')
      }
      const { uploadUrl, key } = await presignResponse.json()

      // 2. Upload to S3
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', fileToUpload.type)
        xhr.upload.onprogress = (e) =>
          setUploadProgress(e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : 50)
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed.`))
        xhr.onerror = () =>
          reject(new Error('Network error during upload. Check bucket CORS settings.'))
        xhr.send(fileToUpload)
      })

      // 3. Update organization record via PUT request
      const newFile: StoredFile = {
        s3Key: key,
        fileName: fileToUpload.name,
        fileSize: fileToUpload.size,
        uploadedAt: Math.floor(Date.now() / 1000),
      }
      const updateResponse = await fetch(`/api/organizations/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: newFile, type: fieldType }),
      })
      if (!updateResponse.ok) throw new Error('Failed to save file reference.')

      onUpdateSuccess(`Successfully uploaded ${fileToUpload.name}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleUpload(e.target.files?.[0] || null)}
        className="hidden"
        accept={ALLOWED_FILE_TYPES[fieldType].join(',')}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="btn-secondary text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5"
      >
        {isUploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {isUploading ? `${uploadProgress}%` : label}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}

export default function ManageUploadsForm({
  initialData,
  orgId,
  onUpdateSuccess,
}: ManageUploadsFormProps) {
  const [deletingKey, setDeletingKey] = useState<string | null>(null) // <-- FIX for delete button bug

  const handleDelete = async (s3Key: string, type: 'corp_profile' | 'manual_financials') => {
    if (!window.confirm('Are you sure you want to delete this file? This cannot be undone.')) return
    setDeletingKey(s3Key) // Set the specific key being deleted
    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key, type }),
      })
      if (!response.ok) throw new Error('Failed to delete file.')
      onUpdateSuccess('File deleted successfully.')
    } catch (error) {
      logger.error('Failed to delete file:', { error, component: 'ManageUploadsForm' })
    } finally {
      setDeletingKey(null) // Reset loading state
    }
  }

  const formatDate = (epoch: number) => new Date(epoch * 1000).toLocaleDateString()
  const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

  return (
    <div className="space-y-8 document-upload">
      {/* Corporate Profile Section (Single File) */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="zenith-label mb-0">Corporate Profile</h3>
          <FileUploader
            fieldType="corp_profile"
            label={initialData.corp_profile ? 'Replace' : 'Upload'}
            orgId={orgId}
            onUpdateSuccess={onUpdateSuccess}
            disabled={!!deletingKey}
          />
        </div>
        {initialData.corp_profile ? (
          <div className="flex items-center gap-3 p-3 glass-luxury rounded-lg border border-[var(--theme-card-border)]">
            <Paperclip className="w-5 h-5 text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium theme-text-primary truncate">
                {initialData.corp_profile.fileName}
              </p>
              <p className="text-xs theme-text-secondary">
                Uploaded: {formatDate(initialData.corp_profile.uploadedAt)} • Size:{' '}
                {formatSize(initialData.corp_profile.fileSize)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(initialData.corp_profile!.s3Key, 'corp_profile')}
              disabled={!!deletingKey}
              className="p-2 text-red-500 hover:bg-red-500/10 rounded-full"
            >
              {deletingKey === initialData.corp_profile.s3Key ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        ) : (
          <p className="text-sm italic theme-text-secondary">No Corporate Profile Uploaded.</p>
        )}
      </div>

      {/* Financial Documents Section (Multiple Files) */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h3 className="zenith-label">Financial Documents</h3>
            <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="relative">
            <FileUploader
              fieldType="manual_financials"
              label="Add Document"
              orgId={orgId}
              onUpdateSuccess={onUpdateSuccess}
              disabled={true}
            />
            <div
              className="absolute inset-0 bg-gray-500/20 rounded-md cursor-not-allowed"
              title="Upgrade to Pro to unlock manual uploads"
            ></div>
          </div>
        </div>
        <div className="relative">
          {initialData.manual_financials && initialData.manual_financials.length > 0 ? (
            <ul className="space-y-2">
              {initialData.manual_financials.map((file) => (
                <li
                  key={file.s3Key}
                  className="flex items-center gap-3 p-3 glass-luxury rounded-lg border border-[var(--theme-card-border)] opacity-60"
                >
                  <Paperclip className="w-5 h-5 text-emerald-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium theme-text-primary truncate">
                      {file.fileName}
                    </p>
                    <p className="text-xs theme-text-secondary">
                      Uploaded: {formatDate(file.uploadedAt)} • Size: {formatSize(file.fileSize)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="p-2 text-gray-400 cursor-not-allowed rounded-full"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 glass-luxury rounded-lg border border-[var(--theme-card-border)] text-center opacity-60">
              <p className="text-sm italic theme-text-secondary mb-2">
                Manual upload feature available in Pro tier
              </p>
              <button className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 transition-colors">
                Upgrade to Pro
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
