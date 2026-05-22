'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AvatarUploadProps {
  avatarUrl: string | null
  displayName: string
  email: string
  onUpload: (file: File) => void
  onDelete: () => void
  uploading?: boolean
}

function getInitials(displayName: string, email: string): string {
  const src = (displayName || email || '?').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

export function AvatarUpload({
  avatarUrl,
  displayName,
  email,
  onUpload,
  onDelete,
  uploading = false,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setFileError('Only PNG or JPG images are allowed.')
      return
    }
    if (file.size > 500 * 1024) {
      setFileError('File is larger than 500 KB.')
      return
    }

    setFileError(null)
    onUpload(file)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar circle */}
      <div className="relative size-24 shrink-0">
        <div className="relative size-24 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden text-primary text-2xl font-semibold select-none">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill className="object-cover" />
          ) : (
            getInitials(displayName, email)
          )}
        </div>

        {/* Upload hover overlay */}
        {!uploading && (
          <button
            type="button"
            className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload avatar"
          >
            <Camera size={20} className="text-white" strokeWidth={1.75} />
          </button>
        )}

        {/* Uploading spinner overlay */}
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 size={22} strokeWidth={1.75} className="text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          Select a file
        </Button>

        {avatarUrl && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={onDelete}
            disabled={uploading}
            aria-label="Remove avatar"
            className="size-7"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </Button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleFileChange}
      />

      {fileError ? (
        <p className="text-xs text-destructive text-center max-w-[140px]">{fileError}</p>
      ) : (
        <p className="text-xs text-muted-foreground text-center max-w-[140px] leading-snug">
          PNG/JPG, max 500 KB, square recommended
        </p>
      )}
    </div>
  )
}
