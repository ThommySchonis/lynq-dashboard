// lib/services/pdf-report-kit.tsx
//
// Shared presentation kit for @react-pdf/renderer reports (analytics, orders,
// and support performance). Single source of truth for the color palette,
// stylesheet, and date formatting used across all PDF reports.

import { StyleSheet } from '@react-pdf/renderer'

const COLORS = {
  ink:      '#1C0F36',
  mutedInk: '#64748B',
  lightInk: '#94A3B8',
  border:   '#E2E8F0',
  accent:   '#A175FC',
  surface:  '#F8FAFC',
  white:    '#FFFFFF',
}

export const styles = StyleSheet.create({
  page: {
    padding:    40,
    fontSize:   10,
    color:      COLORS.ink,
    fontFamily: 'Helvetica',
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
    marginBottom:   28,
    paddingBottom:  16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brand: {
    fontSize:    18,
    fontFamily:  'Helvetica-Bold',
    color:       COLORS.ink,
    marginBottom: 3,
  },
  brandSubtitle: {
    fontSize: 9,
    color:    COLORS.mutedInk,
  },
  reportMeta: {
    textAlign: 'right',
  },
  reportLabel: {
    fontSize:      8,
    color:         COLORS.lightInk,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom:  3,
  },
  reportTitle: {
    fontSize:   14,
    fontFamily: 'Helvetica-Bold',
    color:      COLORS.ink,
  },
  kpiRow: {
    flexDirection: 'row',
    gap:           10,
    marginBottom:  28,
  },
  kpiBox: {
    flex:            1,
    backgroundColor: COLORS.surface,
    borderRadius:    6,
    padding:         12,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  kpiLabel: {
    fontSize:     8,
    color:        COLORS.mutedInk,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  kpiValue: {
    fontSize:   14,
    fontFamily: 'Helvetica-Bold',
    color:      COLORS.ink,
  },
  sectionTitle: {
    fontSize:      9,
    fontFamily:    'Helvetica-Bold',
    color:         COLORS.lightInk,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom:  10,
  },
  table: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection:     'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom:     6,
    marginBottom:      2,
    backgroundColor:   COLORS.surface,
    paddingHorizontal: 8,
    paddingTop:        6,
  },
  tableHeaderCell: {
    fontSize:      8,
    fontFamily:    'Helvetica-Bold',
    color:         COLORS.lightInk,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection:     'row',
    paddingVertical:   7,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: COLORS.surface,
  },
  cell: {
    fontSize: 9,
    color:    COLORS.ink,
  },
  cellMuted: {
    fontSize: 9,
    color:    COLORS.mutedInk,
  },
  colFlex4: { flex: 4 },
  colFlex2: { flex: 2 },
  colFlex1: { flex: 1, textAlign: 'right' },
  colFlex15: { flex: 1.5, textAlign: 'right' },
  footer: {
    position:       'absolute',
    bottom:         28,
    left:           40,
    right:          40,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop:     8,
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color:    COLORS.lightInk,
  },
  footerAccent: {
    fontSize: 8,
    color:    COLORS.accent,
  },
})

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}
