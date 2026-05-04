'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import {
  ArrowLeft, X, Loader2, Check, AlertCircle, Plus,
  Bold, Italic, Underline, Link2, Image as ImageIcon,
  Code, Heading2, List, ListOrdered, Variable,
} from 'lucide-react'
import { TAG_PALETTE } from '../../lib/tags'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const LANGUAGES = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'en',   label: 'English'     },
  { value: 'nl',   label: 'Dutch'       },
  { value: 'fr',   label: 'French'      },
  { value: 'de',   label: 'German'      },
  { value: 'es',   label: 'Spanish'     },
  { value: 'it',   label: 'Italian'     },
]

const VARIABLES = [
  { token: '{{ticket.customer.firstname}}', label: 'Customer first name' },
  { token: '{{ticket.customer.lastname}}',  label: 'Customer last name'  },
  { token: '{{ticket.customer.email}}',     label: 'Customer email'      },
  { token: '{{ticket.id}}',                 label: 'Ticket ID'           },
  { token: '{{ticket.subject}}',            label: 'Ticket subject'      },
  { token: '{{agent.name}}',                label: 'Agent name'          },
  { token: '{{agent.email}}',               label: 'Agent email'         },
  { token: '{{workspace.name}}',            label: 'Workspace name'      },
]

const CSS = `
  .me-root { font-family: 'Rethink Sans', sans-serif; color: #1C0F36; }
  .me-wrap { max-width: 900px; margin: 0 auto; padding: 32px 40px 48px; }

  .me-back {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; margin-left: -10px;
    background: none; border: none; color: #6B5E7B; font-size: 13px; font-family: inherit;
    cursor: pointer; border-radius: 6px; transition: background 0.15s, color 0.15s;
    text-decoration: none;
  }
  .me-back:hover { background: #F1EEF5; color: #1C0F36; }

  .me-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin: 12px 0 24px; }
  .me-title { font-size: 22px; font-weight: 600; color: #1C0F36; margin: 0; }

  .me-grid { display: grid; grid-template-columns: 1fr 240px; gap: 16px; margin-bottom: 18px; }
  @media (max-width: 720px) { .me-grid { grid-template-columns: 1fr; } }

  .me-field { margin-bottom: 18px; }
  .me-label { display: block; font-size: 13px; font-weight: 500; color: #1C0F36; margin-bottom: 6px; }
  .me-hint  { margin: 5px 0 0; font-size: 11px; color: #9B91A8; }
  .me-fielderr { margin: 5px 0 0; font-size: 12px; color: #DC2626; }
  .me-input, .me-select {
    width: 100%; padding: 9px 12px; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 14px; font-family: inherit; color: #1C0F36; outline: none; box-sizing: border-box;
    background: #fff; transition: border-color 0.15s;
  }
  .me-input:focus, .me-select:focus { border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15); }
  .me-input.error { border-color: #FCA5A5; box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }
  .me-select {
    -webkit-appearance: none; appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239B91A8' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    padding-right: 32px;
  }

  /* Tag input */
  .me-tags-wrap {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
    padding: 6px 8px; border: 1px solid #E5E0EB; border-radius: 8px; background: #fff;
    min-height: 40px; transition: border-color 0.15s;
  }
  .me-tags-wrap:focus-within { border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15); }
  .me-tag {
    display: inline-flex; align-items: center; gap: 4px; padding: 3px 4px 3px 10px;
    background: #F1F5F9; color: #1E293B; border-radius: 20px; font-size: 12px; font-weight: 500;
  }
  .me-tag-remove {
    width: 18px; height: 18px; border: none; background: transparent; cursor: pointer;
    color: #6B5E7B; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  }
  .me-tag-remove:hover { background: rgba(0,0,0,0.05); color: #1C0F36; }
  .me-tag-input {
    border: none; outline: none; background: transparent; flex: 1; min-width: 120px;
    font-family: inherit; font-size: 13px; color: #1C0F36; padding: 4px 4px;
  }
  .me-tag-picker { position: relative; }
  .me-tag-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 60;
    background: #fff; border: 1px solid #E5E0EB; border-radius: 10px;
    box-shadow: 0 8px 24px rgba(28,15,54,0.12); overflow-y: auto; max-height: 240px;
    padding: 4px 0;
  }
  .me-tag-option {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    border: none; background: none; width: 100%; text-align: left;
    cursor: pointer; font-family: inherit; font-size: 13px; color: #1C0F36;
    transition: background 0.1s;
  }
  .me-tag-option:hover { background: #F8F7FA; }
  .me-tag-option-name { flex: 1; }
  .me-tag-option-count { font-size: 11px; color: #9B91A8; flex-shrink: 0; }
  .me-tag-option-create { color: #A175FC; border-top: 1px solid #F0EDF4; }
  .me-tag-option-create:hover { background: #F7F3FF; }

  /* Editor */
  .me-editor-wrap { border: 1px solid #E5E0EB; border-radius: 8px; overflow: hidden; background: #fff; }
  .me-editor-wrap:focus-within { border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15); }

  .me-toolbar {
    display: flex; align-items: center; gap: 2px; padding: 6px 8px;
    border-bottom: 1px solid #E5E0EB; background: #FAFAFB; flex-wrap: wrap;
  }
  .me-tb-btn {
    width: 30px; height: 30px; border: none; background: transparent; cursor: pointer;
    color: #6B5E7B; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.1s, color 0.1s;
  }
  .me-tb-btn:hover { background: #F1EEF5; color: #1C0F36; }
  .me-tb-divider { width: 1px; height: 18px; background: #E5E0EB; margin: 0 4px; }

  .me-tb-vars-wrap { position: relative; margin-left: auto; }
  .me-tb-vars-btn {
    display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 6px;
    border: 1px solid #E5E0EB; background: #fff; color: #1C0F36; font-size: 12px; font-weight: 500;
    cursor: pointer; font-family: inherit;
  }
  .me-tb-vars-btn:hover { background: #F1EEF5; }
  .me-vars-panel {
    position: absolute; right: 0; top: calc(100% + 4px); z-index: 60;
    background: #fff; border: 1px solid #E5E0EB; border-radius: 10px;
    box-shadow: 0 8px 24px rgba(28,15,54,0.12); min-width: 280px; padding: 4px 0;
    max-height: 280px; overflow-y: auto;
  }
  .me-var-item {
    display: block; padding: 8px 12px; background: none; border: none; width: 100%;
    text-align: left; font-family: inherit; cursor: pointer; font-size: 13px;
  }
  .me-var-item:hover { background: #F8F7FA; }
  .me-var-token { color: #1E293B; font-family: ui-monospace, monospace; font-size: 12px; font-weight: 500; }
  .me-var-label { color: #6B5E7B; font-size: 11px; margin-top: 1px; }

  .me-editor {
    min-height: 280px; padding: 14px 16px; outline: none; font-size: 14px; line-height: 1.6;
    color: #1C0F36; font-family: inherit; max-height: 600px; overflow-y: auto;
  }
  .me-editor:empty:before {
    content: attr(data-placeholder); color: #9B91A8; pointer-events: none;
  }
  .me-editor h2 { font-size: 18px; font-weight: 600; margin: 12px 0 6px; }
  .me-editor p  { margin: 0 0 8px; }
  .me-editor ul, .me-editor ol { margin: 0 0 8px; padding-left: 22px; }
  .me-editor a { color: #A175FC; text-decoration: underline; }
  .me-editor code {
    background: #F1F5F9; color: #1E293B; padding: 1px 5px; border-radius: 4px;
    font-family: ui-monospace, monospace; font-size: 13px;
  }
  .me-editor img { max-width: 100%; border-radius: 6px; }

  .me-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px; }

  .me-error-bar {
    display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px;
    background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px;
    margin-bottom: 16px; font-size: 13px; color: #DC2626;
  }

  .btn-primary {
    display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px;
    background: #A175FC; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
    transition: background 0.15s; white-space: nowrap;
  }
  .btn-primary:hover:not(:disabled) { background: #8B5CF6; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary {
    display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px;
    background: #fff; color: #1C0F36; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
  }
  .btn-secondary:hover { background: #F8F7FA; }

  .me-toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    display: flex; align-items: center; gap: 10px; padding: 11px 12px 11px 14px;
    border-radius: 10px; font-size: 14px; font-family: inherit; font-weight: 500;
    box-shadow: 0 8px 24px rgba(28,15,54,0.16); animation: me-slide 0.2s ease; max-width: 420px;
  }
  .me-toast-ok  { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
  .me-toast-err { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
  @keyframes me-slide { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`

// Save selection in the editor body so toolbar buttons can apply
// formatting at the right place even after the toolbar steals focus.
//
// Crucially: only saves a range when the active element is INSIDE the
// editor — otherwise we'd capture a selection in the name input or a
// tag pill, and "restore" would point to the wrong element.
function useSavedSelection(editorRef) {
  const ref = useRef(null)
  return {
    save: () => {
      const editor = editorRef.current
      if (!editor) return
      const active = document.activeElement
      // Bail out if the user wasn't editing inside the body
      if (!active || !editor.contains(active)) {
        ref.current = null
        return
      }
      const sel = window.getSelection()
      ref.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null
    },
    restore: () => {
      if (!ref.current) return false
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(ref.current)
      return true
    },
  }
}

// Place the cursor at the end of the editor's contents.
function placeCursorAtEnd(editorEl) {
  const range = document.createRange()
  range.selectNodeContents(editorEl)
  range.collapse(false)  // collapse to end
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
  return range
}

// Insert plain text at the current selection inside the editor.
// Uses the Range API directly (more reliable than execCommand on empty
// contentEditable / collapsed selections / Firefox edge cases).
// Returns true if insertion happened.
function insertTextAtCursor(editorEl, text) {
  editorEl.focus()
  const sel = window.getSelection()

  // Ensure there's a valid range INSIDE the editor; if not, jump to end
  let range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
  const inEditor = range && editorEl.contains(range.commonAncestorContainer)
  if (!inEditor) {
    range = placeCursorAtEnd(editorEl)
  }

  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.setEndAfter(node)
  sel.removeAllRanges()
  sel.addRange(range)

  // contentEditable input events don't fire for programmatic mutations,
  // so fire one manually so the React onInput handler updates state.
  editorEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false }))
  return true
}

export default function MacroEditor({ macroId, initialMacro = null, mode }) {
  const router = useRouter()
  const isNew  = mode === 'new'

  const [name,     setName]     = useState(initialMacro?.name     ?? '')
  const [language, setLanguage] = useState(initialMacro?.language ?? 'auto')
  // selectedTags: array of {id?, name, color} — id missing means
  // "create new on save". allTags: full workspace tag list for picker.
  const [selectedTags, setSelectedTags] = useState(
    Array.isArray(initialMacro?.tagObjects) && initialMacro.tagObjects.length
      ? initialMacro.tagObjects
      : (initialMacro?.tags || []).map(name => ({ name, color: 'slate' }))
  )
  const [allTags,  setAllTags]   = useState([])
  const [tagDraft, setTagDraft]  = useState('')
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [body,     setBody]     = useState(initialMacro?.body     ?? '')
  const tagPickerRef = useRef(null)

  const [loading, setLoading] = useState(!isNew && !initialMacro)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const [nameError, setNameError] = useState(null)
  const [varsOpen, setVarsOpen]   = useState(false)
  const [toast, setToast] = useState(null)

  const editorRef = useRef(null)
  const sel       = useSavedSelection(editorRef)

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    if (type === 'ok') setTimeout(() => setToast(null), 4000)
  }

  // Fetch existing macro for edit mode (if not pre-supplied)
  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  useEffect(() => {
    if (isNew || initialMacro) return
    let cancelled = false
    ;(async () => {
      const token = await getToken()
      if (!token) { setError('Not authenticated — please refresh.'); setLoading(false); return }
      const res = await fetch(`/api/macros/${macroId}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json().catch(() => ({}))
      if (cancelled) return
      if (!res.ok || !data.macro) {
        setError(data.error || 'Macro not found')
        setLoading(false)
        return
      }
      setName(data.macro.name)
      setLanguage(data.macro.language)
      // Prefer tagObjects (id+color) from new join; fall back to legacy strings
      if (Array.isArray(data.macro.tagObjects) && data.macro.tagObjects.length) {
        setSelectedTags(data.macro.tagObjects)
      } else if (Array.isArray(data.macro.tags)) {
        setSelectedTags(data.macro.tags.map(name => ({ name, color: 'slate' })))
      }
      setBody(data.macro.body || '')
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [isNew, macroId, initialMacro, getToken])

  // Fetch workspace tag list for the picker dropdown (one-shot on mount)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getToken()
      if (!token) return
      const res  = await fetch('/api/tags', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      if (!cancelled && Array.isArray(data.tags)) setAllTags(data.tags)
    })()
    return () => { cancelled = true }
  }, [getToken])

  // Close tag picker on outside click + Escape
  useEffect(() => {
    if (!tagPickerOpen) return
    const handler = (e) => {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target)) {
        setTagPickerOpen(false)
      }
    }
    const onKey = (e) => { if (e.key === 'Escape') setTagPickerOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown',   onKey)
    }
  }, [tagPickerOpen])

  // Keep contentEditable HTML in sync with state on initial load only
  // (subsequent edits flow state ← editor via onInput, never the other way)
  const initialBodyApplied = useRef(false)
  useEffect(() => {
    if (initialBodyApplied.current) return
    if (!editorRef.current) return
    if (loading) return
    editorRef.current.innerHTML = body || ''
    initialBodyApplied.current = true
  }, [loading, body])

  // ── Tag picker ──
  function addExistingTag(tag) {
    setSelectedTags(prev => {
      const lc = tag.name.toLowerCase()
      if (prev.some(t => t.name.toLowerCase() === lc)) return prev
      return [...prev, { id: tag.id, name: tag.name, color: tag.color }].slice(0, 25)
    })
    setTagDraft('')
  }

  // Adds an unsaved tag (will be created on macro save) — used when the
  // typed name doesn't match any existing tag.
  function createInlineTag(rawName) {
    const name = rawName.trim().slice(0, 40)
    if (!name) return
    setSelectedTags(prev => {
      const lc = name.toLowerCase()
      if (prev.some(t => t.name.toLowerCase() === lc)) return prev
      // If it actually does match an existing workspace tag (case-insensitive),
      // attach the existing object so we get the real id + color.
      const existing = allTags.find(t => t.name.toLowerCase() === lc)
      if (existing) return [...prev, { id: existing.id, name: existing.name, color: existing.color }].slice(0, 25)
      return [...prev, { name, color: 'slate' }].slice(0, 25)
    })
    setTagDraft('')
  }

  function removeTag(name) {
    const lc = name.toLowerCase()
    setSelectedTags(prev => prev.filter(t => t.name.toLowerCase() !== lc))
  }

  function onTagDraftKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (tagDraft.trim()) createInlineTag(tagDraft)
    } else if (e.key === 'Backspace' && tagDraft === '' && selectedTags.length > 0) {
      setSelectedTags(prev => prev.slice(0, -1))
    } else if (e.key === 'ArrowDown') {
      setTagPickerOpen(true)
    } else if (e.key === 'Escape') {
      setTagPickerOpen(false)
    }
  }

  // Available tags = workspace tags not already selected, filtered by draft
  const availableTags = (() => {
    const selectedLc = new Set(selectedTags.map(t => t.name.toLowerCase()))
    const draftLc    = tagDraft.trim().toLowerCase()
    return allTags
      .filter(t => !selectedLc.has(t.name.toLowerCase()))
      .filter(t => !draftLc || t.name.toLowerCase().includes(draftLc))
      .slice(0, 50)
  })()

  // Should we show "Create new tag" option? Only if draft has text and
  // no exact match exists in workspace.
  const showCreateOption = (() => {
    const draftLc = tagDraft.trim().toLowerCase()
    if (!draftLc) return false
    const allLc      = new Set(allTags.map(t => t.name.toLowerCase()))
    const selectedLc = new Set(selectedTags.map(t => t.name.toLowerCase()))
    return !allLc.has(draftLc) && !selectedLc.has(draftLc)
  })()

  // ── Editor toolbar ──
  function exec(cmd, value = null) {
    sel.restore()
    document.execCommand(cmd, false, value)
    if (editorRef.current) setBody(editorRef.current.innerHTML)
  }
  function insertHtml(html) {
    sel.restore()
    document.execCommand('insertHTML', false, html)
    if (editorRef.current) setBody(editorRef.current.innerHTML)
  }
  function insertVariable(token) {
    const editor = editorRef.current
    if (!editor) { setVarsOpen(false); return }

    // Restore the saved range if it exists (and is inside the editor —
    // useSavedSelection enforces that). If not, insertTextAtCursor will
    // place the cursor at the end of the body as a fallback.
    sel.restore()
    insertTextAtCursor(editor, token)
    setVarsOpen(false)
  }
  function insertLink() {
    sel.save()
    const url = window.prompt('Enter the URL:')
    if (!url) return
    exec('createLink', url)
  }
  function insertImage() {
    sel.save()
    const url = window.prompt('Enter image URL:')
    if (!url) return
    exec('insertImage', url)
  }
  function insertCode() {
    sel.restore()
    const sel2 = window.getSelection()
    const text = sel2 ? sel2.toString() : ''
    const html = text ? `<code>${escapeHtml(text)}</code>` : '<code>code</code>'
    insertHtml(html)
  }
  function setHeading() {
    exec('formatBlock', 'h2')
  }

  // ── Save ──
  async function handleSave() {
    setError(null)
    setNameError(null)
    if (!name.trim()) { setNameError('Name is required.'); return }
    if (name.trim().length > 200) { setNameError('Name is too long (max 200).'); return }

    const liveBody = editorRef.current?.innerHTML ?? body

    setSaving(true)
    const token = await getToken()
    const url    = isNew ? '/api/macros' : `/api/macros/${macroId}`
    const method = isNew ? 'POST'        : 'PATCH'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: name.trim(),
        body: liveBody,
        language,
        // Send tag NAMES (existing API contract). Server upserts each name
        // into public.tags then syncs the macro_tags join.
        tags: selectedTags.map(t => t.name),
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      if (data.code === 'name_required') { setNameError(data.error); return }
      setError(data.error || 'Failed to save macro')
      return
    }

    showToast(isNew ? 'Macro created' : 'Macro saved')
    setTimeout(() => router.push('/settings/workspace/macros'), 600)
  }

  if (loading) {
    return (
      <div className="me-root">
        <style>{CSS}</style>
        <div className="me-wrap" style={{ textAlign: 'center', padding: '80px 24px' }}>
          <Loader2 size={20} strokeWidth={1.75} className="spin" style={{ color: '#9B91A8' }} />
          <p style={{ marginTop: 8, fontSize: 14, color: '#9B91A8' }}>Loading macro…</p>
        </div>
      </div>
    )
  }

  if (error && !initialMacro && !name) {
    return (
      <div className="me-root">
        <style>{CSS}</style>
        <div className="me-wrap">
          <button className="me-back" onClick={() => router.push('/settings/workspace/macros')}>
            <ArrowLeft size={14} strokeWidth={1.75} /> Back to macros
          </button>
          <div className="me-error-bar" style={{ marginTop: 16 }}>
            <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="me-root">
      <style>{CSS}</style>
      <div className="me-wrap">
        <button className="me-back" onClick={() => router.push('/settings/workspace/macros')}>
          <ArrowLeft size={14} strokeWidth={1.75} /> Back to macros
        </button>

        <div className="me-header">
          <h1 className="me-title">{isNew ? 'Create macro' : 'Edit macro'}</h1>
        </div>

        {error && (
          <div className="me-error-bar">
            <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <div className="me-grid">
          <div className="me-field" style={{ marginBottom: 0 }}>
            <label className="me-label" htmlFor="macro-name">Macro name</label>
            <input
              id="macro-name"
              className={`me-input${nameError ? ' error' : ''}`}
              type="text"
              placeholder="e.g. Refund — order received"
              value={name}
              onChange={e => { setName(e.target.value); if (nameError) setNameError(null) }}
              maxLength={200}
              autoFocus={isNew}
            />
            {nameError
              ? <p className="me-fielderr">{nameError}</p>
              : <p className="me-hint">Name agents see when searching</p>
            }
          </div>

          <div className="me-field" style={{ marginBottom: 0 }}>
            <label className="me-label" htmlFor="macro-lang">Language</label>
            <select
              id="macro-lang"
              className="me-select"
              value={language}
              onChange={e => setLanguage(e.target.value)}
            >
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>

        <div className="me-field">
          <label className="me-label">Tags</label>
          <div className="me-tag-picker" ref={tagPickerRef}>
            <div
              className="me-tags-wrap"
              onClick={() => {
                document.getElementById('macro-tag-input')?.focus()
                setTagPickerOpen(true)
              }}
            >
              {selectedTags.map(t => {
                const p = TAG_PALETTE[t.color] || TAG_PALETTE.slate
                return (
                  <span
                    key={`${t.name}-${t.id ?? 'new'}`}
                    className="me-tag"
                    style={{ background: p.bg, color: p.text }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, marginRight: 2 }} />
                    {t.name}
                    <button
                      type="button"
                      className="me-tag-remove"
                      onClick={(e) => { e.stopPropagation(); removeTag(t.name) }}
                      aria-label={`Remove tag ${t.name}`}
                    >
                      <X size={10} strokeWidth={2} />
                    </button>
                  </span>
                )
              })}
              <input
                id="macro-tag-input"
                className="me-tag-input"
                type="text"
                placeholder={selectedTags.length === 0 ? 'Search or create a tag…' : ''}
                value={tagDraft}
                onChange={e => { setTagDraft(e.target.value); setTagPickerOpen(true) }}
                onFocus={() => setTagPickerOpen(true)}
                onKeyDown={onTagDraftKeyDown}
              />
            </div>

            {tagPickerOpen && (availableTags.length > 0 || showCreateOption) && (
              <div className="me-tag-dropdown" role="listbox">
                {availableTags.map(t => {
                  const p = TAG_PALETTE[t.color] || TAG_PALETTE.slate
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="me-tag-option"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addExistingTag(t)}
                      role="option"
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
                      <span className="me-tag-option-name">{t.name}</span>
                      {typeof t.macro_count === 'number' && (
                        <span className="me-tag-option-count">{t.macro_count}</span>
                      )}
                    </button>
                  )
                })}
                {showCreateOption && (
                  <button
                    type="button"
                    className="me-tag-option me-tag-option-create"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => createInlineTag(tagDraft)}
                  >
                    <Plus size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <span>Create new tag <strong>&ldquo;{tagDraft.trim()}&rdquo;</strong></span>
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="me-hint">Up to 25 tags. Pick from existing tags or type a new name and press Enter.</p>
        </div>

        <div className="me-field">
          <label className="me-label">Response</label>
          <div className="me-editor-wrap">
            <div className="me-toolbar" onMouseDown={(e) => { /* keep focus in editor */ if (!e.target.closest('input,select')) e.preventDefault() }}>
              <button type="button" className="me-tb-btn" onClick={() => exec('bold')}        title="Bold (Cmd/Ctrl+B)"      ><Bold size={14} strokeWidth={1.75} /></button>
              <button type="button" className="me-tb-btn" onClick={() => exec('italic')}      title="Italic (Cmd/Ctrl+I)"    ><Italic size={14} strokeWidth={1.75} /></button>
              <button type="button" className="me-tb-btn" onClick={() => exec('underline')}   title="Underline (Cmd/Ctrl+U)" ><Underline size={14} strokeWidth={1.75} /></button>
              <span className="me-tb-divider" />
              <button type="button" className="me-tb-btn" onClick={setHeading}                title="Heading"  ><Heading2 size={14} strokeWidth={1.75} /></button>
              <button type="button" className="me-tb-btn" onClick={insertLink}                title="Link"     ><Link2    size={14} strokeWidth={1.75} /></button>
              <button type="button" className="me-tb-btn" onClick={insertImage}               title="Image"    ><ImageIcon size={14} strokeWidth={1.75} /></button>
              <button type="button" className="me-tb-btn" onClick={insertCode}                title="Code"     ><Code     size={14} strokeWidth={1.75} /></button>
              <span className="me-tb-divider" />
              <button type="button" className="me-tb-btn" onClick={() => exec('insertUnorderedList')} title="Bullet list"   ><List        size={14} strokeWidth={1.75} /></button>
              <button type="button" className="me-tb-btn" onClick={() => exec('insertOrderedList')}   title="Numbered list" ><ListOrdered size={14} strokeWidth={1.75} /></button>

              <div className="me-tb-vars-wrap">
                <button
                  type="button"
                  className="me-tb-vars-btn"
                  // Save selection on mousedown — BEFORE focus could shift to the button.
                  // preventDefault stops the focus shift; sel.save captures the live cursor.
                  // sel.save itself only commits the range if focus was inside the editor.
                  onMouseDown={(e) => { e.preventDefault(); sel.save() }}
                  onClick={() => setVarsOpen(v => !v)}
                >
                  <Variable size={13} strokeWidth={1.75} />
                  Insert variable
                </button>
                {varsOpen && (
                  <div className="me-vars-panel">
                    {VARIABLES.map(v => (
                      <button
                        key={v.token}
                        type="button"
                        className="me-var-item"
                        // preventDefault on each button (not just the panel) keeps focus
                        // in the editor — bubble-phase preventDefault on the panel is too
                        // late once the button has already received focus.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertVariable(v.token)}
                      >
                        <div className="me-var-token">{v.token}</div>
                        <div className="me-var-label">{v.label}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div
              ref={editorRef}
              className="me-editor"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Hi {{ticket.customer.firstname}}, …"
              onInput={(e) => setBody(e.currentTarget.innerHTML)}
              onKeyUp={sel.save}
              onMouseUp={sel.save}
              onBlur={sel.save}
            />
          </div>
          <p className="me-hint">
            Variables are inserted as <code>{`{{...}}`}</code> placeholders. Phase 2 will replace them with real ticket values.
          </p>
        </div>

        <div className="me-actions">
          <button className="btn-secondary" onClick={() => router.push('/settings/workspace/macros')} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 size={14} strokeWidth={1.75} className="spin" /> Saving…</>
              : (isNew ? 'Create macro' : 'Save changes')
            }
          </button>
        </div>
      </div>

      {toast && (
        <div className={`me-toast me-toast-${toast.type}`} role="status" aria-live="polite">
          {toast.type === 'err'
            ? <AlertCircle size={16} strokeWidth={1.75} />
            : <Check size={16} strokeWidth={2} />
          }
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
