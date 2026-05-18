---
name: page-rules
description: MUST invoke before creating or editing any page.tsx or layout.tsx in app/
---

# Page & Layout Rules

## Page Files
- Page files are thin orchestrators — under 150 lines
- No sub-components, constants, or helper functions inline in page files
- Extract sub-components to `components/features/<feature>/` (even if used by one page)
- Extract constants to `lib/<feature>-constants.ts`
- Extract helpers to `lib/<feature>-utils.ts`
- Page imports hooks, components, and constants — then renders

## Fonts
- Fonts loaded globally in root `layout.tsx` only — never per-page

## Styling
- Design tokens from `globals.css` via `@theme inline` block
- Dark mode via `.dark` class + Tailwind `dark:` prefix, never `[data-theme]` selectors
- New animations: `@keyframes` in `globals.css`, register in `@theme inline` as `--animate-<name>`, use as `animate-<name>`

## globals.css Structure
- imports -> `:root` tokens -> `.dark` tokens -> `@layer base` -> pseudo-element selectors -> `@theme inline` -> `@keyframes`
- Only CSS in `globals.css` that Tailwind can't express: pseudo-element selectors, sibling selectors, `@keyframes`
- Never add custom utility classes to `globals.css`
- Never add element-level resets outside `@layer base`
