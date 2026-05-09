// @ts-nocheck
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

export function MacroManager({ macros, favs, onClose, onSaveMacro, onDeleteMacro, onToggleFav }: {
  macros: any[];
  favs: string[];
  onClose: () => void;
  onSaveMacro: (m: any) => void;
  onDeleteMacro: (id: string) => void;
  onToggleFav: (id: string) => void;
}) {
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");
  const [langFilter, setLangF] = useState("all");
  const [tagFilter, setTagF] = useState("all");
  const [editing, setEditing] = useState(null); // null=list, 'new'=create, macro=edit

  const allTags = [...new Set(macros.flatMap((m) => m.tags || []))].sort();
  const allLangs = [...new Set(macros.map((m) => m.language || "English"))].sort();

  const visible = macros.filter((m) => {
    if (tab === "active" && m.archived) return false;
    if (tab === "archived" && !m.archived) return false;
    if (search && !(m.name + m.body + (m.tags || []).join("")).toLowerCase().includes(search.toLowerCase())) return false;
    if (langFilter !== "all" && m.language !== langFilter) return false;
    if (tagFilter !== "all" && !(m.tags || []).includes(tagFilter)) return false;
    return true;
  });

  function handleSave(m) {
    onSaveMacro(m);
    setEditing(null);
  }
  function handleDuplicate(m) {
    onSaveMacro({
      ...m,
      id: `m_${Date.now()}`,
      name: `${m.name} (copy)`,
      usageCount: 0,
      updatedAt: new Date().toISOString(),
    });
    setEditing(null);
  }
  function handleDelete(id) {
    if (!confirm("Delete this macro? This cannot be undone.")) return;
    onDeleteMacro(id);
    setEditing(null);
  }
  function handleArchive(m) {
    onSaveMacro({
      ...m,
      archived: !m.archived,
      updatedAt: new Date().toISOString(),
    });
  }

  function fmtDate(iso) {
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
      <div className="fixed inset-0 bg-(--bg-page) z-[200] flex flex-col">
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
    <div className="fixed inset-0 bg-(--bg-page) z-[200] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 py-3.5 px-7 border-b border-(--border) bg-(--bg-surface) shrink-0">
        <Button variant="ghost" size="sm" onClick={onClose} className="flex items-center gap-[5px] text-(--text-2) text-[13px] py-1 px-0 font-[inherit]">
          <ChevronLeft size={16} />
          Back to inbox
        </Button>
        <span className="flex-1 text-[16px] font-bold text-(--text-1)">Macros</span>
        {/* Filters */}
        <div className="relative flex items-center">
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 9,
              color: "var(--text-3)",
              pointerEvents: "none",
            }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search macros..."
            className="pl-[30px] pr-3 py-[7px] border border-(--border) rounded-lg text-[12.5px] text-(--text-1) bg-(--bg-surface-2) w-[200px] font-[inherit]"
          />
        </div>
        <select
          value={langFilter}
          onChange={(e) => setLangF(e.target.value)}
          className="py-[7px] px-2.5 border border-(--border) rounded-lg text-[12.5px] text-(--text-2) bg-(--bg-surface-2) cursor-pointer font-[inherit] outline-none"
        >
          <option value="all">Language</option>
          {allLangs.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagF(e.target.value)}
          className="py-[7px] px-2.5 border border-(--border) rounded-lg text-[12.5px] text-(--text-2) bg-(--bg-surface-2) cursor-pointer font-[inherit] outline-none"
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
          className="py-2 px-4 rounded-lg border-none bg-(--text-1) text-white font-semibold text-[13px] font-[inherit] whitespace-nowrap"
        >
          Create macro
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-7 border-b border-(--border) bg-(--bg-surface) shrink-0">
        {["active", "archived"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              borderBottom: `2px solid ${tab === t ? "#111111" : "transparent"}`,
              color: tab === t ? "var(--text-1)" : "var(--text-2)",
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
            <tr className="border-b border-(--border)">
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
                  className="py-2.5 pr-3 pl-0 text-[10.5px] font-bold text-(--text-3) tracking-[.05em] text-left whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-(--text-3) text-[13px]">
                  No macros found
                </td>
              </tr>
            )}
            {visible.map((m) => (
              <tr
                key={m.id}
                className="border-b border-(--border)"
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-2)")}
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
                        color: favs.includes(m.id) ? "#f59e0b" : "var(--text-3)",
                        opacity: favs.includes(m.id) ? 1 : 0.4,
                      }}
                      className="bg-none border-none flex p-0.5 shrink-0 transition-opacity duration-150"
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = favs.includes(m.id) ? 1 : 0.4)}
                    >
                      <Star size={13} fill={favs.includes(m.id) ? "#f59e0b" : "none"} stroke={favs.includes(m.id) ? "#f59e0b" : "currentColor"} />
                    </button>
                    <button onClick={() => setEditing(m)} className="bg-none border-none font-[inherit] text-left p-0 text-(--text-1) text-[13px] font-medium">
                      {m.name}
                    </button>
                  </div>
                </td>
                {/* Tags */}
                <td className="py-3 pr-3 pl-0">
                  <div className="flex gap-1 flex-wrap">
                    {(m.tags || []).map((t) => (
                      <span key={t} className="text-[10px] font-semibold py-0.5 px-[7px] rounded bg-(--bg-surface-2) text-(--text-2) border border-(--border)">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                {/* Language */}
                <td className="py-3 pr-3 pl-0 text-[12.5px] text-(--text-2)">{m.language || "English"}</td>
                {/* Usage */}
                <td className="py-3 pr-3 pl-0 text-[12.5px] text-(--text-2)">{m.usageCount || 0}</td>
                {/* Updated */}
                <td className="py-3 pr-3 pl-0 text-xs text-(--text-3)">{fmtDate(m.updatedAt)}</td>
                {/* Actions */}
                <td className="py-3 pl-0 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setEditing(m)}
                      title="Edit"
                      className="bg-none border-none text-(--text-3) flex p-1 rounded-[5px] transition-colors duration-150 hover:text-(--text-1)"
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                    >
                      <SquarePen size={14} />
                    </button>
                    <button
                      onClick={() => handleArchive(m)}
                      title={m.archived ? "Unarchive" : "Archive"}
                      className="bg-none border-none text-(--text-3) flex p-1 rounded-[5px] transition-colors duration-150 hover:text-(--text-1)"
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                    >
                      <Archive size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      title="Delete"
                      className="bg-none border-none text-(--text-3) flex p-1 rounded-[5px] transition-colors duration-150 hover:text-(--danger)"
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
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
