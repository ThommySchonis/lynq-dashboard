// lib/legal/types.ts
import type { ReactNode } from 'react'

export interface LegalSection {
  /** Anchor slug used in URL hash and TOC links, e.g. "scope-of-the-service" */
  id: string
  /** Display number; string to support "6A" and "6B" in Terms */
  number: string
  /** Heading shown in the TOC and at the top of the section */
  title: string
  /** Section body rendered inside <LegalSection> */
  body: ReactNode
}

export interface LegalDoc {
  /** Page title — "Terms of Service" or "Privacy Policy" */
  title: string
  /** Human-readable "Last updated" date, e.g. "June 1, 2026" */
  lastUpdated: string
  /** Optional preamble shown above the first section */
  intro?: ReactNode
  /** Ordered list of numbered sections */
  sections: LegalSection[]
}
