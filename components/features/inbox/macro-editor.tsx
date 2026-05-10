'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface MacroData {
  id?: string
  name?: string
  body?: string
  tags?: string[]
  language?: string
  usageCount?: number
  updatedAt?: string
  archived?: boolean
  [key: string]: unknown
}

export function MacroEditor({ macro, onSave, onDuplicate, onDelete, onBack }: {
  macro: MacroData | null;
  onSave: (m: MacroData) => void;
  onDuplicate: (m: MacroData) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  const isNew = !macro?.id;
  const [name, setName] = useState(macro?.name || "");
  const [body, setBody] = useState(macro?.body || "");
  const [tags, setTags] = useState((macro?.tags || []).join(", "));
  const [language, setLang] = useState(macro?.language || "English");
  const [tagInput, setTagInput] = useState((macro?.tags || []).join(", "));
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.value = macro?.body || "";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function insertVar(v: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const s = ta.selectionStart,
      e = ta.selectionEnd;
    const newVal = ta.value.slice(0, s) + v + ta.value.slice(e);
    ta.value = newVal;
    setBody(newVal);
    ta.focus();
    ta.setSelectionRange(s + v.length, s + v.length);
  }

  function handleSave() {
    if (!name.trim()) return;
    const t = tagInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onSave({
      id: macro?.id || `m_${Date.now()}`,
      name: name.trim(),
      body: bodyRef.current?.value || body,
      tags: t,
      language,
      usageCount: macro?.usageCount || 0,
      updatedAt: new Date().toISOString(),
      archived: macro?.archived || false,
    });
  }

  const VARS = [
    { label: "Customer first name", value: "{{name}}" },
    { label: "Order number", value: "{{order_number}}" },
    { label: "Tracking link", value: "{{tracking_link}}" },
    { label: "Agent name", value: "{{agent_name}}" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-(--bg-page)">
      {/* Top bar */}
      <div className="flex items-center gap-2.5 py-3.5 px-6 border-b border-(--border) bg-(--bg-surface) shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-[5px] text-(--text-2) text-[13px] py-1 px-0 font-[inherit]">
          <ChevronLeft size={16} />
          Back
        </Button>
        <span className="text-(--border) text-[16px]">|</span>
        <span className="text-sm font-semibold text-(--text-1)">{isNew ? "Create macro" : `Edit: ${macro.name}`}</span>
      </div>

      {/* Form */}
      <div className="max-w-[860px] w-full mx-auto py-8 px-6 flex gap-8">
        {/* Left col — main */}
        <div className="flex-1 flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-(--text-2) mb-1.5">
              Macro name <span className="text-(--danger)">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Delivery - Delay"
              className="w-full py-[9px] px-3 border border-(--border) rounded-lg text-[13px] text-(--text-1) bg-(--bg-surface) font-[inherit]"
            />
            <div className="text-[11px] text-(--text-3) mt-[5px]">Name that all agents will see while searching for it</div>
          </div>

          {/* Response text */}
          <div>
            <label className="block text-xs font-semibold text-(--text-2) mb-1.5">Response text</label>
            {/* Recipient row */}
            <div className="flex items-center gap-2 py-[7px] px-3 rounded-t-lg border border-(--border) border-b-0 bg-(--bg-surface-2) text-xs text-(--text-2)">
              <span className="font-semibold">To:</span>
              <span className="py-0.5 px-2 rounded-[5px] bg-(--bg-surface-2) text-(--text-2) font-semibold text-[11px] border border-(--border)">
                Current client
              </span>
            </div>
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 py-[5px] px-2.5 border border-(--border) border-b-0 bg-(--bg-surface) flex-wrap">
              {["B", "I", "U"].map((f) => (
                <button
                  key={f}
                  style={{
                    fontWeight: f === "B" ? 700 : 400,
                    fontStyle: f === "I" ? "italic" : "normal",
                    textDecoration: f === "U" ? "underline" : "none",
                  }}
                  className="py-[3px] px-[7px] rounded-[5px] border border-transparent bg-none text-(--text-2) text-[13px] font-[inherit]"
                >
                  {f}
                </button>
              ))}
              <span className="w-px h-4 bg-(--border) mx-1" />
              {VARS.map((v) => (
                <button
                  key={v.value}
                  onClick={() => insertVar(v.value)}
                  className="py-0.5 px-2 rounded-[5px] border border-(--border) bg-(--bg-surface-2) text-(--text-2) text-[11px] font-medium font-[inherit] whitespace-nowrap"
                >
                  {v.label}
                </button>
              ))}
            </div>
            {/* Body */}
            <textarea
              ref={bodyRef}
              defaultValue={macro?.body || ""}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your macro response here. Use the variable buttons above to insert dynamic values."
              className="w-full min-h-[200px] py-3 px-3.5 border border-(--border) rounded-b-lg resize-y text-[13px] leading-[1.75] text-(--text-1) bg-(--bg-surface) font-[inherit] outline-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-(--text-2) mb-1.5">
              Tags <span className="text-[11px] font-normal text-(--text-3)">(comma separated)</span>
            </label>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="e.g. shipping, support"
              className="w-full py-[9px] px-3 border border-(--border) rounded-lg text-[13px] text-(--text-1) bg-(--bg-surface) font-[inherit]"
            />
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between pt-2 border-t border-(--border)">
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                className="py-[9px] px-[18px] rounded-lg border-none bg-(--text-1) text-(--bg-surface) font-semibold text-[13px] font-[inherit]"
              >
                {isNew ? "Create macro" : "Update macro"}
              </Button>
              {!isNew && (
                <Button
                  variant="outline"
                  onClick={() => onDuplicate(macro)}
                  className="py-[9px] px-4 rounded-lg border border-(--border) bg-(--bg-surface) text-(--text-1) font-medium text-[13px] font-[inherit]"
                >
                  Duplicate macro
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {!isNew && (
                <Button
                  variant="destructive"
                  onClick={() => onDelete(macro!.id!)}
                  className="py-[9px] px-4 rounded-lg border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.06)] text-(--danger) font-medium text-[13px] font-[inherit]"
                >
                  Delete macro
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right col — language */}
        <div className="w-[220px] shrink-0 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-(--text-2) mb-1.5">Language</label>
            <select
              value={language}
              onChange={(e) => setLang(e.target.value)}
              className="w-full py-[9px] px-3 border border-(--border) rounded-lg text-[13px] text-(--text-1) bg-(--bg-surface) font-[inherit] outline-none cursor-pointer"
            >
              {["English", "Dutch", "German", "French", "Spanish", "Italian", "Portuguese"].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-(--text-3) mt-[5px]">Language in which this macro is written</div>
          </div>
        </div>
      </div>
    </div>
  );
}
