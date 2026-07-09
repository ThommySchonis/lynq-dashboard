// lib/services/support-analytics-export-pdf.tsx
//
// PDF report for the Performance (support-analytics) page. Uses the shared
// pdf-report-kit styles and @react-pdf/renderer. Data is fetched via the
// support-analytics export service.

import {
  Document,
  Page,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'
import { styles, formatDate } from '@/lib/services/pdf-report-kit'
import { formatSeconds } from '@/lib/performance-utils'
import {
  computeSupportKpis,
  fetchSupportAnalytics,
  type SupportExportParams,
} from '@/lib/services/support-analytics-export'
import type { SupportAnalyticsBundle } from '@/types/support-analytics'

// ─── Report data shape ────────────────────────────────────────────────────────

export interface SupportReportData {
  range: { from: string; to: string }
  agentName: string | null
  kpis: {
    avgResponse: string
    avgResolution: string
    ticketsResolved: number
    oneTouchRate: string
  }
  ticketVolume: Array<{ date: string; opened: number; resolved: number }>
  agents: Array<{
    name: string
    messagesSent: number
    ticketsResolved: number
    oneTouchRate: string
    avgMessages: string
  }>
  refundReasons: Array<{ reason: string; count: number; percentage: string }>
}

export function buildSupportReportData(bundle: SupportAnalyticsBundle): SupportReportData {
  const { ticketsResolved, oneTouchRatePct } = computeSupportKpis(bundle)
  return {
    range: bundle.range,
    agentName: bundle.agentId ? (bundle.agentNames[bundle.agentId] ?? bundle.agentId) : null,
    kpis: {
      avgResponse: bundle.responseTime ? formatSeconds(bundle.responseTime.avg_response_time_seconds) : '—',
      avgResolution: bundle.resolutionTime ? formatSeconds(bundle.resolutionTime.avg_resolution_time_seconds) : '—',
      ticketsResolved,
      oneTouchRate: `${oneTouchRatePct.toFixed(0)}%`,
    },
    ticketVolume: bundle.ticketVolume.map((p) => ({
      date: p.date,
      opened: p.opened_count,
      resolved: p.resolved_count,
    })),
    agents: bundle.agentProductivity.map((r) => ({
      name: bundle.agentNames[r.agent_id] ?? r.agent_id,
      messagesSent: r.messages_sent,
      ticketsResolved: r.tickets_resolved,
      oneTouchRate: `${Number(r.one_touch_rate).toFixed(0)}%`,
      avgMessages: Number(r.avg_messages_per_ticket).toFixed(1),
    })),
    refundReasons: bundle.refundReasons.map((r) => ({
      reason: r.reason,
      count: r.count,
      percentage: `${Number(r.percentage).toFixed(1)}%`,
    })),
  }
}

// ─── Document ─────────────────────────────────────────────────────────────────

interface SupportReportDocProps {
  data: SupportReportData
  generatedAt: string
}

const SupportReportDocument: React.FC<SupportReportDocProps> = ({ data, generatedAt }) => {
  const subtitle = `${data.range.from} → ${data.range.to}${data.agentName ? ` · ${data.agentName}` : ''}`
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Lynq &amp; Flow</Text>
            <Text style={styles.brandSubtitle}>{subtitle}</Text>
          </View>
          <View style={styles.reportMeta}>
            <Text style={styles.reportLabel}>Report</Text>
            <Text style={styles.reportTitle}>Performance Report</Text>
          </View>
        </View>

        {/* KPI boxes */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Avg Response Time</Text>
            <Text style={styles.kpiValue}>{data.kpis.avgResponse}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Avg Resolution Time</Text>
            <Text style={styles.kpiValue}>{data.kpis.avgResolution}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Tickets Resolved</Text>
            <Text style={styles.kpiValue}>{data.kpis.ticketsResolved.toString()}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>One-Touch Rate</Text>
            <Text style={styles.kpiValue}>{data.kpis.oneTouchRate}</Text>
          </View>
        </View>

        {/* Ticket Volume */}
        <Text style={styles.sectionTitle}>Ticket Volume</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colFlex4]}>Date</Text>
            <Text style={[styles.tableHeaderCell, styles.colFlex1]}>Opened</Text>
            <Text style={[styles.tableHeaderCell, styles.colFlex1]}>Resolved</Text>
          </View>
          {data.ticketVolume.map((row, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.cell, styles.colFlex4]}>{formatDate(row.date)}</Text>
              <Text style={[styles.cellMuted, styles.colFlex1]}>{row.opened}</Text>
              <Text style={[styles.cellMuted, styles.colFlex1]}>{row.resolved}</Text>
            </View>
          ))}
        </View>

        {/* Agent Productivity */}
        <Text style={styles.sectionTitle}>Agent Productivity</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colFlex4]}>Agent</Text>
            <Text style={[styles.tableHeaderCell, styles.colFlex1]}>Messages</Text>
            <Text style={[styles.tableHeaderCell, styles.colFlex1]}>Resolved</Text>
            <Text style={[styles.tableHeaderCell, styles.colFlex15]}>One-Touch</Text>
            <Text style={[styles.tableHeaderCell, styles.colFlex15]}>Avg Msgs</Text>
          </View>
          {data.agents.map((row, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.cell, styles.colFlex4]}>{row.name}</Text>
              <Text style={[styles.cellMuted, styles.colFlex1]}>{row.messagesSent}</Text>
              <Text style={[styles.cellMuted, styles.colFlex1]}>{row.ticketsResolved}</Text>
              <Text style={[styles.cell, styles.colFlex15]}>{row.oneTouchRate}</Text>
              <Text style={[styles.cellMuted, styles.colFlex15]}>{row.avgMessages}</Text>
            </View>
          ))}
        </View>

        {/* Refund Reasons */}
        <Text style={styles.sectionTitle}>Refund Reasons</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colFlex4]}>Reason</Text>
            <Text style={[styles.tableHeaderCell, styles.colFlex1]}>Count</Text>
            <Text style={[styles.tableHeaderCell, styles.colFlex15]}>Percentage</Text>
          </View>
          {data.refundReasons.map((row, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.cell, styles.colFlex4]}>{row.reason}</Text>
              <Text style={[styles.cellMuted, styles.colFlex1]}>{row.count}</Text>
              <Text style={[styles.cell, styles.colFlex15]}>{row.percentage}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerAccent}>Lynq &amp; Flow · Performance Report</Text>
          <Text style={styles.footerText}>{generatedAt}</Text>
        </View>
      </Page>
    </Document>
  )
}

/** Fetch the bundle and render a Performance PDF report to a Buffer. */
export async function renderSupportAnalyticsReportPDF(params: SupportExportParams): Promise<Buffer> {
  const bundle = await fetchSupportAnalytics(params)
  const data = buildSupportReportData(bundle)
  const generatedAt = formatDate(new Date().toISOString())
  return Buffer.from(
    await renderToBuffer(<SupportReportDocument data={data} generatedAt={generatedAt} />)
  )
}
