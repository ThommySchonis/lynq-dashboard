# Tailwind Design System Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1116-line `globals.css` with a ~285-line Tailwind-native design system by consolidating tokens to shadcn naming, registering animations in Tailwind theme, deleting dead code, and inlining all custom CSS classes into components.

**Architecture:** Three sequential phases — (1) Foundation: rewrite globals.css with new tokens + aliases for backwards compat, (2) Token Adoption: update all component classNames to use new token names, remove aliases, (3) Inline Custom Classes: convert remaining CSS classes to Tailwind utilities in components.

**Tech Stack:** Tailwind CSS 4 (with `@theme inline`), shadcn/base-ui, CSS custom properties, Next.js 16

**Spec:** `docs/superpowers/specs/2026-05-11-tailwind-design-system-migration-design.md`

---

## Phase 1: Foundation

### Task 1: Rewrite `globals.css` — Token System

**Files:**
- Modify: `app/globals.css`

This is the largest single task. Replace the entire file with the new structure. The spec sections 1.1–1.7 define exactly what the new file looks like.

- [ ] **Step 1: Read the current `app/globals.css` in full**

Understand the current structure: two `:root` blocks, two `@layer base` blocks, all custom classes, all keyframes.

- [ ] **Step 2: Write the new `app/globals.css`**

The new file structure in order:

1. **Imports** (keep existing):
```css
@import url('https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800&display=swap');
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
```

2. **@source directives** (keep existing):
```css
@source "../components";
@source "../hooks";
@source "../stores";
@source "../lib";
```

3. **@custom-variant** (keep existing):
```css
@custom-variant dark (&:is(.dark *));
```

4. **`:root` tokens** — single block with all consolidated tokens from spec section 1.1 (light mode table + semantic extensions table). Include temporary aliases from spec section 1.2 at the end of the `:root` block with a `/* Aliases — remove in Phase 2 */` comment.

5. **`.dark` tokens** — single block with all dark mode tokens from spec section 1.1 dark mode table.

6. **Sidebar tokens** — keep the existing sidebar-specific variables in both `:root` and `.dark` (they are unchanged).

7. **`@layer base`** — single merged block as defined in spec section 1.6. Contains: `*` border/outline reset, `html` font/scrollbar, `body` bg/text/smoothing, `::-webkit-scrollbar`, `::selection`, `a` transition, `tr` transition. Also include `.thin-scrollbar` inside this `@layer base` block (per spec section 3.2):
```css
  .thin-scrollbar::-webkit-scrollbar { width: 3px; }
  .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .thin-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }
```

8. **Float field sibling selector** (keep from current file):
```css
.float-field:not(:placeholder-shown) ~ .float-label,
.float-field:focus ~ .float-label {
  transform: translateY(-1.25rem) scale(0.85);
  color: var(--foreground-4);
}
```
Note: changed `var(--text-4)` to `var(--foreground-4)`.

9. **Autofill overrides** (keep `cm-input` styles from current file):
```css
.cm-input { color: var(--foreground) !important; -webkit-text-fill-color: var(--foreground) !important; background: transparent !important; }
.cm-input::placeholder { color: var(--foreground-3); -webkit-text-fill-color: var(--foreground-3); }
.cm-input:focus { caret-color: var(--foreground); outline: none; }
.cm-input:-webkit-autofill,
.cm-input:-webkit-autofill:hover,
.cm-input:-webkit-autofill:focus,
.cm-input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 1000px var(--card) inset !important;
  -webkit-text-fill-color: var(--foreground) !important;
  caret-color: var(--foreground);
  transition: background-color 9999s ease-in-out 0s;
}
```
Note: references updated from old tokens to new tokens.

10. **Contenteditable placeholder** (keep from current file):
```css
.compose-ta[contenteditable=true]:empty:before {
  content: attr(data-placeholder);
  color: var(--foreground-3);
  pointer-events: none;
  display: block;
}
```

11. **`@theme inline` block** — contains:
   - Font mappings (keep existing)
   - Color mappings: map ALL tokens (standard shadcn + semantic extensions) to `--color-*` format. Include new extension tokens:
     ```
     --color-foreground-2: var(--foreground-2);
     --color-foreground-3: var(--foreground-3);
     --color-foreground-4: var(--foreground-4);
     --color-success: var(--success);
     --color-success-soft: var(--success-soft);
     --color-warning: var(--warning);
     --color-warning-soft: var(--warning-soft);
     --color-destructive-soft: var(--destructive-soft);
     --color-info: var(--info);
     --color-info-soft: var(--info-soft);
     --color-border-hover: var(--border-hover);
     --color-accent-soft: var(--accent-soft);
     --color-accent-border: var(--accent-border);
     --color-divider: var(--divider);
     ```
   - Radius scale (keep existing)
   - Animation registrations: for each keyframe in spec section 1.4, add:
     ```
     --animate-shimmer: shimmer 1.4s ease infinite;
     --animate-fade-up: fadeInUp 0.5s ease forwards;
     --animate-fade-left: fadeInLeft 0.5s ease forwards;
     --animate-pulse-green: pulseGreen 2s ease-in-out infinite;
     --animate-word-reveal: wordReveal 800ms cubic-bezier(0.16,1,0.3,1) forwards;
     --animate-dot-bounce: dotBounce 1.4s ease-in-out infinite;
     --animate-modal-in: modalIn 240ms cubic-bezier(0.16,1,0.3,1);
     --animate-fade-up-quick: fadeUp 140ms ease both;
     --animate-aurora-a: auroraA 22s ease-in-out infinite;
     --animate-aurora-b: auroraB 26s ease-in-out infinite;
     --animate-aurora-c: auroraC 25s ease-in-out infinite;
     --animate-aurora-d: auroraD 19s ease-in-out infinite;
     --animate-aurora-e: auroraE 20s ease-in-out infinite;
     --animate-orb-float-1: orbFloat1 20s ease-in-out infinite;
     --animate-orb-float-2: orbFloat2 25s ease-in-out infinite;
     --animate-orb-float-3: orbFloat3 30s ease-in-out infinite;
     --animate-orb-float-4: orbFloat4 22s ease-in-out infinite;
     --animate-orb-drift-a: orbDriftA 40s ease-in-out infinite;
     --animate-orb-drift-b: orbDriftB 45s ease-in-out infinite;
     --animate-orb-drift-c: orbDriftC 50s ease-in-out infinite;
     --animate-confetti-fall: confettiFall 3s linear forwards;
     --animate-blink: blink 1s step-end infinite;
     --animate-border-pulse: borderPulse 2s ease-in-out infinite;
     --animate-ac-float: ac-float 20s ease-in-out infinite;
     ```

12. **`@keyframes` definitions** — only the actively-used ones from spec section 1.4. Copy the keyframe bodies from the current file for: `shimmer`, `fadeInUp`, `fadeInLeft`, `pulseGreen`, `wordReveal`, `dotBounce`, `modalIn`, `fadeUp`, `auroraA`, `auroraB`, `auroraC`, `auroraD`, `auroraE`, `orbFloat1-4`, `orbDriftA-C`, `confettiFall`, `blink`, `borderPulse`, `ac-float`.

**Delete everything else** — all custom utility classes listed in spec section 1.5 (glass-card, premium-input, badge-*, page-title, filter-pill, tooltip, sdrop, order-card, modal-*, stat-card, etc.), all unused keyframes (pulseGreenGlow, borderGlow, pulseRed, auroraBlob, ac-spin, ac-pulse, spin, glowPulse, urgPulse, checkPop, toastIn, pulse-green), all unused CSS variable groups, the second `:root` block.

**Keep all feature-specific classes for now** (trow, vtab, ctab, macro-*, ac-*, fe-*, msg-*, chat-*, vf-*, login-*, home-content-item, animate-fade-in-*, in-bg, in-panel-l, in-al*, in-grid, in-vig, compose-box, sscroll) — these will be removed in Phase 3. Update them as follows:
- Replace CSS variable references from old names to new names (e.g., `var(--bg-surface)` → `var(--card)`, `var(--text-1)` → `var(--foreground)`)
- Convert `[data-theme="dark"]` selectors on kept classes to `.dark` selectors. For example: `[data-theme="dark"] .trow:hover` → `.dark .trow:hover`, `[data-theme="dark"] .compose-box` → `.dark .compose-box`, `[data-theme="dark"] .in-panel-l` → `.dark .in-panel-l`, etc. This ensures dark mode continues working for feature classes until they are inlined in Phase 3.

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds. No visual changes because aliases map old names to new values.

---

### Task 2: Update Dark Mode — `theme-sync.tsx`

**Files:**
- Modify: `components/providers/theme-sync.tsx`

- [ ] **Step 1: Read the current file**

Read `components/providers/theme-sync.tsx` to confirm the current implementation.

- [ ] **Step 2: Simplify to `.dark` class only**

Replace the file contents with:

```tsx
'use client'

import { useEffect } from 'react'
import { useThemeStore } from '@/stores/theme'

export function ThemeSync() {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  return null
}
```

Changes:
- Removed `root.setAttribute('data-theme', theme)` — no longer needed
- Removed second `useEffect` that reads `data-theme` from DOM — redundant because `useThemeStore` uses `zustand/persist` middleware (localStorage key `lynq-theme-store`) for hydration

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds. Dark mode still works via `.dark` class.

---

### Task 3: Update CLAUDE.md Dark Mode Reference

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update rule 7**

In the "Prefer Tailwind theme over globals.css" section, change the reference from `[data-theme="dark"]` to `.dark` class. The rule should read that `globals.css` is acceptable for "dark mode variants that need `.dark` class selectors".

---

## Phase 2: Token Adoption

### Task 4: Discover ALL Files Needing Token Updates

**Files:** None modified — discovery only.

This step uses grep to find EVERY file that references old tokens or hardcoded colors. The file lists in the spec are non-exhaustive — the actual codebase has ~80+ files that need updates.

- [ ] **Step 1: Grep for old CSS variable references**

Search all `.tsx` and `.ts` files (excluding `node_modules`, `globals.css`, and `docs/`) for these patterns:
```
--bg-page|--bg-surface|--bg-surface-2|--bg-row|--bg-input
--text-1|--text-2|--text-3|--text-4
--error[^-]|--danger
```

Record every file path that matches.

- [ ] **Step 2: Grep for hardcoded hex colors that should be tokens**

Search all `.tsx` files for:
```
#A175FC|#8B5CF6|#1C0F36|#0F0F10|#F9F8FF|#F5F4FF|#374151|#6B7280|#9CA3AF|#EDE5FE
```

For each match, determine if it's semantic (should become a token) or decorative (keep as-is). Decorative exemptions:
- `CONFETTI_COLORS` arrays
- `stroke="..."` in SVG elements
- Radial/linear gradient inline styles for visual effects (aurora, certificate decorations)
- `linear-gradient(135deg,#8B5CF6,#6366F1)` decorative gradients
- `bg-[#0D0F14]` sidebar-specific dark color

Record all non-exempt files.

- [ ] **Step 3: Combine into a complete file list**

Merge the lists from Steps 1 and 2. This is the complete set of files that need updating in Tasks 5-6. Group them by directory for batch processing.

---

### Task 5: Replace Old Tokens — Batch 1 (components/features/ and app/ pages)

**Files:** All files from Task 4's list that live under `components/features/` and `app/` page files.

- [ ] **Step 1: Read each file and apply token replacements**

Use the replacement table from spec section 2.1. For every file in the list:

**CSS variable replacements:**
- `bg-(--bg-page)`, `bg-[var(--bg-page)]` → `bg-background`
- `bg-(--bg-surface)`, `bg-[var(--bg-surface)]` → `bg-card`
- `bg-(--bg-surface-2)`, `bg-[var(--bg-surface-2)]` → `bg-secondary`
- `bg-(--bg-row)`, `bg-[var(--bg-row)]` → `bg-card`
- `bg-(--bg-input)`, `bg-[var(--bg-input)]` → `bg-input`
- `text-(--text-1)`, `text-[var(--text-1)]` → `text-foreground`
- `text-(--text-2)`, `text-[var(--text-2)]` → `text-foreground-2`
- `text-(--text-3)`, `text-[var(--text-3)]` → `text-muted-foreground`
- `text-(--text-4)`, `text-[var(--text-4)]` → `text-foreground-4`
- `border-(--border)`, `border-[var(--border)]` → `border-border` (but NOT `--border-hover` — that keeps its name)
- Any `var(--error)` in className context → use `destructive` token
- Any `var(--danger)` in className context → use `destructive` token

**Hardcoded color replacements:**
- `bg-[#A175FC]`, `bg-[#8B5CF6]` → `bg-primary`
- `text-[#A175FC]`, `text-[#8B5CF6]` → `text-primary`
- `border-[#A175FC]/18` → `border-primary/18`
- `from-[#A175FC]` → `from-primary`
- `bg-[#EDE5FE]` → `bg-primary/10`
- `text-[#1C0F36]` → `text-foreground`
- `text-[#0F0F10]` → `text-foreground`
- `placeholder:text-[#9B91A8]` → `placeholder:text-foreground-4`
- `focus-visible:border-[#A175FC]` → `focus-visible:border-primary`
- `focus-visible:ring-[#A175FC]/20` → `focus-visible:ring-primary/20`

**Keep as-is (extension tokens — no rename needed):**
- `shadow-(--shadow-card)`, `shadow-(--shadow-card-hover)`, etc.
- `from-(--skeleton-from)`, `via-(--skeleton-to)`, etc.
- `hover:border-(--border-hover)`
- `bg-(--accent-soft)`, `border-(--accent-border)`
- `border-(--divider)`

**Keep as-is (decorative one-offs):**
- `bg-[#0D0F14]` (sidebar-specific)
- SVG `stroke` attributes
- `CONFETTI_COLORS` arrays
- Decorative gradient inline styles

- [ ] **Step 2: Run build to verify**

Run: `npm run build`

---

### Task 6: Replace Old Tokens — Batch 2 (components/layout/, components/shared/)

**Files:** All files from Task 4's list under `components/layout/` and `components/shared/`.

- [ ] **Step 1: Read each file and apply same replacement rules as Task 5**

- [ ] **Step 2: Run build to verify**

Run: `npm run build`

---

### Task 7: Verify Complete Migration and Remove Aliases

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Run exhaustive grep for old token names**

Search ALL `.tsx`/`.ts` files (excluding `node_modules`, `docs/`) for:
```
--bg-page|--bg-surface|--bg-surface-2|--bg-row|--bg-input|--text-1|--text-2|--text-3|--text-4|--error[^-]|--danger
```

Expected: **Zero matches in component files.** The only matches should be in `globals.css` (aliases and feature class definitions that still reference old names via aliases).

If any component file still references old tokens, fix it before proceeding.

- [ ] **Step 2: Update remaining old token references in feature classes in `globals.css`**

The feature classes kept for Phase 3 (trow, msg-*, ac-*, etc.) may still reference old token names like `var(--text-1)`. These are safe because of aliases, but since we're removing aliases now, update them to new names: `var(--foreground)`, `var(--card)`, etc.

- [ ] **Step 3: Delete the alias block from `:root`**

Remove the `/* Aliases — remove in Phase 2 */` section from `globals.css`.

- [ ] **Step 4: Run build to verify**

Run: `npm run build`
Expected: Build succeeds with zero issues. If any color is missing (empty value), grep for the old token name and fix.

---

## Phase 3: Inline Custom Classes

### Task 8: Inline Inbox Classes

**Files:**
- Modify: `components/features/inbox/thread-list-panel.tsx`
- Modify: `components/features/inbox/conversation-panel.tsx`
- Modify: `components/features/inbox/macro-panel.tsx`
- Modify: `components/features/inbox/composer-toolbar.tsx`
- Modify: `app/globals.css` (remove inbox class definitions)

- [ ] **Step 1: Read all inbox component files that use custom classes**

Grep for `trow`, `vtab`, `ctab`, `sscroll`, `macro-`, `rtbar-sep`, `compose-box` in inbox component files.

- [ ] **Step 2: Replace `sscroll` with `thin-scrollbar` across inbox**

Find all `sscroll` className references in inbox components and replace with `thin-scrollbar`.

- [ ] **Step 3: Inline `.trow` classes in `thread-list-panel.tsx`**

Replace `className="trow"` with the Tailwind equivalent from spec section 3.1:
```
className="flex items-start gap-[9px] px-3.5 py-2.5 cursor-pointer border-b border-border border-l-[3px] border-l-transparent transition-colors relative"
```

For active state (`trow-active`), add conditionally:
```
bg-secondary border-l-primary after:absolute after:left-0 after:top-0 after:bottom-0 after:w-[3px] after:bg-primary after:rounded-r-sm after:content-['']
```

Replace `trow-cb` with: `size-4 rounded border-[1.5px] border-border bg-card cursor-pointer appearance-none shrink-0 mt-0.5 transition-all checked:bg-foreground checked:border-foreground`

Replace `trow-snippet` with: `line-clamp-2`

- [ ] **Step 4: Inline `.vtab` and `.ctab` classes**

In `thread-list-panel.tsx`, replace `vtab` className with Tailwind equivalent from spec.
In `conversation-panel.tsx`, replace `ctab` className with Tailwind equivalent from spec.

Use `data-[active]` or conditional `cn()` for active states depending on current component implementation.

- [ ] **Step 5: Inline `.macro-*` classes in `macro-panel.tsx`**

Replace all macro class names with their Tailwind equivalents from spec section 3.1. Use `cn()` for conditional states.

- [ ] **Step 6: Inline `.rtbar-sep` in `composer-toolbar.tsx`**

Replace with: `w-px h-[18px] bg-secondary mx-1.5 shrink-0`

- [ ] **Step 7: Inline `.compose-box` dark mode in the component that uses it**

Find the component that has `compose-box` className and add `dark:bg-[rgba(255,255,255,0.025)]` to its Tailwind classes. Remove the `compose-box` className.

- [ ] **Step 8: Remove inbox class definitions from `globals.css`**

Delete the following class definitions from `globals.css`:
- `.trow`, `.trow:hover`, `.trow-active`, `.dark .trow` variants, `.trow-active::after`
- `.trow-cb`, `.trow-cb:checked`, `.trow-cb:hover`
- `.trow-snippet`
- `.vtab`, `.vtab.on`, `.vtab:hover`
- `.ctab`, `.ctab.on`, `.ctab:hover`
- `.sscroll` and its scrollbar pseudo-elements
- `.macro-panel`, `.macro-item`, `.macro-item.mi-active`, `.macro-item:hover`
- `.macro-var`, `.macro-suggest`
- `.macro-gear-menu`, `.macro-gear-item`, `.macro-gear-item:hover`, `.macro-gear-item.danger`
- `.macro-gear-divider`
- `.macro-star`, `.macro-item:hover .macro-star`, `.macro-star:hover`, `.macro-star.fav`
- `.rtbar-sep`
- `.compose-box` (the `.dark .compose-box` rule)

- [ ] **Step 9: Run build to verify**

Run: `npm run build`

---

### Task 9: Inline Academy Classes

**Files:**
- Modify: `components/features/academy/academy-sidebar.tsx`
- Modify: `components/features/academy/quiz-view.tsx`
- Modify: `components/features/academy/module-view.tsx`
- Modify: `components/features/academy/final-exam.tsx`
- Modify: `components/features/academy/academy-page.tsx`
- Modify: `components/features/academy/certificate-page.tsx`
- Modify: `app/globals.css` (remove academy class definitions)

- [ ] **Step 1: Read all academy component files that use custom classes**

Grep for `ac-scroll`, `ac-nav-item`, `ac-sub-item`, `ac-option`, `ac-radio`, `ac-lesson-row`, `fe-option`, `fe-radio` in academy components.

- [ ] **Step 2: Replace `ac-scroll` with `thin-scrollbar`**

- [ ] **Step 3: Inline `.ac-nav-item` and `.ac-sub-item` in `academy-sidebar.tsx`**

Replace with Tailwind equivalents from spec section 3.1. Use conditional `cn()` or `data-*` attributes for `active` and `done` states.

- [ ] **Step 4: Inline `.ac-option` and `.ac-radio` in `quiz-view.tsx`**

Replace with Tailwind equivalents. Handle `selected`, `correct`, `incorrect` states via `data-*` attributes or conditional `cn()`.

- [ ] **Step 5: Inline `.ac-lesson-row` in `module-view.tsx`**

Replace with Tailwind equivalent.

- [ ] **Step 6: Inline `.fe-option` and `.fe-radio` in `final-exam.tsx`**

Replace with Tailwind equivalents.

- [ ] **Step 7: Remove academy class definitions from `globals.css`**

Delete: `.ac-scroll`, `.ac-nav-item` (and variants), `.ac-sub-item` (and variants), `.ac-option` (and variants), `.ac-radio` (and variants), `.ac-lesson-row`, `.fe-option` (and variants), `.fe-radio` (and variants), `@media print .cert-no-print`.

- [ ] **Step 8: Run build to verify**

Run: `npm run build`

---

### Task 10: Inline Chat & Message Classes

**Files:**
- Modify: `components/features/home/chat-message-bubble.tsx`
- Modify: `app/home/page.tsx`
- Modify: `components/features/inbox/message-list.tsx`
- Modify: `components/features/inbox/notes-section.tsx`
- Modify: `app/globals.css` (remove chat/message class definitions)

- [ ] **Step 1: Read components using msg-*, chat-scroll, chat-bottom**

- [ ] **Step 2: Replace `chat-scroll` with `thin-scrollbar` in `app/home/page.tsx`**

- [ ] **Step 3: Inline `.msg-user` and `.msg-ai` in `chat-message-bubble.tsx`**

Replace with Tailwind equivalents from spec section 3.1.

- [ ] **Step 4: Inline `.chat-bottom` in `app/home/page.tsx`**

Replace with Tailwind equivalent. Also inline the textarea styles if they reference `.chat-bottom textarea`.

- [ ] **Step 5: Inline `.msg-in`, `.msg-out`, `.msg-note` in inbox message components**

Replace in `message-list.tsx` and `notes-section.tsx` with Tailwind equivalents from spec. These include `dark:` variants for dark mode styling.

- [ ] **Step 6: Remove chat/message class definitions from `globals.css`**

Delete: `.msg-user`, `.msg-ai`, `.msg-in` (and dark variant), `.msg-out` (and dark variant), `.msg-note` (and dark variant), `.chat-scroll`, `.chat-bottom` (and variants).

- [ ] **Step 7: Run build to verify**

Run: `npm run build`

---

### Task 11: Inline Auth, Value Feed, Home, and Inbox Background Classes

**Files:**
- Modify: `components/features/auth/auth-layout.tsx`
- Modify: `components/features/auth/verify-panel.tsx`
- Modify: `components/features/auth/headline-words.tsx`
- Modify: `components/features/value-feed/feed-skeleton.tsx`
- Modify: `components/features/value-feed/feed-empty-state.tsx`
- Modify: Value feed tab components (grep for `vf-tab`)
- Modify: `app/home/page.tsx`
- Modify: Components using `animate-fade-in-*` (grep in time-tracking, analytics)
- Modify: Inbox layout components using `in-bg`, `in-panel-l`, `in-al*`, `in-grid`, `in-vig`
- Modify: `app/globals.css` (remove remaining class definitions)

- [ ] **Step 1: Read all affected components**

Grep for `login-fade`, `login-d-`, `word-reveal`, `vf-fade`, `vf-tab`, `home-content-item`, `animate-fade-in`, `in-bg`, `in-panel-l` across the codebase.

- [ ] **Step 2: Inline auth animation classes**

In `auth-layout.tsx` and `verify-panel.tsx`:
- Replace `login-fade` with `opacity-0 animate-fade-up motion-reduce:opacity-100 motion-reduce:animate-none`
- Replace `login-d-0` through `login-d-10` with inline `delay-[0ms]`, `delay-[160ms]`, etc.

In `headline-words.tsx`:
- Replace `word-reveal` with `inline-block opacity-0 animate-word-reveal motion-reduce:opacity-100 motion-reduce:animate-none motion-reduce:blur-none`

**Important:** The current `globals.css` has `@media (prefers-reduced-motion)` rules that disable animations and set opacity to 1 for `.login-fade` and `.word-reveal`. When inlining, replicate this with Tailwind's `motion-reduce:` variant. Apply `motion-reduce:opacity-100 motion-reduce:animate-none` to any element that uses `opacity-0` + an animation.

- [ ] **Step 3: Inline value feed classes**

- Replace `vf-fade` with `opacity-0 animate-fade-up-quick motion-reduce:opacity-100 motion-reduce:animate-none`
- Replace `vf-tab` with Tailwind equivalent from spec
- Replace `vf-tab-count` with `text-[11px] text-foreground-4 tabular-nums`

- [ ] **Step 4: Inline home page animation classes**

In `app/home/page.tsx`:
- Replace `home-content-item` with `opacity-0 animate-fade-up` + `style={{ animationDelay: '${index * 0.1}s' }}`

In time-tracking/analytics components:
- Replace `animate-fade-in-1` through `animate-fade-in-4` with `animate-fade-up delay-[50ms]`, `delay-[100ms]`, etc.

- [ ] **Step 5: Inline inbox background/aurora classes**

Replace `in-bg`, `in-panel-l`, `in-al1`, `in-al4`, `in-al6`, `in-grid`, `in-vig` with Tailwind equivalents from spec section 3.1. The aurora blobs use `hidden dark:block` + absolute positioning with radial gradients.

- [ ] **Step 6: Remove all remaining custom class definitions from `globals.css`**

Delete everything that was kept for Phase 3:
- `.login-fade`, `.login-d-*`, `.word-reveal` (and reduced-motion variants)
- `.vf-fade`, `.vf-tab`, `.vf-tab.active`, `.vf-tab-count`, `.vf-tab.active .vf-tab-count`
- `.home-content-item` (and nth-child variants)
- `.animate-fade-in`, `.animate-fade-in-1` through `.animate-fade-in-4`
- `.in-bg`, `.in-panel-l`, `.dark .in-panel-l`, `.in-al1`, `.in-al4`, `.in-al6`, `.in-grid`, `.in-vig`
- `@media (prefers-reduced-motion)` rules for `.vf-orb`, `.vf-fade`, `.login-fade`, `.word-reveal`
- `@keyframes fbPanel` (if unused)

Also verify nothing remains in the "Inbox page styles" section or "Value Feed" section.

- [ ] **Step 7: Run build to verify**

Run: `npm run build`

- [ ] **Step 8: Final verification grep**

Run grep for any remaining custom class names from the original `globals.css` that should have been removed. Check that `globals.css` is now ~285 lines.

---

## Post-Migration

### Task 12: Final Cleanup and Verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Clean build with no errors.

- [ ] **Step 2: Verify `globals.css` line count**

Run: `wc -l app/globals.css`
Expected: ~285 lines (down from 1116).

- [ ] **Step 3: Grep for any remaining old token references**

Search across all `.tsx` files for: `--bg-page`, `--bg-surface`, `--text-1`, `--text-2`, `--text-3`, `--text-4`, `--error[^-]`, `--danger`.

Expected: No matches outside of `globals.css` comments or this plan document.

- [ ] **Step 4: Grep for any remaining custom class references**

Search for: `glass-card`, `premium-card`, `badge-open`, `page-title`, `filter-pill`, `tooltip` (as className), `stat-card`, `modal-backdrop`, `order-card`.

Expected: No matches in component files.
