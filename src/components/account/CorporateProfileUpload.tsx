// src/components/account/CorporateProfileUpload.tsx
'use client'

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { Loader2, Upload, Trash2, FileText, X, CheckCircle, AlertTriangle } from 'lucide-react'
import { Organization, StoredFile } from '@/lib/data'

interface CorporateProfileUploadProps {
  organization: Organization
  orgId: string
  onUpdateSuccess: (message: string) => void
}

// Define allowed file types and size limits
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]
const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export default function CorporateProfileUpload({
  organization,
  orgId,
  onUpdateSuccess,
}: CorporateProfileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return `Invalid file type. Allowed: PDF, PPT, PPTX.`
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File is too large (max ${MAX_FILE_SIZE_MB}MB). Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`
    }

    return null
  }

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setSelectedFile(file)
    setUploadSuccess(false)
    handleUpload(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleUpload = async (fileToUpload: File) => {
    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      // 1. Get Presigned URL
      setUploadProgress(10)
      const presignResponse = await fetch(
        `/api/upload/presign?type=corp_profile&fileName=${encodeURIComponent(fileToUpload.name)}&contentType=${encodeURIComponent(fileToUpload.type)}&orgId=${orgId}`
      )
      if (!presignResponse.ok) {
        const errData = await presignResponse.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to prepare file upload.')
      }
      const { uploadUrl, key } = await presignResponse.json()

      // 2. Upload to S3
      setUploadProgress(30)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', fileToUpload.type)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 70) + 30 // 30-100%
            setUploadProgress(percentComplete)
          }
        }
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed.`))
        xhr.onerror = () => reject(new Error('Network error during upload.'))
        xhr.send(fileToUpload)
      })

      // 3. Update organization record
      setUploadProgress(90)
      const newFile: StoredFile = {
        s3Key: key,
        fileName: fileToUpload.name,
        fileSize: fileToUpload.size,
        uploadedAt: Math.floor(Date.now() / 1000),
      }
      const updateResponse = await fetch(`/api/organizations/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: newFile, type: 'corp_profile' }),
      })
      if (!updateResponse.ok) throw new Error('Failed to save file reference.')

      setUploadProgress(100)
      setUploadSuccess(true)
      onUpdateSuccess(`Successfully uploaded ${fileToUpload.name}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.')
      setSelectedFile(null)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    if (!organization.corp_profile) return
    if (!window.confirm('Are you sure you want to delete this file? This cannot be undone.')) return

    setIsDeleting(true)
    setError(null)
    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key: organization.corp_profile.s3Key, type: 'corp_profile' }),
      })
      if (!response.ok) throw new Error('Failed to delete file.')
      onUpdateSuccess('Corporate profile deleted successfully.')
      setSelectedFile(null)
      setUploadSuccess(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete file.')
    } finally {
      setIsDeleting(false)
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setError(null)
    setUploadSuccess(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatDate = (epoch: number) => new Date(epoch * 1000).toLocaleDateString()
  const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

  const existingFile = organization.corp_profile
  const displayFile = selectedFile || existingFile

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold theme-text-primary mb-1">
          Corporate Profile Document
        </h3>
        <p className="text-sm theme-text-secondary">
          Upload your pitch deck, company overview, or investor presentation
        </p>
      </div>

      <div className="zenith-form-group">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
            isDragOver
              ? 'border-amber-500 bg-amber-500/5'
              : 'metric-card-bg hover:border-amber-500/50 hover:bg-amber-500/5'
          } ${error ? 'border-red-500' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !displayFile && fileInputRef.current?.click()}
        >
          {displayFile ? (
            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              {uploadSuccess ? (
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              ) : isUploading ? (
                <Loader2 className="w-12 h-12 text-amber-500 mx-auto animate-spin" />
              ) : (
                <FileText className="w-12 h-12 text-amber-500 mx-auto" />
              )}

              <p className="text-sm font-medium theme-text-primary">
                {selectedFile ? selectedFile.name : existingFile?.fileName}
              </p>

              {selectedFile && (
                <p className="text-xs theme-text-secondary">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              )}

              {existingFile && !selectedFile && (
                <p className="text-xs theme-text-secondary">
                  Uploaded: {formatDate(existingFile.uploadedAt)} • Size:{' '}
                  {formatSize(existingFile.fileSize)}
                </p>
              )}

              {isUploading && (
                <div className="w-full bg-gray-700 rounded-full h-2 max-w-xs mx-auto">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              {!isUploading && !isDeleting && (
                <div className="flex gap-2 justify-center">
                  {selectedFile && !uploadSuccess && (
                    <button
                      type="button"
                      onClick={removeFile}
                      className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center transition-colors"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </button>
                  )}
                  {existingFile && !selectedFile && (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs px-3 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 flex items-center transition-colors"
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 flex items-center transition-colors"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </button>
                    </>
                  )}
                </div>
              )}

              {isDeleting && (
                <div className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                  <span className="ml-2 text-xs text-red-500">Deleting...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-12 h-12 text-gray-500 mx-auto" />
              <div>
                <p className="text-sm theme-text-primary">
                  Drag and drop your corporate profile here, or{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                    className="text-amber-500 underline hover:text-amber-400 transition-colors inline-block"
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs theme-text-secondary mt-1">
                  PDF, PPT, or PPTX files up to {MAX_FILE_SIZE_MB}MB
                </p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.ppt,.pptx"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isUploading || isDeleting}
          />
        </div>

        {error && (
          <div className="mt-2 p-2 bg-red-500/10 text-red-400 rounded text-xs flex items-center">
            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
