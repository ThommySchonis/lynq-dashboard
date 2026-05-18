---
name: component-rules
description: MUST invoke before creating or editing any file in components/, hooks/, or any .tsx file that exports a React component
---

# Component & Hook Rules

## UI Rules
- Separate business logic from UI — hooks for data (`hooks/<feature>/`), components for rendering
- Use shadcn components from `components/ui/` over custom HTML elements (base-ui, not Radix — `render` prop, not `asChild`)
- Tailwind token classes only — `bg-primary`, `text-foreground`, etc. No hardcoded hex (except decorative one-offs). No `style={{}}` for static styling. No `<style dangerouslySetInnerHTML>`.
- Lucide icons only from `lucide-react` — no inline `<svg>`, no wrapper components around icons
- Keep files under 300 lines — extract sub-components to `components/features/<feature>/`
- Shared components go in `components/shared/`
- Constants in `lib/<feature>-constants.ts`, helpers in `lib/<feature>-utils.ts` — never inline
- Non-icon SVGs in `public/textures/` or `public/icons/`, referenced via URL

## State Management
- Zustand for UI state (toggles, selections, modals), TanStack React Query for server state (API data). Never store API data in Zustand.
- Use Zustand selectors: `useStore(s => s.field)`, not `useStore()`

## Forms
- Forms with 2+ fields: `useForm` from react-hook-form + `zodResolver` + zod schema. Never manual `useState` per field.

## Auth
- Auth access: `useAuthStore(s => s.session)` — never `supabase.auth.getSession()` in components

## Styling
- Colors use shadcn tokens: `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--destructive`, `--border`, `--input`, `--ring` + semantic extensions (`--foreground-2`, `--foreground-3`, `--success`, `--warning`, etc.)
- Dark mode: `.dark` class on `<html>`, use `dark:` prefix. Never `[data-theme="dark"]`.
- Fonts referenced via CSS variables (`font-[family-name:var(--font-display)]`), never imported per-component
- `motion-reduce:` variant on any element with `opacity-0` + animation

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

## Adding New Shopify Functionality
1. Add service function to `lib/services/shopify.ts`
2. Create thin API route that calls it
3. Use `shopifyFetchJSON()` helper for Shopify REST API calls
4. For heavy aggregations on `shopify_orders`, prefer PostgreSQL stored functions
