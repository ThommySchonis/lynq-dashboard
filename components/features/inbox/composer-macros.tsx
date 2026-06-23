"use client";

import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, Sparkles } from "lucide-react";

const ALL = "all";

/** Minimal macro shape this panel needs — structurally satisfied by both the
 *  macros store and types/inbox Macro (see MacroPanel's local-item pattern). */
interface ComposerMacroItem {
  id: string;
  name: string;
  body?: string;
  language?: string;
  tags?: string[];
}

/**
 * Macro row + suggested-macro pills under the composer (Figma 1283-52943):
 * "Macros" label with language/tag filter dropdowns, then suggested macro name
 * pills. Clicking a pill inserts its body with {{name}} resolved to the
 * customer's first name.
 */
export function ComposerMacros({
  macros,
  aiMacros,
  customerName,
  onInsert,
}: {
  macros: ComposerMacroItem[];
  aiMacros: ComposerMacroItem[];
  customerName: string;
  onInsert: (body: string) => void;
}) {
  const pool = aiMacros.length > 0 ? aiMacros : macros;
  const [lang, setLang] = useState<string>(ALL);
  const [tag, setTag] = useState<string>(ALL);

  const languages = Array.from(new Set(macros.map((m) => m.language).filter((l): l is string => Boolean(l))));
  const tags = Array.from(new Set(macros.flatMap((m) => m.tags ?? [])));

  const suggested = pool
    .filter((m) => (lang === ALL || m.language === lang) && (tag === ALL || (m.tags ?? []).includes(tag)))
    .slice(0, 5);

  if (pool.length === 0) return null;

  const firstName = customerName.split(" ")[0] || "there";
  const insert = (m: ComposerMacroItem) => onInsert((m.body || "").replace(/{{name}}/gi, firstName).replace(/{{firstname}}/gi, firstName));

  return (
    <div className="flex flex-col gap-2 px-3.5 py-2 border-t border-border">
      {/* Macros + filters */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">Macros</span>
        <div className="flex items-center gap-1.5">
          <FilterDropdown label="All languages" value={lang} options={languages} onChange={setLang} />
          <FilterDropdown label="All tags" value={tag} options={tags} onChange={setTag} />
        </div>
      </div>

      {/* Suggested macro pills */}
      {suggested.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
            <Sparkles size={13} /> Suggested macros
          </span>
          {suggested.map((m) => (
            <button
              key={m.id}
              onClick={() => insert(m)}
              className="inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1 text-[12px] font-semibold text-foreground-3 transition-colors hover:border-border-hover hover:text-foreground"
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterDropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-foreground-4 transition-colors hover:text-foreground-2" />
        }
      >
        {value === ALL ? label : value}
        <ChevronDown size={11} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onChange(ALL)}>{label}</DropdownMenuItem>
        {options.map((o) => (
          <DropdownMenuItem key={o} onClick={() => onChange(o)}>
            {o}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
