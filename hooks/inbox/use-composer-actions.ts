'use client'

import type { RefObject } from 'react'
import { normalizeSafeUrl } from '@/lib/inbox-utils'

type ShowToast = (msg: string, type?: 'success' | 'error') => void

/**
 * Composer business logic — formatting, link insertion, image upload, file attach.
 *
 * NOTE: These functions use document.execCommand which is deprecated but still
 * widely supported. A future migration to Tiptap or ProseMirror is planned.
 */
export function useComposerActions(
  composerRef: RefObject<HTMLDivElement | null>,
  setReply: (val: string) => void,
  setAttachments: (fn: (prev: { name: string; size: number }[]) => { name: string; size: number }[]) => void,
  showToast: ShowToast,
) {
  // TODO: document.execCommand is deprecated. Replace with Tiptap/ProseMirror in the future.
  function formatDoc(cmd: string, val?: string) {
    composerRef.current?.focus()
    document.execCommand(cmd, false, val || undefined)
  }

  function insertLink() {
    const url = prompt('Enter URL:')
    const safeUrl = normalizeSafeUrl(url)
    if (url && !safeUrl) {
      showToast('Only http, https, or mailto links are allowed', 'error')
      return
    }
    if (safeUrl) {
      composerRef.current?.focus()
      // TODO: document.execCommand is deprecated
      document.execCommand('createLink', false, safeUrl)
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/^image\/(png|jpe?g|gif|webp)$/i.test(file.type)) {
      showToast('Unsupported image type', 'error')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const src = normalizeSafeUrl(reader.result as string, { allowImages: true })
      if (!src) {
        showToast('Unsupported image type', 'error')
        return
      }
      composerRef.current?.focus()
      // TODO: document.execCommand is deprecated
      document.execCommand('insertImage', false, src)
      setReply(composerRef.current?.textContent || '')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setAttachments((prev) => [
      ...prev,
      ...files.map((f) => ({ name: f.name, size: f.size })),
    ])
    e.target.value = ''
  }

  function insertEmoji(emoji: string) {
    composerRef.current?.focus()
    // TODO: document.execCommand is deprecated
    document.execCommand('insertText', false, emoji)
    setReply(composerRef.current?.textContent || '')
  }

  return {
    formatDoc,
    insertLink,
    handleImageUpload,
    handleFileAttach,
    insertEmoji,
  }
}
