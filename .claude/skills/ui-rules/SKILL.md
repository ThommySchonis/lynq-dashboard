---
name: ui-rules
description: MUST invoke before creating or editing any component, hook, page, layout, store, or styling — files in components/, hooks/, stores/, app/**/page.tsx, app/**/layout.tsx, or globals.css
---

# UI Rules (Components, Hooks, Pages, Styling)

## Components & Hooks
- Separate business logic from UI — hooks for data (`hooks/<feature>/`), components for rendering
- Use shadcn components from `components/ui/` over custom HTML elements (base-ui, not Radix — `render` prop, not `asChild`)
- Tailwind token classes only — `bg-primary`, `text-foreground`, etc. No hardcoded hex (except decorative one-offs). No `style={{}}` for static styling. No `<style dangerouslySetInnerHTML>`.
- Lucide icons only from `lucide-react` — no inline `<svg>`, no wrapper components around icons
- Keep component files under 300 lines — extract sub-components to `components/features/<feature>/`
- Shared components go in `components/shared/`
- Constants in `lib/<feature>-constants.ts`, helpers in `lib/<feature>-utils.ts` — never inline
- Non-icon SVGs in `public/textures/` or `public/icons/`, referenced via URL

## State Management
- Zustand for UI state (toggles, selections, modals), TanStack React Query for server state (API data). Never store API data in Zustand.
- Use Zustand selectors: `useStore(s => s.field)`, not `useStore()`

## Forms
- Forms with 2+ fields: `useForm` from react-hook-form + `zodResolver` + zod schema. Never manual `useState` per field.

## Auth (read-only in components)
- Auth access: `useAuthStore(s => s.session)` — never `supabase.auth.getSession()` in components. For the full auth flow, see `supabase-auth-rules`.

## TanStack React Query Patterns
- All API fetches use `useQuery` (reads) and `useMutation` (writes)
- Define query keys in a `<Feature>Keys` object at the top of the data hook file
- Never use `useState` + `useEffect` + `fetch` for server data
- Mutations invalidate related queries on success

## Hook Directory Structure
- Each feature's hooks in `hooks/<feature>/`:
  - `use-<feature>-data.ts` — `useQuery` hooks (reads)
  - `use-<feature>-mutations.ts` — `useMutation` hooks (writes)
  - `index.ts` — barrel re-export
- All hook files must have `'use client'` directive
- Custom hooks that don't fit TanStack (e.g., streaming) go in their own file

## Pages & Layouts
- Page files are thin orchestrators — under 150 lines. No sub-components, constants, or helpers inline.
- Extract sub-components to `components/features/<feature>/` (even if used by one page)
- Page imports hooks, components, and constants — then renders
- Fonts loaded globally in root `layout.tsx` only — never per-page
- All settings pages live under `app/(protected)/settings/<category>/<page>/`. The `(protected)` route group supplies `AppShell` + `SettingsSidebar` via the parent `layout.tsx`. Putting a page under `app/settings/...` produces an unstyled, sidebar-less page.
- New settings pages need a `SettingsNavItem` entry in `lib/settings-constants.ts` `SETTINGS_NAV` to appear in the sidebar (data-driven, not auto-discovered).
- Standard settings page shell: `<div className="max-w-3xl mx-auto px-10 py-12">` wrapping `<SettingsSection title=… description=… actions=…>` and `<SettingsCard>` from `components/features/settings/settings-section.tsx`. Don't roll your own header/card.

## Styling & Design System
- **`app/globals.css` is the source of truth for all colors, fonts, and styles** — NOT this skill or CLAUDE.md. A redesign is in progress (owned by **tkvlad1966**): palette, fonts, and visual styling may differ from any example here. Before styling, read the current token values from `globals.css`. Never hardcode hex from docs, and never "fix" a color to match documentation — if `globals.css` disagrees with an example, `globals.css` wins. Do not revert or override tkvlad1966's design-token / `globals.css` changes; build on them.
- Consume tokens via Tailwind token classes only (`bg-primary`, `text-foreground`, …) so components track the redesign automatically. No hardcoded hex (except decorative one-offs), no `style={{}}` for static color.
- Design tokens live in `app/globals.css` as CSS variables, mapped to Tailwind via `@theme inline`. Colors use shadcn naming (hex/rgba, not oklch).
- Token names (structural, stable across the redesign — values live in `globals.css`): standard shadcn (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--destructive`, `--border`, `--input`, `--ring`) + semantic extensions (`--foreground-2/3/4`, `--success`, `--warning`, `--info`, `--border-hover`, `--accent-soft`).
- Fonts: reference via CSS variables (`font-sans`, `font-[family-name:var(--font-display)]`, `--font-dm-sans`), never imported per-component. Exact families are defined in `globals.css` and may change with the redesign.
- Dark mode: `.dark` class on `<html>`, use `dark:` prefix. Never `[data-theme="dark"]`.
- `motion-reduce:` variant on any element with `opacity-0` + animation.
- New animations: `@keyframes` in `globals.css`, register in `@theme inline` as `--animate-<name>`, use as `animate-<name>`.
- `globals.css` structure: imports → `:root` tokens → `.dark` tokens → `@layer base` → pseudo-element selectors → `@theme inline` → `@keyframes`. Only put CSS Tailwind can't express (pseudo-elements, sibling selectors, `@keyframes`). Never add custom utility classes or element-level resets outside `@layer base`.

## Common UI Pitfalls
### base-ui Select (NOT Radix)
`components/ui/select.tsx` wraps `@base-ui/react/select`:
- `<SelectValue>` shows the raw `value` unless given a render-function child. The `label` prop on `<SelectItem>` is for keyboard navigation only — it does NOT affect trigger display. To show a friendly label:
  ```tsx
  <SelectValue placeholder="…">
    {(value: string | null) => members.find((m) => m.id === value)?.name ?? value}
  </SelectValue>
  ```
- `onValueChange` signature is `(value: string | null) => void`. Handle null explicitly — base-ui emits null when cleared. A typed `(v: string) => ...` callback fails the TypeScript build.

### shadcn `Card` has built-in `py-4`
Wrapping an interactive element (e.g. `<Button>`) inside `<Card>` creates visible top/bottom gutters the hover background can't fill. Either drop the `Card` wrapper or pass `className="py-0"`.

## Adding New Shopify UI
For Shopify data display, fetch via TanStack Query hooks that call the API — never call Shopify directly from components. See `shopify-rules` for the service/route side.
