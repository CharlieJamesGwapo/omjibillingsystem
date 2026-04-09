import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { formatCurrency, exportToCSV } from '../../lib/utils'
import type { MonthlyIncome } from '../../lib/types'
import api from '../../lib/api'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatMonthLabel(month: string): string {
  try {
    return format(parseISO(month + '-01'), "MMM ''yy")
  } catch {
    return month
  }
}

function formatMonthFull(month: string): string {
  try {
    return format(parseISO(month + '-01'), 'MMMM yyyy')
  } catch {
    return month
  }
}

function yTickFormatter(v: number): string {
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `₱${(v / 1_000).toFixed(1)}k`
  return `₱${v}`
}

const momChange = (current: number, previous: number | undefined): number | null => {
  if (previous === undefined || previous === 0) return null
  return ((current - previous) / previous) * 100
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-white/5 animate-pulse rounded ${className ?? ''}`} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <SkeletonBlock className="h-8 w-36 rounded-lg" />
          <SkeletonBlock className="h-4 w-56 rounded-lg mt-2" />
        </div>
        <SkeletonBlock className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card">
            <SkeletonBlock className="h-9 w-9 rounded-lg mb-3" />
            <SkeletonBlock className="h-8 w-24 mb-2" />
            <SkeletonBlock className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="glass-card p-6">
        <SkeletonBlock className="h-5 w-48 mb-6" />
        <SkeletonBlock className="h-[280px] w-full rounded-lg" />
      </div>
      <div className="glass-card p-6">
        <SkeletonBlock className="h-5 w-48 mb-6" />
        <SkeletonBlock className="h-[200px] w-full rounded-lg" />
      </div>
    </div>
  )
}

// ── Custom Tooltip ────────────────────────────────────────────────────────

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs font-heading"
      style={{
        background: 'rgba(10,17,32,0.95)',
        border: '1px solid rgba(34,211,238,0.2)',
        color: '#f1f5f9',
      }}
    >
      <p className="font-semibold text-[#22d3ee]">{label ? formatMonthLabel(label) : ''}</p>
      <p className="mt-0.5">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────

export default function Reports() {
  const [income, setIncome] = useState<MonthlyIncome[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredBar, setHoveredBar] = useState<string | null>(null)

  // Date range filter state (year-month strings)
  const [fromMonth, setFromMonth] = useState<string>('')
  const [toMonth, setToMonth] = useState<string>('')

  useEffect(() => {
    async function fetchIncome() {
      try {
        const res = await api.get<MonthlyIncome[]>('/dashboard/income')
        const data = (res.data ?? []).slice().sort((a, b) => a.month.localeCompare(b.month))
        setIncome(data)

        // Default: last 12 months (or all if less than 12)
        if (data.length > 0) {
          const last = data[data.length - 1].month
          const startIdx = Math.max(0, data.length - 12)
          const first = data[startIdx].month
          setFromMonth(first)
          setToMonth(last)
        }
      } catch {
        toast.error('Failed to load income data')
      } finally {
        setLoading(false)
      }
    }
    fetchIncome()
  }, [])

  // All available months for dropdowns
  const allMonths = useMemo(() => income.map(d => d.month), [income])

  // Filtered data
  const filteredData = useMemo(() => {
    if (!fromMonth || !toMonth) return income
    return income.filter(d => d.month >= fromMonth && d.month <= toMonth)
  }, [income, fromMonth, toMonth])

  // Summary stats
  const totalRevenue = useMemo(
    () => filteredData.reduce((sum, d) => sum + d.amount, 0),
    [filteredData]
  )
  const monthlyAverage = filteredData.length > 0 ? totalRevenue / filteredData.length : 0
  const bestMonth = useMemo(
    () => filteredData.reduce<MonthlyIncome | null>((best, d) => (!best || d.amount > best.amount ? d : best), null),
    [filteredData]
  )
  const latestMonth = filteredData.length > 0 ? filteredData[filteredData.length - 1] : null

  // Table rows: sorted descending, with MoM change and share
  const tableRows = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => b.month.localeCompare(a.month))
    return sorted.map((row, idx) => {
      // Previous month in the sorted-ascending sense → the item just before in filteredData
      const originalIdx = filteredData.findIndex(d => d.month === row.month)
      const prev = originalIdx > 0 ? filteredData[originalIdx - 1].amount : undefined
      const mom = momChange(row.amount, prev)
      const share = totalRevenue > 0 ? (row.amount / totalRevenue) * 100 : 0
      return { ...row, mom, share, idx }
    })
  }, [filteredData, totalRevenue])

  // CSV export
  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      toast.error('No data to export')
      return
    }
    const rows = tableRows.map(r => ({
      Month: formatMonthFull(r.month),
      Amount: r.amount.toFixed(2),
      'MoM Change (%)': r.mom !== null ? r.mom.toFixed(2) : '',
      'Share of Total (%)': r.share.toFixed(2),
    }))
    exportToCSV(`reports-${fromMonth || 'all'}-to-${toMonth || 'all'}.csv`, rows)
    toast.success('CSV exported')
  }

  if (loading) return <LoadingSkeleton />

  return (
    <div className="space-y-6 animate-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-in animate-in-1">
        <div>
          <h1 className="page-header">Reports</h1>
          <p className="page-subtitle">Financial overview and monthly revenue analysis</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in animate-in-2">

        {/* Total Revenue — purple */}
        <div className="stat-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
            style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
          </div>
          <p className="font-heading text-2xl font-bold tracking-tight" style={{ color: '#a855f7' }}>
            {formatCurrency(totalRevenue)}
          </p>
          <p className="font-heading text-xs font-semibold uppercase tracking-widest text-[#64748b] mt-1">
            Total Revenue
          </p>
        </div>

        {/* Monthly Average — blue */}
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </div>
          <p className="font-heading text-2xl font-bold tracking-tight" style={{ color: '#3b82f6' }}>
            {filteredData.length > 0 ? formatCurrency(monthlyAverage) : '—'}
          </p>
          <p className="font-heading text-xs font-semibold uppercase tracking-widest text-[#64748b] mt-1">
            Monthly Average
          </p>
        </div>

        {/* Best Month — green */}
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            </svg>
          </div>
          <p className="font-heading text-2xl font-bold tracking-tight" style={{ color: '#10b981' }}>
            {bestMonth ? formatCurrency(bestMonth.amount) : '—'}
          </p>
          <p className="font-heading text-xs font-semibold uppercase tracking-widest text-[#64748b] mt-1">
            Best Month{bestMonth ? ` · ${formatMonthLabel(bestMonth.month)}` : ''}
          </p>
        </div>

        {/* Latest Month — cyan */}
        <div className="stat-card" style={{ borderLeft: '4px solid #22d3ee' }}>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
            style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </div>
          <p className="font-heading text-2xl font-bold tracking-tight" style={{ color: '#22d3ee' }}>
            {latestMonth ? formatCurrency(latestMonth.amount) : '—'}
          </p>
          <p className="font-heading text-xs font-semibold uppercase tracking-widest text-[#64748b] mt-1">
            Latest Month{latestMonth ? ` · ${formatMonthLabel(latestMonth.month)}` : ''}
          </p>
        </div>

      </div>

      {/* Date Range Filter */}
      {allMonths.length > 0 && (
        <div className="glass-card px-5 py-4 flex flex-wrap items-center gap-4 animate-in animate-in-3">
          <span className="font-heading text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Date Range
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="font-body text-xs text-[#64748b]">From</label>
              <select
                value={fromMonth}
                onChange={e => setFromMonth(e.target.value)}
                className="bg-[#0d1526] border border-white/10 text-text-primary text-sm rounded-lg px-3 py-1.5 font-heading focus:outline-none focus:border-[#22d3ee]/50"
              >
                {allMonths.map(m => (
                  <option key={m} value={m}>{formatMonthFull(m)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-body text-xs text-[#64748b]">To</label>
              <select
                value={toMonth}
                onChange={e => setToMonth(e.target.value)}
                className="bg-[#0d1526] border border-white/10 text-text-primary text-sm rounded-lg px-3 py-1.5 font-heading focus:outline-none focus:border-[#22d3ee]/50"
              >
                {allMonths.map(m => (
                  <option key={m} value={m}>{formatMonthFull(m)}</option>
                ))}
              </select>
            </div>
            <span className="font-body text-xs text-[#64748b]">
              {filteredData.length} month{filteredData.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Area Chart — Monthly Revenue Trend */}
      <div className="glass-card p-6 bg-[#0d1526] animate-in animate-in-3">
        <div className="mb-5">
          <h2 className="font-heading text-lg font-bold text-text-primary">Monthly Revenue Trend</h2>
          <p className="font-body text-xs text-[#64748b] mt-0.5">Area chart of revenue over time</p>
        </div>
        {filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-[#64748b] font-body text-sm">
            No data for selected range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={filteredData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="reportsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,211,238,0.06)" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonthLabel}
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Rajdhani, sans-serif' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={yTickFormatter}
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Rajdhani, sans-serif' }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#22d3ee"
                strokeWidth={2}
                fill="url(#reportsGradient)"
                dot={{ fill: '#22d3ee', r: 3, strokeWidth: 0 }}
                activeDot={{ fill: '#22d3ee', r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bar Chart — Monthly Comparison */}
      <div className="glass-card p-6 bg-[#0d1526] animate-in animate-in-4">
        <div className="mb-5">
          <h2 className="font-heading text-lg font-bold text-text-primary">Monthly Comparison</h2>
          <p className="font-body text-xs text-[#64748b] mt-0.5">Side-by-side bar view</p>
        </div>
        {filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-[#64748b] font-body text-sm">
            No data for selected range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={filteredData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,211,238,0.06)" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonthLabel}
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Rajdhani, sans-serif' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={yTickFormatter}
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Rajdhani, sans-serif' }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {filteredData.map((entry) => (
                  <Cell
                    key={entry.month}
                    fill={hoveredBar === entry.month ? '#67e8f9' : '#22d3ee'}
                    onMouseEnter={() => setHoveredBar(entry.month)}
                    onMouseLeave={() => setHoveredBar(null)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Data Table */}
      <div className="glass-card overflow-hidden animate-in animate-in-5">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="font-heading text-lg font-bold text-text-primary">Monthly Breakdown</h2>
          <p className="page-subtitle !mt-1">Sorted by month — newest first</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">Amount</th>
                <th className="text-right">MoM Change</th>
                <th className="text-right">Share of Total</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="!text-center !py-16">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-text-secondary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                      </svg>
                      <p className="text-text-secondary text-sm">No data for selected range</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tableRows.map((row, i) => (
                  <tr
                    key={row.month}
                    style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}
                  >
                    <td className="!font-medium !text-text-primary">{formatMonthFull(row.month)}</td>
                    <td className="text-right">
                      <span className="font-heading font-bold text-text-primary tabular-nums">
                        {formatCurrency(row.amount)}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">
                      {row.mom === null ? (
                        <span className="text-[#64748b] text-xs">—</span>
                      ) : (
                        <span
                          className="font-heading font-semibold text-sm flex items-center justify-end gap-1"
                          style={{ color: row.mom >= 0 ? '#10b981' : '#ef4444' }}
                        >
                          {row.mom >= 0 ? '↑' : '↓'}
                          {Math.abs(row.mom).toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-[#94a3b8]">
                      {row.share.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
