import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { toast } from 'sonner'
import { formatCurrency, formatDate, formatRelativeTime, prettyAction } from '../../lib/utils'
import type { DashboardStats, Payment, ActivityLog, ChartDataPoint } from '../../lib/types'
import api from '../../lib/api'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatMonthLabel(month: string): string {
  // "2026-01" → "Jan 26"
  const [year, mon] = month.split('-')
  const date = new Date(Number(year), Number(mon) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function actionColor(action: string): string {
  if (action.includes('create') || action.includes('add')) return '#10b981'
  if (action.includes('update') || action.includes('edit') || action.includes('approve')) return '#22d3ee'
  if (action.includes('delete') || action.includes('reject') || action.includes('remove')) return '#ef4444'
  if (action.includes('login') || action.includes('auth')) return '#f59e0b'
  return '#64748b'
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-white/5 animate-pulse rounded ${className ?? ''}`} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="animate-in">
        <SkeletonBlock className="h-8 w-48 rounded-lg" />
        <SkeletonBlock className="h-4 w-72 rounded-lg mt-2" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="stat-card">
            <SkeletonBlock className="h-9 w-9 rounded-lg mb-3" />
            <SkeletonBlock className="h-8 w-20 mb-2" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Charts row */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="glass-card p-6" style={{ flex: '3 1 0%' }}>
          <SkeletonBlock className="h-5 w-40 mb-6" />
          <SkeletonBlock className="h-56 w-full rounded-lg" />
        </div>
        <div className="glass-card p-6" style={{ flex: '2 1 0%' }}>
          <SkeletonBlock className="h-5 w-40 mb-6" />
          <SkeletonBlock className="h-56 w-full rounded-lg" />
        </div>
      </div>
      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="glass-card p-6">
            <SkeletonBlock className="h-5 w-40 mb-6" />
            {[...Array(5)].map((_, j) => (
              <SkeletonBlock key={j} className="h-10 w-full mb-2 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Custom Tooltip for AreaChart ─────────────────────────────────────────────

interface RevenueTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function RevenueTooltip({ active, payload, label }: RevenueTooltipProps) {
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
      <p className="font-semibold text-[#22d3ee]">{label}</p>
      <p className="mt-0.5">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

// ── Custom Tooltip for PieChart ──────────────────────────────────────────────

interface PieTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
}

function PieTooltip({ active, payload }: PieTooltipProps) {
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
      <p className="font-semibold">{payload[0].name}</p>
      <p className="mt-0.5 text-[#22d3ee]">{payload[0].value}</p>
    </div>
  )
}

// ── Method / Status Badges ───────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    gcash: { bg: 'rgba(0,112,255,0.12)', color: '#60a5fa' },
    maya:  { bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
    cash:  { bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
    bank:  { bg: 'rgba(168,85,247,0.12)', color: '#c084fc' },
  }
  const { bg, color } = cfg[method] ?? { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' }
  return (
    <span className="badge" style={{ background: bg, color }}>
      {method}
    </span>
  )
}

type PaymentStatus = 'pending' | 'approved' | 'rejected'

function StatusBadge({ status }: { status: PaymentStatus }) {
  const cls: Record<PaymentStatus, string> = {
    pending:  'badge badge-pending',
    approved: 'badge badge-approved',
    rejected: 'badge badge-rejected',
  }
  return <span className={cls[status] ?? 'badge'}>{status}</span>
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsRes, paymentsRes, chartRes, logsRes] = await Promise.all([
        api.get<DashboardStats>('/dashboard/stats'),
        api.get<{ data: Payment[]; total: number }>('/payments?page=1&limit=5').catch(() => ({ data: { data: [], total: 0 } })),
        api.get<ChartDataPoint[]>('/dashboard/chart').catch(() => ({ data: [] as ChartDataPoint[] })),
        api.get<{ data: ActivityLog[]; total: number }>('/dashboard/logs?page=1&limit=10').catch(() => ({ data: { data: [], total: 0 } })),
      ])
      setStats(statsRes.data)
      setPayments(paymentsRes.data.data ?? [])

      // Normalize chart data — API may return { month, amount } or existing shape
      const raw = (chartRes.data ?? []) as Array<{ month: string; amount?: number; income?: number; label?: string }>
      const normalized: ChartDataPoint[] = raw.slice(-6).map(d => ({
        month: d.month,
        amount: d.amount ?? (d as { income?: number }).income ?? 0,
        label: d.label ?? formatMonthLabel(d.month),
      }))
      setChartData(normalized)

      const sorted = ([...(logsRes.data.data ?? [])] as ActivityLog[]).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      setLogs(sorted.slice(0, 8))
    } catch {
      const msg = 'Failed to load dashboard data'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="font-heading text-lg font-semibold text-[#f87171]">{error}</p>
        <button className="btn-primary" onClick={fetchData}>Retry</button>
      </div>
    )
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const formattedDate = currentTime.toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const formattedTime = currentTime.toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit',
  })

  const activeCount = stats?.active ?? 0
  const overdueCount = stats?.overdue ?? 0
  const suspendedCount = stats?.suspended ?? 0

  const pieData = [
    { name: 'Active',    value: activeCount,    color: '#10b981' },
    { name: 'Overdue',   value: overdueCount,   color: '#f59e0b' },
    { name: 'Suspended', value: suspendedCount, color: '#ef4444' },
  ].filter(d => d.value > 0)

  // ── Stat cards config ─────────────────────────────────────────────────────

  const cards = [
    {
      label: 'Total Customers',
      value: stats?.total_customers ?? 0,
      color: '#22d3ee',
      sub: 'All registered',
      onClick: undefined,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      ),
    },
    {
      label: 'Active',
      value: activeCount,
      color: '#10b981',
      sub: 'Connected subs',
      onClick: undefined,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: 'Overdue',
      value: overdueCount,
      color: '#f59e0b',
      sub: 'Needs attention',
      onClick: undefined,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ),
    },
    {
      label: 'Suspended',
      value: suspendedCount,
      color: '#ef4444',
      sub: 'Disconnected',
      onClick: undefined,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    },
    {
      label: 'Monthly Income',
      value: formatCurrency(stats?.monthly_income ?? 0),
      color: '#a855f7',
      sub: 'Current period',
      onClick: undefined,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
        </svg>
      ),
    },
    {
      label: 'Pending Payments',
      value: stats?.pending_payments ?? 0,
      color: '#f97316',
      sub: 'Awaiting approval',
      onClick: () => navigate('/admin/payments?status=pending'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
  ]

  // ── Revenue chart tick formatter ──────────────────────────────────────────

  const yTickFormatter = (v: number) => {
    if (v >= 1000) return `₱${(v / 1000).toFixed(0)}k`
    return `₱${v}`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="page-subtitle">Welcome back. Here's what's happening today.</p>
        </div>
        <div className="text-right">
          <p className="font-heading text-sm font-semibold text-text-primary tracking-wide">{formattedTime}</p>
          <p className="font-body text-xs text-[#64748b]">{formattedDate}</p>
        </div>
      </div>

      {/* ── Stat Cards Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`stat-card${card.onClick ? ' cursor-pointer' : ''}`}
            style={{ borderLeft: `4px solid ${card.color}` }}
            onClick={card.onClick}
            role={card.onClick ? 'button' : undefined}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: `${card.color}20`, color: card.color }}
            >
              {card.icon}
            </div>
            <p className="font-heading text-3xl font-bold text-text-primary tracking-tight leading-none">
              {card.value}
            </p>
            <p className="font-heading text-xs font-semibold uppercase tracking-widest text-[#64748b] mt-1">
              {card.label}
            </p>
            <p className="font-body text-[11px] mt-2" style={{ color: card.color }}>
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Revenue Trend (60%) */}
        <div className="glass-card p-6 bg-[#0d1526]" style={{ flex: '3 1 0%', minHeight: '280px' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-heading text-lg font-bold text-text-primary">Revenue Trend</h2>
              <p className="font-body text-xs text-[#64748b] mt-0.5">Last {chartData.length} months</p>
            </div>
          </div>
          {chartData.length === 0 ? (
            <div style={{ height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#475569', border: '1px dashed rgba(34,211,238,0.15)', borderRadius: '8px' }}>
              <svg style={{ width: '40px', height: '40px', opacity: 0.4 }} fill="none" viewBox="0 0 24 24" stroke="#22d3ee" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', textAlign: 'center' }}>Revenue chart will appear once<br/>payments are approved</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
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
                  width={52}
                />
                <Tooltip content={<RevenueTooltip />} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  fill="url(#cyanGradient)"
                  dot={{ fill: '#22d3ee', r: 3, strokeWidth: 0 }}
                  activeDot={{ fill: '#22d3ee', r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Subscription Status (40%) */}
        <div className="glass-card p-6 bg-[#0d1526]" style={{ flex: '2 1 0%' }}>
          <h2 className="font-heading text-lg font-bold text-text-primary mb-5">Subscription Status</h2>
          {pieData.length === 0 ? (
            <div style={{ height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#475569', border: '1px dashed rgba(34,211,238,0.15)', borderRadius: '8px' }}>
              <svg style={{ width: '40px', height: '40px', opacity: 0.4 }} fill="none" viewBox="0 0 24 24" stroke="#22d3ee" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
              </svg>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px' }}>No subscription data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={80}
                  innerRadius={60}
                  strokeWidth={0}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 12, color: '#94a3b8' }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading text-lg font-bold text-text-primary">Recent Activity</h2>
            <Link
              to="/admin/activity-logs"
              className="font-heading text-xs font-semibold uppercase tracking-widest text-secondary hover:text-[#67e8f9] transition-colors"
            >
              View All
            </Link>
          </div>

          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="w-10 h-10 text-[#334155] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="font-body text-sm text-[#64748b]">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                >
                  <div className="mt-2 flex-shrink-0">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: actionColor(log.action) }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-[#cbd5e1] truncate">
                      <span className="font-semibold text-text-primary">
                        {prettyAction(log.action)}
                      </span>
                      {log.target_type && (
                        <span className="text-[#64748b]"> · {log.target_type}</span>
                      )}
                    </p>
                    {log.user_name && (
                      <p className="font-body text-[11px] text-[#22d3ee] truncate">{log.user_name}</p>
                    )}
                    <p className="font-body text-[11px] text-[#475569] mt-0.5">
                      {formatRelativeTime(log.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="glass-card overflow-hidden">
          <div
            className="flex items-center justify-between px-6 py-5"
            style={{ borderBottom: '1px solid rgba(34,211,238,0.06)' }}
          >
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-lg font-bold text-text-primary">Recent Payments</h2>
              <span className="badge badge-admin">{payments.length}</span>
            </div>
            <Link
              to="/admin/payments"
              className="font-heading text-xs font-semibold uppercase tracking-widest text-secondary hover:text-[#67e8f9] transition-colors"
            >
              View All
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="!text-center !py-16">
                      <div className="flex flex-col items-center gap-3">
                        <svg className="w-12 h-12 text-[#334155]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                        </svg>
                        <p className="font-body text-sm text-[#64748b]">No payments recorded yet</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id}>
                      <td className="!font-semibold !text-[#f1f5f9]">{p.user_name ?? '—'}</td>
                      <td>
                        <span className="font-heading text-[15px] font-bold text-text-primary">
                          {formatCurrency(p.amount)}
                        </span>
                      </td>
                      <td><MethodBadge method={p.method} /></td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="text-[#64748b] text-[13px]">{formatDate(p.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
