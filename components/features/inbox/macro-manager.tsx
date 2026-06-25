'use client'

import { useState } from 'react'
import {
  Archive,
  ChevronLeft,
  Search,
  SquarePen,
  Star,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MacroEditor } from './macro-editor'
import {
  useMacros,
  useCreateMacro,
  useUpdateMacro,
  useDuplicateMacro,
  useArchiveMacro,
  useRestoreMacro,
  useDeleteMacro,
} from '@/hooks/macros'
import { MACRO_LANG_LABEL } from '@/lib/settings-constants'
import type { Macro } from '@/types/inbox'

export function MacroManager({ favs, onClose, onToggleFav }: {
  favs: string[];
  onClose: () => void;
  onToggleFav: (id: string) => void;
}) {
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [search, setSearch] = useState("");
  const [langFilter, setLangF] = useState("all");
  const [tagFilter, setTagF] = useState("all");
  const [editing, setEditing] = useState<Macro | "new" | null>(null);

  const { data: macros = [] } = useMacros({
    search: '',
    language: '',
    tags: [],
    archived: tab === 'archived',
  });

  const createMacro = useCreateMacro();
  const updateMacro = useUpdateMacro();
  const duplicateMacro = useDuplicateMacro();
  const archiveMacro = useArchiveMacro();
  const restoreMacro = useRestoreMacro();
  const deleteMacro = useDeleteMacro();

  const allTags = [...new Set(macros.flatMap((m) => m.tags || []))].sort();
  const allLangs = [...new Set(macros.map((m) => m.language || "en"))].sort();

  const visible = macros.filter((m) => {
    if (search && !(m.name + (m.body ?? "") + (m.tags || []).join("")).toLowerCase().includes(search.toLowerCase())) return false;
    if (langFilter !== "all" && m.language !== langFilter) return false;
    if (tagFilter !== "all" && !(m.tags || []).includes(tagFilter)) return false;
    return true;
  });

  function handleSave(m: { id?: string; name?: string; body?: string; language?: string; tags?: string[] }) {
    const payload = {
      name: m.name ?? '',
      body: m.body ?? '',
      language: m.language ?? 'en',
      tags: m.tags ?? [],
    };
    if (editing === "new") {
      createMacro.mutate(payload, { onSuccess: () => setEditing(null) });
    } else if (m.id) {
      updateMacro.mutate({ id: m.id, ...payload }, { onSuccess: () => setEditing(null) });
    }
  }
  function handleDuplicate(m: { id?: string }) {
    if (m.id) duplicateMacro.mutate(m.id);
    setEditing(null);
  }
  function handleDelete(id: string) {
    if (!confirm("Delete this macro? This cannot be undone.")) return;
    deleteMacro.mutate(id, { onSuccess: () => setEditing(null) });
  }
  function handleArchive(m: Macro) {
    if (m.archived_at) restoreMacro.mutate(m.id);
    else archiveMacro.mutate(m.id);
  }

  function fmtDate(iso: string | undefined) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  }

  if (editing) {
    return (
      <div className="fixed inset-0 bg-background z-[200] flex flex-col">
        <MacroEditor
          macro={editing === "new" ? null : editing}
          onSave={handleSave}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onBack={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-[200] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 py-3.5 px-7 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="sm" onClick={onClose} className="flex items-center gap-[5px] text-foreground-2 text-[13px] py-1 px-0 font-[inherit]">
          <ChevronLeft size={16} />
          Back to inbox
        </Button>
        <span className="flex-1 text-[16px] font-bold text-foreground">Macros</span>
        {/* Filters */}
        <div className="relative flex items-center">
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 9,
              color: "var(--foreground-3)",
              pointerEvents: "none",
            }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search macros..."
            className="pl-[30px] pr-3 py-[7px] border border-border rounded-lg text-[12.5px] text-foreground bg-secondary w-[200px] font-[inherit]"
          />
        </div>
        <select
          value={langFilter}
          onChange={(e) => setLangF(e.target.value)}
          className="py-[7px] px-2.5 border border-border rounded-lg text-[12.5px] text-foreground-2 bg-secondary cursor-pointer font-[inherit] outline-none"
        >
          <option value="all">Language</option>
          {allLangs.map((l) => (
            <option key={l} value={l}>
              {MACRO_LANG_LABEL[l] ?? l}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagF(e.target.value)}
          className="py-[7px] px-2.5 border border-border rounded-lg text-[12.5px] text-foreground-2 bg-secondary cursor-pointer font-[inherit] outline-none"
        >
          <option value="all">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Button
          onClick={() => setEditing("new")}
          className="py-2 px-4 rounded-lg border-none bg-foreground text-white font-semibold text-[13px] font-[inherit] whitespace-nowrap"
        >
          Create macro
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-7 border-b border-border bg-card shrink-0">
        {(["active", "archived"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              borderBottom: `2px solid ${tab === t ? "#111111" : "transparent"}`,
              color: tab === t ? "var(--foreground)" : "var(--foreground-2)",
              fontWeight: tab === t ? 600 : 500,
            }}
            className="py-2.5 px-4 bg-none border-none text-[13px] font-[inherit] capitalize transition-all duration-150"
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-7">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              {[
                ["MACRO", ""],
                ["TAGS", "160px"],
                ["LANGUAGE", "110px"],
                ["USAGE", "90px"],
                ["LAST UPDATED", "140px"],
                ["", "56px"],
              ].map(([h, w]) => (
                <th
                  key={h}
                  style={{ width: w || "auto" }}
                  className="py-2.5 pr-3 pl-0 text-[10.5px] font-bold text-muted-foreground tracking-[.05em] text-left whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground text-[13px]">
                  No macros found
                </td>
              </tr>
            )}
            {visible.map((m) => (
              <tr
                key={m.id}
                className="border-b border-border"
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--secondary)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Name */}
                <td className="py-3 pr-3 pl-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFav(m.id);
                      }}
                      style={{
                        color: favs.includes(m.id) ? "#f59e0b" : "var(--foreground-3)",
                        opacity: favs.includes(m.id) ? 1 : 0.4,
                      }}
                      className="bg-none border-none flex p-0.5 shrink-0 transition-opacity duration-150"
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = favs.includes(m.id) ? "1" : "0.4")}
                    >
                      <Star size={13} fill={favs.includes(m.id) ? "#f59e0b" : "none"} stroke={favs.includes(m.id) ? "#f59e0b" : "currentColor"} />
                    </button>
                    <button onClick={() => setEditing(m)} className="bg-none border-none font-[inherit] text-left p-0 text-foreground text-[13px] font-medium">
                      {m.name}
                    </button>
                  </div>
                </td>
                {/* Tags */}
                <td className="py-3 pr-3 pl-0">
                  <div className="flex gap-1 flex-wrap">
                    {(m.tags || []).map((t) => (
                      <span key={t} className="text-[10px] font-semibold py-0.5 px-[7px] rounded bg-secondary text-foreground-2 border border-border">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                {/* Language */}
                <td className="py-3 pr-3 pl-0 text-[12.5px] text-foreground-2">{MACRO_LANG_LABEL[m.language] ?? m.language}</td>
                {/* Usage */}
                <td className="py-3 pr-3 pl-0 text-[12.5px] text-foreground-2">{m.usage_count ?? 0}</td>
                {/* Updated */}
                <td className="py-3 pr-3 pl-0 text-xs text-muted-foreground">{fmtDate(m.updated_at)}</td>
                {/* Actions */}
                <td className="py-3 pl-0 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setEditing(m)}
                      title="Edit"
                      className="bg-none border-none text-muted-foreground flex p-1 rounded-[5px] transition-colors duration-150 hover:text-foreground"
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-3)")}
                    >
                      <SquarePen size={14} />
                    </button>
                    <button
                      onClick={() => handleArchive(m)}
                      title={m.archived_at ? "Unarchive" : "Archive"}
                      className="bg-none border-none text-muted-foreground flex p-1 rounded-[5px] transition-colors duration-150 hover:text-foreground"
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-3)")}
                    >
                      <Archive size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      title="Delete"
                      className="bg-none border-none text-muted-foreground flex p-1 rounded-[5px] transition-colors duration-150 hover:text-destructive"
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--destructive)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-3)")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
