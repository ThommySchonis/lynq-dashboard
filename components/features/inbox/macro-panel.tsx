'use client'

import { useEffect, useRef, useState } from 'react'
import {
  FileText,
  Plus,
  Settings,
  SquarePen,
  Star,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MacroPanelItem {
  id: string
  name: string
  body?: string
  tags?: string[]
  [key: string]: unknown
}

export function MacroPanel({ macros = [], aiMacros = [], onInsert, onClose, customerName = "", onManage, onCreateNew = () => {}, favs = [], onToggleFav = () => {}, onDeleteMacro }: {
  macros?: MacroPanelItem[];
  aiMacros?: MacroPanelItem[];
  onInsert: (content: string) => void;
  onClose: () => void;
  customerName?: string;
  onManage: (macro?: MacroPanelItem) => void;
  onCreateNew?: () => void;
  favs?: string[];
  onToggleFav?: (id: string) => void;
  onDeleteMacro?: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MacroPanelItem | null>(null);
  const [gearOpen, setGearOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const gearRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);
  useEffect(() => {
    function h(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (gearOpen) setGearOpen(false);
        else onClose();
      }
    }
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, gearOpen]);
  useEffect(() => {
    if (!gearOpen) return;
    function h(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setGearOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [gearOpen]);

  function toggleFav(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    onToggleFav(id);
  }

  const filtered = macros.filter((m) => !search || (m.name + m.body + (m.tags || []).join("")).toLowerCase().includes(search.toLowerCase()));
  const favMacros = filtered.filter((m) => favs.includes(m.id));
  const nonFavMacros = filtered.filter((m) => !favs.includes(m.id));
  const active = selected || filtered[0] || null;

  const StarIcon = ({ filled }: { filled: boolean }) => <Star size={13} fill={filled ? "#f59e0b" : "none"} stroke={filled ? "#f59e0b" : "currentColor"} />;

  function applyMacro(m: MacroPanelItem) {
    const firstName = (customerName || "").split(" ")[0] || "there";
    const body = (m.body ?? "").replace(/{{name}}/gi, firstName).replace(/{{firstname}}/gi, firstName);
    onInsert(body);
  }

  function renderPreview(body: string) {
    return body.split(/({{[^}]+}})/).map((part, i) =>
      part.match(/{{[^}]+}}/) ? (
        <span key={i} className="text-foreground-2 bg-secondary py-px px-[5px] rounded border border-border font-semibold text-[11px]">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  }

  return (
    <div className="border-t border-border animate-[fadeUp_.18s_ease_both] flex flex-col h-[min(360px,46vh)] min-h-[220px] bg-card">
      {/* Search + gear row */}
      <div className="flex items-center gap-2 py-2 px-3 border-b border-border bg-secondary shrink-0">
        <span className="text-muted-foreground flex shrink-0">
          <Zap size={13} />
        </span>
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search macros by name, tag or content…"
          className="flex-1 bg-transparent border-none outline-none text-[12.5px] text-foreground font-[inherit]"
        />
        {aiMacros?.length > 0 && (
          <span className="text-[10px] font-bold py-0.5 px-[7px] rounded-[5px] bg-secondary text-foreground-2 tracking-[.04em] shrink-0">AI ✦</span>
        )}
        {/* Gear settings */}
        <div ref={gearRef} className="relative shrink-0">
          <button
            onClick={() => setGearOpen((p) => !p)}
            style={{
              color: gearOpen ? "var(--foreground)" : "var(--foreground-2)",
              display: "flex",
              padding: "5px 6px",
              borderRadius: 6,
              background: gearOpen ? "var(--secondary)" : "transparent",
              border: gearOpen ? "1px solid var(--border)" : "1px solid transparent",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => {
              if (!gearOpen) {
                e.currentTarget.style.background = "var(--card)";
                e.currentTarget.style.border = "1px solid var(--border)";
              }
            }}
            onMouseLeave={(e) => {
              if (!gearOpen) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.border = "1px solid transparent";
              }
            }}
            title="Macro settings"
          >
            <Settings size={15} />
          </button>
          {gearOpen && (
            <div className="absolute top-[calc(100%+4px)] right-0 min-w-[192px] bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.06)] z-40 p-1 animate-[fadeUp_.14s_ease_both]">
              <button
                className="flex items-center gap-[9px] w-full py-2 px-[11px] rounded-[7px] bg-none border-none font-inherit text-[12.5px] text-foreground cursor-pointer text-left transition-[background] duration-120 hover:bg-secondary"
                onClick={() => {
                  setGearOpen(false);
                  onManage();
                }}
              >
                <FileText size={13} />
                Manage macros
              </button>
              <button
                className="flex items-center gap-[9px] w-full py-2 px-[11px] rounded-[7px] bg-none border-none font-inherit text-[12.5px] text-foreground cursor-pointer text-left transition-[background] duration-120 hover:bg-secondary"
                onClick={() => {
                  setGearOpen(false);
                  active && onManage(active);
                }}
              >
                <SquarePen size={13} />
                Edit macro
              </button>
              <button
                className="flex items-center gap-[9px] w-full py-2 px-[11px] rounded-[7px] bg-none border-none font-inherit text-[12.5px] text-foreground cursor-pointer text-left transition-[background] duration-120 hover:bg-secondary"
                onClick={() => {
                  setGearOpen(false);
                  onCreateNew();
                }}
              >
                <Plus size={13} />
                Create new macro
              </button>
              <div className="h-px bg-border my-[3px]" />
              <button
                className="flex items-center gap-[9px] w-full py-2 px-[11px] rounded-[7px] bg-none border-none font-inherit text-[12.5px] text-destructive cursor-pointer text-left transition-[background] duration-120 hover:bg-secondary"
                onClick={() => {
                  setGearOpen(false);
                  active && confirm("Delete this macro?") && onDeleteMacro && onDeleteMacro(active.id);
                }}
              >
                <Trash2 size={13} />
                Delete macro
              </button>
              <div className="h-px bg-border my-[3px]" />
              <button
                className="flex items-center gap-[9px] w-full py-2 px-[11px] rounded-[7px] bg-none border-none font-inherit text-[12.5px] text-foreground cursor-pointer text-left transition-[background] duration-120 hover:bg-secondary"
                onClick={() => {
                  setGearOpen(false);
                  onManage();
                }}
              >
                <User size={13} />
                My macro preferences
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex py-[5px] px-1.5 rounded-md border border-transparent transition-all duration-150"
          style={{ color: "var(--foreground-2)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--foreground)";
            e.currentTarget.style.background = "var(--card)";
            e.currentTarget.style.border = "1px solid var(--border)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--foreground-2)";
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.border = "1px solid transparent";
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Two-panel — fills remaining height */}
      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className="w-[230px] border-r border-border overflow-y-auto shrink-0 thin-scrollbar">
          {aiMacros?.length > 0 && (
            <>
              <div className="py-1 px-[14px] pb-1.5 text-[9.5px] font-bold tracking-[.08em] uppercase text-foreground-3">AI suggestions ✦</div>
              {aiMacros.map((m) => (
                <div
                  key={m.id}
                  className={`group py-[10px] px-[14px] cursor-pointer transition-[background] duration-120 border-l-2 ${active?.id === m.id ? 'bg-secondary border-l-foreground-2' : 'border-l-transparent hover:bg-secondary'}`}
                  onClick={() => setSelected(m)}
                  onDoubleClick={() => applyMacro(m)}
                >
                  <div className="flex items-start gap-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold text-foreground mb-[3px]">{m.name}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="h-px bg-(--border) my-1" />
            </>
          )}
          {filtered.length === 0 && <div className="py-5 px-3.5 text-xs text-muted-foreground text-center">No macros found</div>}
          {/* Favorites section */}
          {favMacros.length > 0 && (
            <>
              <div className="py-1 px-[14px] pb-1.5 text-[9.5px] font-bold tracking-[.08em] uppercase text-foreground-3 flex items-center gap-1">
                <Star size={9} fill="#f59e0b" stroke="#f59e0b" />
                Favorites
              </div>
              {favMacros.map((m) => (
                <div
                  key={m.id}
                  className={`group py-[10px] px-[14px] cursor-pointer transition-[background] duration-120 border-l-2 ${active?.id === m.id ? 'bg-secondary border-l-foreground-2' : 'border-l-transparent hover:bg-secondary'}`}
                  onClick={() => setSelected(m)}
                  onDoubleClick={() => applyMacro(m)}
                >
                  <div className="flex items-start gap-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold text-foreground mb-[3px]">{m.name}</div>
                      <div className="flex gap-1 flex-wrap">
                        {(m.tags || []).map((t) => (
                          <span key={t} className="text-[10px] font-semibold px-1.5 py-[1px] rounded bg-secondary text-muted-foreground">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="bg-transparent border-none cursor-pointer flex items-center py-0.5 px-[3px] rounded shrink-0 opacity-100 hover:opacity-100! mt-px" onClick={(e) => toggleFav(m.id, e)} title="Remove from favorites">
                      <StarIcon filled />
                    </button>
                  </div>
                </div>
              ))}
              {nonFavMacros.length > 0 && <div className="h-px bg-(--border) my-1" />}
            </>
          )}
          {/* All / remaining macros */}
          {nonFavMacros.length > 0 && (
            <>
              {favMacros.length > 0 && <div className="py-1 px-[14px] pb-1.5 text-[9.5px] font-bold tracking-[.08em] uppercase text-foreground-3">All macros</div>}
              {nonFavMacros.map((m) => (
                <div
                  key={m.id}
                  className={`group py-[10px] px-[14px] cursor-pointer transition-[background] duration-120 border-l-2 ${active?.id === m.id ? 'bg-secondary border-l-foreground-2' : 'border-l-transparent hover:bg-secondary'}`}
                  onClick={() => setSelected(m)}
                  onDoubleClick={() => applyMacro(m)}
                >
                  <div className="flex items-start gap-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold text-foreground mb-[3px]">{m.name}</div>
                      <div className="flex gap-1 flex-wrap">
                        {(m.tags || []).map((t) => (
                          <span key={t} className="text-[10px] font-semibold px-1.5 py-[1px] rounded bg-secondary text-muted-foreground">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="bg-transparent border-none cursor-pointer flex items-center py-0.5 px-[3px] rounded shrink-0 opacity-0 group-hover:opacity-45 hover:opacity-100! transition-opacity duration-150 mt-px" onClick={(e) => toggleFav(m.id, e)} title="Add to favorites">
                      <StarIcon filled={false} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Preview — no buttons here */}
        {active ? (
          <div className="flex-1 px-4 py-3.5 overflow-y-auto text-[13px] leading-[1.75] text-foreground-2 whitespace-pre-wrap thin-scrollbar">{renderPreview(active.body ?? "")}</div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-[12.5px]">Select a macro to preview</div>
        )}
      </div>

      {/* Full-width footer — always visible, connected to bottom of panel */}
      <div className="border-t border-border py-2 px-3.5 flex items-center justify-end gap-2 shrink-0 bg-card">
        <Button variant="outline" className="text-[11.5px] py-1.5 px-3.5" onClick={onClose}>
          Close
        </Button>
        <button
          className="btn-send text-[11.5px] py-1.5 px-4"
          style={{
            opacity: active ? 1 : 0.45,
            cursor: active ? "pointer" : "default",
          }}
          onClick={() => active && applyMacro(active)}
        >
          Insert
        </button>
      </div>
    </div>
  );
}
