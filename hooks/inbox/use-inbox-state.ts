'use client'

import { useState, useRef } from 'react'

export function useInboxState() {
  // Selected thread
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)

  // Composer state
  const [reply, setReply] = useState('')
  const [composerTab, setComposerTab] = useState<'reply' | 'note'>('reply')
  const [showEmoji, setShowEmoji] = useState(false)
  const [attachments, setAttachments] = useState<{ name: string; size: number }[]>([])
  const composerRef = useRef<HTMLDivElement>(null)

  // UI toggles
  const [showMacros, setShowMacros] = useState(false)
  const [showMacroManager, setShowMacroManager] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  const [noteInput, setNoteInput] = useState('')

  // Right panel
  const [rightTab, setRightTab] = useState('shopify')
  const [custSearch, setCustSearch] = useState('')
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({})
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({})
  const [custFieldsOpen, setCustFieldsOpen] = useState(true)
  const [custShowMore, setCustShowMore] = useState(false)

  // Thread selection
  const [checkedThreads, setCheckedThreads] = useState<Record<string, boolean>>({})

  // Modal
  const [modal, setModal] = useState<{ type: string; order: any } | null>(null)

  // Folder + search
  const [activeFolder, setActiveFolder] = useState('open')
  const [search, setSearch] = useState('')

  // Sending state
  const [sending, setSending] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Refs
  const msgEndRef = useRef<HTMLDivElement>(null)
  const imgUploadRef = useRef<HTMLInputElement>(null)
  const fileUploadRef = useRef<HTMLInputElement>(null)

  // Reset state when selecting a new thread
  function resetForNewThread() {
    setReply('')
    setShowMacros(false)
    setShowEmoji(false)
    setAttachments([])
    setNoteInput('')
    setShowNotes(true)
  }

  return {
    // Selected thread
    selectedThreadId,
    setSelectedThreadId,

    // Composer state
    reply,
    setReply,
    composerTab,
    setComposerTab,
    showEmoji,
    setShowEmoji,
    attachments,
    setAttachments,
    composerRef,

    // UI toggles
    showMacros,
    setShowMacros,
    showMacroManager,
    setShowMacroManager,
    showNotes,
    setShowNotes,
    noteInput,
    setNoteInput,

    // Right panel
    rightTab,
    setRightTab,
    custSearch,
    setCustSearch,
    expandedOrders,
    setExpandedOrders,
    expandedSubs,
    setExpandedSubs,
    custFieldsOpen,
    setCustFieldsOpen,
    custShowMore,
    setCustShowMore,

    // Thread selection
    checkedThreads,
    setCheckedThreads,

    // Modal
    modal,
    setModal,

    // Folder + search
    activeFolder,
    setActiveFolder,
    search,
    setSearch,

    // Sending state
    sending,
    setSending,
    addingNote,
    setAddingNote,
    syncing,
    setSyncing,

    // Refs
    msgEndRef,
    imgUploadRef,
    fileUploadRef,

    // Actions
    resetForNewThread,
  }
}
