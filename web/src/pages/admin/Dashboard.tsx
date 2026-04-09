import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts'
import { toast } from 'sonner'
import { formatCurrency, formatDate, formatRelativeTime, prettyAction } from '../../lib/utils'
import type { DashboardStats, Payment, ActivityLog, ChartDataPoint, User } from '../../lib/types'
import api from '../../lib/api'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatMonthLabel(month: string): string {
  const [year, mon] = month.split('-')
  const date = new Date(Number(year), Number(mon) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function actionColor(action: string): string {
  if (action.includes('create') || action.includes('add')) return '#10b981'
  if (action.includes('update') || action.includes('edit') || action.includes('approve')) return '#22d3ee'
  if (action.includes('delete') || action.includes('reject') || action.includes('remove')) return '#ef4444'
  if (action.includes('login') || action.includes('auth')) return '#f59e0b'
  if (action.includes('disconnect') || action.includes('suspend')) return '#ef4444'
  if (action.includes('reconnect')) return '#10b981'
  return '#64748b'
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-white/5 animate-pulse rounded ${className ?? ''}`} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <SkeletonBlock className="h-8 w-48 rounded-lg" />
          <SkeletonBlock className="h-4 w-72 rounded-lg mt-2" />
        </div>
        <SkeletonBlock className="h-12 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="stat-card">
            <SkeletonBlock className="h-9 w-9 rounded-lg mb-3" />
            <SkeletonBlock className="h-8 w-20 mb-2" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="glass-card p-4">
        <SkeletonBlock className="h-14 w-full rounded-lg" />
      </div>
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

// ── Custom Tooltips ──────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(6,10,19,0.97)', border: '1px solid rgba(34,211,238,0.2)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
      <p className="font-semibold text-[#22d3ee] mb-2" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13 }}>{label ? formatMonthLabel(label) : ''}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.dataKey === 'amount' ? '#22d3ee' : '#a855f7', fontFamily: "'Outfit',sans-serif" }}>
          {p.dataKey === 'amount' ? 'Collected' : 'Expected'}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(6,10,19,0.97)', border: '1px solid rgba(34,211,238,0.2)' }}>
      <p className="font-semibold text-[#f1f5f9]" style={{ fontFamily: "'Rajdhani',sans-serif" }}>{payload[0].name}</p>
      <p className="text-[#22d3ee]">{payload[0].value} subscribers</p>
    </div>
  )
}

// ── Badges ───────────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    gcash: { bg: 'rgba(0,112,255,0.12)', color: '#60a5fa' },
    maya:  { bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
    cash:  { bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
    bank:  { bg: 'rgba(168,85,247,0.12)', color: '#c084fc' },
  }
  const { bg, color } = cfg[method] ?? { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' }
  return <span className="badge" style={{ background: bg, color }}>{method}</span>
}

type PayStatus = 'pending' | 'approved' | 'rejected'
function PayStatusBadge({ status }: { status: PayStatus }) {
  const cls: Record<PayStatus, string> = { pending: 'badge badge-pending', approved: 'badge badge-approved', rejected: 'badge badge-rejected' }
  return <span className={cls[status] ?? 'badge'}>{status}</span>
}

// ── Collection Rate Bar ───────────────────────────────────────────────────────

function CollectionBar({ monthly, expected }: { monthly: number; expected: number }) {
  const rate = expected > 0 ? Math.min(100, Math.round((monthly / expected) * 100)) : 0
  const color = rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div
      className="glass-card p-4"
      style={{ border: '1px solid rgba(34,211,238,0.06)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#22d3ee]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
          </svg>
          <span className="font-semibold text-sm text-[#f1f5f9]" style={{ fontFamily: "'Rajdhani',sans-serif" }}>
            Collection Rate — {rate}%
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ fontFamily: "'Outfit',sans-serif" }}>
          <span style={{ color: '#22d3ee' }}>Collected: <strong>{formatCurrency(monthly)}</strong></span>
          <span style={{ color: '#64748b' }}>Expected: <strong>{formatCurrency(expected)}</strong></span>
        </div>
      </div>
      <div className="w-full h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${rate}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }}
        />
      </div>
      {rate < 100 && expected > 0 && (
        <p className="text-[11px] mt-1.5" style={{ color: '#64748b', fontFamily: "'Outfit',sans-serif" }}>
          {formatCurrency(expected - monthly)} outstanding this month
        </p>
      )}
    </div>
  )
}

// ── Quick Actions ─────────────────────────────────────────────────────────────

function QuickActions({ pendingCount, overdueCount, onRefresh, refreshing }: {
  pendingCount: number
  overdueCount: number
  onRefresh: () => void
  refreshing: boolean
}) {
  const [sending, setSending] = useState<string | null>(null)
  const navigate = useNavigate()

  const sendReminders = async () => {
    setSending('reminders')
    try {
      const res = await api.post<{ sent?: number; failed?: number; count?: number }>('/notifications/send-reminders')
      const sent = res.data?.sent ?? res.data?.count ?? 0
      toast.success(`${sent} reminder${sent !== 1 ? 's' : ''} sent`)
    } catch {
      toast.error('Failed to send reminders')
    } finally {
      setSending(null)
    }
  }

  return (
    <div
      className="glass-card p-4"
      style={{ border: '1px solid rgba(34,211,238,0.06)' }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-xs uppercase tracking-widest text-[#475569] mr-2" style={{ fontFamily: "'Rajdhani',sans-serif" }}>
          Quick Actions
        </span>

        {pendingCount > 0 && (
          <button
            onClick={() => navigate('/admin/payments?status=pending')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.2)', fontFamily: "'Rajdhani',sans-serif" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            Review {pendingCount} Pending Payment{pendingCount !== 1 ? 's' : ''}
          </button>
        )}

        {overdueCount > 0 && (
          <button
            onClick={() => navigate('/admin/subscriptions?status=overdue')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)', fontFamily: "'Rajdhani',sans-serif" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
            {overdueCount} Overdue Account{overdueCount !== 1 ? 's' : ''}
          </button>
        )}

        <button
          onClick={sendReminders}
          disabled={sending === 'reminders'}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
          style={{ background: 'rgba(34,211,238,0.08)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.15)', fontFamily: "'Rajdhani',sans-serif" }}
        >
          {sending === 'reminders' ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
          )}
          Send Reminders
        </button>

        <button
          onClick={() => navigate('/admin/messages')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: 'rgba(168,85,247,0.08)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.15)', fontFamily: "'Rajdhani',sans-serif" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg>
          Broadcast Message
        </button>

        <button
          onClick={() => navigate('/admin/customers')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.15)', fontFamily: "'Rajdhani',sans-serif" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Add Customer
        </button>

        <div className="ml-auto">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.06)', fontFamily: "'Outfit',sans-serif" }}
            title="Refresh dashboard"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [nextRefresh, setNextRefresh] = useState(300) // 5 min countdown
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clock tick every minute
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [statsRes, paymentsRes, chartRes, logsRes, usersRes] = await Promise.all([
        api.get<DashboardStats>('/dashboard/stats'),
        api.get<{ data: Payment[]; total: number }>('/payments?page=1&limit=8&status=pending').catch(() => ({ data: { data: [], total: 0 } })),
        api.get<Array<{ month: string; label?: string; income?: number; amount?: number }>>('/dashboard/chart').catch(() => ({ data: [] })),
        api.get<{ data: ActivityLog[]; total: number }>('/dashboard/logs?page=1&limit=8').catch(() => ({ data: { data: [], total: 0 } })),
        api.get<{ data: User[]; total: number }>('/users?limit=200').catch(() => ({ data: { data: [], total: 0 } })),
      ])

      setStats(statsRes.data)

      // Sort payments: pending first, then by date descending
      const allPay = paymentsRes.data.data ?? []
      setPayments(allPay)

      // Normalize chart data
      const raw = chartRes.data ?? []
      const normalized: ChartDataPoint[] = raw
        .slice(-8)
        .map(d => ({
          month: d.month,
          amount: d.amount ?? d.income ?? 0,
          label: d.label ?? formatMonthLabel(d.month),
        }))
      setChartData(normalized)

      // Build user name map
      const map = new Map<string, string>()
      const users = usersRes.data.data ?? []
      users.forEach((u: User) => map.set(u.id, u.full_name || u.phone))
      setUserMap(map)

      // Activity logs with resolved user names
      const rawLogs = (logsRes.data.data ?? []) as ActivityLog[]
      const sorted = [...rawLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setLogs(sorted.slice(0, 8))
    } catch {
      const msg = 'Failed to load dashboard data'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    setNextRefresh(300)
    timerRef.current = setInterval(() => { fetchData(true); setNextRefresh(300) }, 300000)
    countdownRef.current = setInterval(() => setNextRefresh(n => Math.max(0, n - 1)), 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [fetchData])

  const handleRefresh = useCallback(() => {
    fetchData(true)
    setNextRefresh(300)
  }, [fetchData])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <svg className="w-14 h-14 text-[#334155]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
        <p className="font-heading text-lg font-semibold text-[#f87171]">{error}</p>
        <button className="btn-primary" onClick={() => fetchData()}>Retry</button>
      </div>
    )
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const formattedDate = currentTime.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const formattedTime = currentTime.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })

  const activeCount = stats?.active ?? 0
  const overdueCount = stats?.overdue ?? 0
  const suspendedCount = stats?.suspended ?? 0
  const totalSubs = activeCount + overdueCount + suspendedCount

  const pieData = [
    { name: 'Active',    value: activeCount,    color: '#10b981' },
    { name: 'Overdue',   value: overdueCount,   color: '#f59e0b' },
    { name: 'Suspended', value: suspendedCount, color: '#ef4444' },
  ].filter(d => d.value > 0)

  const subBarData = [
    { name: 'Active',    value: activeCount,    color: '#10b981' },
    { name: 'Overdue',   value: overdueCount,   color: '#f59e0b' },
    { name: 'Suspended', value: suspendedCount, color: '#ef4444' },
  ]

  const cards = [
    {
      label: 'Customers',
      value: stats?.total_customers ?? 0,
      color: '#22d3ee',
      sub: 'Registered accounts',
      onClick: () => navigate('/admin/customers'),
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>,
    },
    {
      label: 'Active',
      value: activeCount,
      color: '#10b981',
      sub: totalSubs > 0 ? `${Math.round((activeCount / totalSubs) * 100)}% of subs` : 'No subscriptions',
      onClick: () => navigate('/admin/subscriptions?status=active'),
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
    },
    {
      label: 'Overdue',
      value: overdueCount,
      color: '#f59e0b',
      sub: overdueCount > 0 ? 'Needs collection' : 'All clear',
      onClick: () => navigate('/admin/subscriptions?status=overdue'),
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>,
    },
    {
      label: 'Suspended',
      value: suspendedCount,
      color: '#ef4444',
      sub: 'Disconnected',
      onClick: () => navigate('/admin/subscriptions?status=suspended'),
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
    },
    {
      label: 'Monthly Income',
      value: formatCurrency(stats?.monthly_income ?? 0),
      color: '#a855f7',
      sub: 'Collected this month',
      onClick: () => navigate('/admin/reports'),
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" /></svg>,
    },
    {
      label: 'Pending Pay',
      value: stats?.pending_payments ?? 0,
      color: '#f97316',
      sub: 'Awaiting approval',
      onClick: () => navigate('/admin/payments?status=pending'),
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
    },
  ]

  const yTickFormatter = (v: number) => {
    if (v >= 1000000) return `₱${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `₱${(v / 1000).toFixed(0)}k`
    return `₱${v}`
  }

  const countdownMin = Math.floor(nextRefresh / 60)
  const countdownSec = nextRefresh % 60

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="page-subtitle">Welcome back. Here's your ISP at a glance.</p>
        </div>
        <div className="text-right">
          <p className="font-heading text-base font-bold text-text-primary tracking-wider">{formattedTime}</p>
          <p className="font-body text-xs text-[#64748b]">{formattedDate}</p>
          <p className="font-body text-[10px] text-[#334155] mt-0.5">
            Auto-refresh in {countdownMin}:{String(countdownSec).padStart(2, '0')}
          </p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="stat-card cursor-pointer group"
            style={{ borderLeft: `3px solid ${card.color}` }}
            onClick={card.onClick}
            role="button"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 transition-all group-hover:scale-110" style={{ background: `${card.color}18`, color: card.color }}>
              {card.icon}
            </div>
            <p className="font-heading text-3xl font-bold text-text-primary tracking-tight leading-none">
              {card.value}
            </p>
            <p className="font-heading text-[11px] font-semibold uppercase tracking-widest text-[#64748b] mt-1">
              {card.label}
            </p>
            <p className="font-body text-[11px] mt-2 truncate" style={{ color: card.color }}>
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ── Collection Rate ── */}
      <CollectionBar monthly={stats?.monthly_income ?? 0} expected={stats?.expected_income ?? 0} />

      {/* ── Quick Actions ── */}
      <QuickActions
        pendingCount={stats?.pending_payments ?? 0}
        overdueCount={overdueCount}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* ── Charts Row ── */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Revenue Trend */}
        <div className="glass-card p-6" style={{ flex: '3 1 0%', minHeight: '300px' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-heading text-lg font-bold text-text-primary">Revenue Trend</h2>
              <p className="font-body text-xs text-[#64748b] mt-0.5">
                {chartData.length > 0 ? `Last ${chartData.length} months of collected payments` : 'Monthly collected payments'}
              </p>
            </div>
            <Link to="/admin/reports" className="font-heading text-xs font-semibold uppercase tracking-widest text-secondary hover:text-[#67e8f9] transition-colors">
              Full Report →
            </Link>
          </div>
          {chartData.length === 0 ? (
            <div style={{ height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#475569', border: '1px dashed rgba(34,211,238,0.12)', borderRadius: '12px' }}>
              <svg style={{ width: '36px', height: '36px', opacity: 0.35 }} fill="none" viewBox="0 0 24 24" stroke="#22d3ee" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
              <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: '13px', textAlign: 'center', lineHeight: 1.6 }}>Chart appears once payments<br/>are approved</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,211,238,0.05)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={formatMonthLabel} tick={{ fill: '#64748b', fontSize: 11, fontFamily: "'Rajdhani',sans-serif" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={yTickFormatter} tick={{ fill: '#64748b', fontSize: 11, fontFamily: "'Rajdhani',sans-serif" }} axisLine={false} tickLine={false} width={56} />
                <Tooltip content={<RevenueTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="#22d3ee" strokeWidth={2.5} fill="url(#cyanGrad)" dot={{ fill: '#22d3ee', r: 4, strokeWidth: 0 }} activeDot={{ fill: '#22d3ee', r: 6, strokeWidth: 2, stroke: 'rgba(34,211,238,0.3)' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Right column: Pie + Bar */}
        <div className="flex flex-col gap-6" style={{ flex: '2 1 0%' }}>

          {/* Subscription Donut */}
          <div className="glass-card p-6" style={{ flex: '1 1 0%' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-base font-bold text-text-primary">Subscription Status</h2>
              <Link to="/admin/subscriptions" className="font-heading text-xs font-semibold uppercase tracking-widest text-secondary hover:text-[#67e8f9] transition-colors">View →</Link>
            </div>
            {pieData.length === 0 ? (
              <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', border: '1px dashed rgba(34,211,238,0.12)', borderRadius: '8px' }}>
                <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: '13px' }}>No subscription data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={64} innerRadius={44} strokeWidth={0}>
                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend iconType="circle" iconSize={7} formatter={(v) => <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: '#94a3b8' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Sub counts bar */}
          {totalSubs > 0 && (
            <div className="glass-card p-5">
              <h2 className="font-heading text-sm font-bold text-text-primary mb-4">Breakdown</h2>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={subBarData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontFamily: "'Rajdhani',sans-serif" }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip formatter={(v: number) => [v, 'subscribers']} contentStyle={{ background: 'rgba(6,10,19,0.97)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 8, fontSize: 12, fontFamily: "'Outfit',sans-serif" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {subBarData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-base font-bold text-text-primary">Recent Activity</h2>
            <Link to="/admin/activity-logs" className="font-heading text-xs font-semibold uppercase tracking-widest text-secondary hover:text-[#67e8f9] transition-colors">View All →</Link>
          </div>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <svg className="w-10 h-10 text-[#334155] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              <p className="font-body text-sm text-[#64748b]">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {logs.map((log) => {
                const userName = userMap.get(log.user_id) || log.user_name
                return (
                  <div key={log.id} className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <div className="mt-[7px] shrink-0">
                      <div className="w-2 h-2 rounded-full" style={{ background: actionColor(log.action) }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-[#cbd5e1] truncate">
                        <span className="font-semibold text-text-primary">{prettyAction(log.action)}</span>
                        {log.target_type && <span className="text-[#64748b]"> · {log.target_type}</span>}
                      </p>
                      {userName && <p className="font-body text-[11px] text-[#22d3ee] truncate">{userName}</p>}
                      <p className="font-body text-[11px] text-[#475569] mt-0.5">{formatRelativeTime(log.created_at)}</p>
                    </div>
                    <div
                      className="shrink-0 w-1.5 h-full min-h-[8px] rounded-full self-center"
                      style={{ background: `${actionColor(log.action)}30` }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pending Payments */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(34,211,238,0.06)' }}>
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-base font-bold text-text-primary">Pending Payments</h2>
              {(stats?.pending_payments ?? 0) > 0 && (
                <span className="badge badge-pending">{stats?.pending_payments}</span>
              )}
            </div>
            <Link to="/admin/payments" className="font-heading text-xs font-semibold uppercase tracking-widest text-secondary hover:text-[#67e8f9] transition-colors">View All →</Link>
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
                    <td colSpan={5} className="!text-center !py-14">
                      <div className="flex flex-col items-center gap-3">
                        <svg className="w-10 h-10 text-[#334155]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                        <p className="font-body text-sm text-[#64748b]">No pending payments</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer hover:bg-[rgba(34,211,238,0.02)]"
                      onClick={() => navigate('/admin/payments')}
                    >
                      <td className="!font-semibold !text-[#f1f5f9]">{p.user_name ?? '—'}</td>
                      <td>
                        <span className="font-heading text-[15px] font-bold text-text-primary">{formatCurrency(p.amount)}</span>
                      </td>
                      <td><MethodBadge method={p.method} /></td>
                      <td><PayStatusBadge status={p.status} /></td>
                      <td className="text-[#64748b] text-[13px]">{formatDate(p.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {payments.length > 0 && (
            <div className="px-6 py-3" style={{ borderTop: '1px solid rgba(34,211,238,0.04)' }}>
              <button
                onClick={() => navigate('/admin/payments?status=pending')}
                className="btn-primary w-full !py-2 !text-sm"
              >
                Review & Approve Payments
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
