import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import { formatCurrency, formatDate } from '../../lib/utils'
import { toast } from 'sonner'
import type { Payment, PaymentStatus } from '../../lib/types'

const LIMIT = 20

// ─── Lightbox Modal ───────────────────────────────────────────────────────────

interface LightboxModalProps {
  url: string
  onClose: () => void
}

function LightboxModal({ url, onClose }: LightboxModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3
            className="font-semibold uppercase tracking-wider text-sm"
            style={{ fontFamily: "'Rajdhani', sans-serif", color: '#94a3b8' }}
          >
            Proof of Payment
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
          >
            ✕
          </button>
        </div>
        <img
          src={url}
          alt="Proof of Payment"
          className="w-full max-h-[80vh] object-contain rounded-xl"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        />
        <p className="text-center text-xs mt-3" style={{ color: '#475569' }}>
          Press ESC or click outside to close
        </p>
      </div>
    </div>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  action: 'approve' | 'reject'
  payment: Payment
  onConfirm: (notes: string) => void
  onCancel: () => void
  loading: boolean
}

function ConfirmModal({ action, payment, onConfirm, onCancel, loading }: ConfirmModalProps) {
  const [notes, setNotes] = useState('')
  const isApprove = action === 'approve'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(15,26,46,0.98) 0%, rgba(8,15,30,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
          style={{
            background: isApprove ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
          }}
        >
          {isApprove ? (
            <svg className="w-6 h-6" style={{ color: '#34d399' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" style={{ color: '#f87171' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        <h2
          className="font-bold text-lg mb-1"
          style={{ fontFamily: "'Rajdhani', sans-serif", color: '#f1f5f9', letterSpacing: '0.03em' }}
        >
          {isApprove ? 'Approve Payment' : 'Reject Payment'}
        </h2>
        <p className="text-sm mb-4" style={{ color: '#64748b' }}>
          {isApprove
            ? 'This will mark the payment as approved and activate the subscription billing period.'
            : 'This will mark the payment as rejected. The customer will need to resubmit.'}
        </p>

        {/* Payment Summary */}
        <div
          className="rounded-xl p-3 mb-4 space-y-1.5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex justify-between text-sm">
            <span style={{ color: '#64748b' }}>Customer</span>
            <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{payment.user_name ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: '#64748b' }}>Amount</span>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: '#f1f5f9' }}>
              {formatCurrency(payment.amount)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: '#64748b' }}>Method</span>
            <span style={{ color: '#94a3b8' }}>{payment.method.toUpperCase()}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-5">
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748b' }}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isApprove ? 'e.g. Verified via GCash receipt' : 'e.g. Reference number mismatch'}
            rows={3}
            className="form-input w-full resize-none"
            style={{ fontSize: 13 }}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 btn-outline"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(notes)}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 ${isApprove ? 'btn-success' : 'btn-danger'}`}
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {loading ? 'Processing...' : isApprove ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Payments() {
  const [searchParams] = useSearchParams()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const initialStatus = searchParams.get('status') as PaymentStatus | null
  const [filter, setFilter] = useState<'all' | PaymentStatus>(initialStatus ?? 'all')
  const [actionLoading, setActionLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    action: 'approve' | 'reject'
    payment: Payment
  } | null>(null)

  // Tab counts (derived from current page; pending from 'all' fetch is most accurate)
  const [tabCounts, setTabCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 })

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filter !== 'all') params.set('status', filter)

      const res = await api.get<{ data: Payment[]; total: number; page: number; limit: number }>(
        `/payments?${params}`
      )
      const data = res.data.data ?? []
      setPayments(data)
      setTotal(res.data.total ?? 0)

      // Recompute tab counts from current page data (best effort without extra requests)
      setTabCounts((prev) => {
        const pending = data.filter((p) => p.status === 'pending').length
        const approved = data.filter((p) => p.status === 'approved').length
        const rejected = data.filter((p) => p.status === 'rejected').length
        // When viewing a filtered tab, update only that tab's total from the server
        if (filter === 'all') {
          return { all: res.data.total, pending, approved, rejected }
        }
        return {
          ...prev,
          all: prev.all || res.data.total,
          [filter]: res.data.total,
        }
      })
    } catch {
      toast.error('Failed to load payments — please try again')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, filter])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  // Stats computed from current page payments
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const pendingCount = payments.filter((p) => p.status === 'pending').length
  const approvedThisMonth = payments.filter((p) => {
    if (p.status !== 'approved') return false
    const d = new Date(p.updated_at)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })
  const totalAmountThisMonth = approvedThisMonth.reduce((sum, p) => sum + p.amount, 0)

  const handleFilterChange = (value: 'all' | PaymentStatus) => {
    setFilter(value)
    setPage(1)
  }

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  const methodBadge = (method: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      gcash: { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
      maya: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
      bank: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
      cash: { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
    }
    const s = styles[method] || { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' }
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider"
        style={{ background: s.bg, color: s.color, fontFamily: "'Rajdhani', sans-serif" }}
      >
        {method}
      </span>
    )
  }

  const statusBadge = (status: PaymentStatus, notes?: string | null) => {
    const styles: Record<PaymentStatus, { bg: string; color: string; label: string }> = {
      pending: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Pending' },
      approved: { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Approved' },
      rejected: { bg: 'rgba(239,68,68,0.15)', color: '#f87171', label: 'Rejected' },
    }
    const s = styles[status]
    return (
      <div className="flex flex-col gap-0.5">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider w-fit"
          style={{ background: s.bg, color: s.color, fontFamily: "'Rajdhani', sans-serif" }}
        >
          {s.label}
        </span>
        {notes && (
          <span className="text-xs italic" style={{ color: '#475569', maxWidth: 160 }}>
            {notes}
          </span>
        )}
      </div>
    )
  }

  const openConfirm = (action: 'approve' | 'reject', payment: Payment) => {
    setConfirmModal({ action, payment })
  }

  const handleConfirmAction = async (notes: string) => {
    if (!confirmModal) return
    const { action, payment } = confirmModal
    setActionLoading(true)
    try {
      await api.post(`/payments/${payment.id}/${action}`, { notes: notes || undefined })
      toast.success(action === 'approve' ? 'Payment approved!' : 'Payment rejected')
      setConfirmModal(null)
      await fetchPayments()
    } catch {
      toast.error('Failed — please try again')
    } finally {
      setActionLoading(false)
    }
  }

  const filterButtons: { label: string; value: 'all' | PaymentStatus }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ]

  const tabCountMap: Record<string, number> = {
    all: tabCounts.all,
    pending: tabCounts.pending,
    approved: tabCounts.approved,
    rejected: tabCounts.rejected,
  }

  const totalPages = Math.ceil(total / LIMIT)

  // ── Loading Skeleton ─────────────────────────────────────────────────────────

  if (loading && payments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="animate-in">
          <div className="h-8 w-36 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-white/5 animate-pulse mt-2" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in animate-in-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4">
              <div className="h-3 w-20 rounded bg-white/5 animate-pulse mb-3" />
              <div className="h-7 w-28 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="flex gap-2 animate-in animate-in-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 w-28 rounded-full bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="glass-card p-0 animate-in animate-in-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 border-b border-white/[0.03] mx-4 flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-white/5 animate-pulse shrink-0" />
              <div className="h-4 flex-1 rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-20 rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-16 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Main Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="animate-in">
        <h1 className="page-header">Payments</h1>
        <p className="page-subtitle">Review and manage all payment transactions</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in animate-in-1">
        {/* Pending */}
        <div
          className="glass-card p-4 flex items-center gap-3"
          style={{ borderLeft: '3px solid rgba(245,158,11,0.6)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(245,158,11,0.12)' }}
          >
            <svg className="w-5 h-5" style={{ color: '#fbbf24' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold mb-0.5" style={{ color: '#64748b', fontFamily: "'Rajdhani', sans-serif" }}>
              Pending
            </p>
            <p
              className="text-2xl font-bold"
              style={{ fontFamily: "'Rajdhani', sans-serif", color: '#fbbf24' }}
            >
              {pendingCount}
            </p>
          </div>
        </div>

        {/* Approved This Month */}
        <div
          className="glass-card p-4 flex items-center gap-3"
          style={{ borderLeft: '3px solid rgba(16,185,129,0.6)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(16,185,129,0.12)' }}
          >
            <svg className="w-5 h-5" style={{ color: '#34d399' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold mb-0.5" style={{ color: '#64748b', fontFamily: "'Rajdhani', sans-serif" }}>
              Approved This Month
            </p>
            <p
              className="text-2xl font-bold"
              style={{ fontFamily: "'Rajdhani', sans-serif", color: '#34d399' }}
            >
              {approvedThisMonth.length}
            </p>
          </div>
        </div>

        {/* Total Amount This Month */}
        <div
          className="glass-card p-4 flex items-center gap-3"
          style={{ borderLeft: '3px solid rgba(168,85,247,0.6)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(168,85,247,0.12)' }}
          >
            <svg className="w-5 h-5" style={{ color: '#c084fc' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold mb-0.5" style={{ color: '#64748b', fontFamily: "'Rajdhani', sans-serif" }}>
              Revenue This Month
            </p>
            <p
              className="text-xl font-bold"
              style={{ fontFamily: "'Rajdhani', sans-serif", color: '#c084fc' }}
            >
              {formatCurrency(totalAmountThisMonth)}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-md animate-in animate-in-1">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: '#475569' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Search by customer name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input !pl-11"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap animate-in animate-in-1">
        {filterButtons.map((btn) => {
          const count = tabCountMap[btn.value] ?? 0
          const isActive = filter === btn.value
          return (
            <button
              key={btn.value}
              onClick={() => handleFilterChange(btn.value)}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200"
              style={
                isActive
                  ? {
                      background: '#22d3ee',
                      color: '#fff',
                      fontFamily: "'Rajdhani', sans-serif",
                      letterSpacing: '0.05em',
                      fontSize: 13,
                    }
                  : {
                      background: 'rgba(15,26,46,0.6)',
                      border: '1px solid rgba(34,211,238,0.06)',
                      color: '#94a3b8',
                      fontFamily: "'Rajdhani', sans-serif",
                      letterSpacing: '0.05em',
                      fontSize: 13,
                    }
              }
            >
              {btn.label}
              {count > 0 && (
                <span
                  className="text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(34,211,238,0.1)',
                    color: isActive ? '#fff' : '#22d3ee',
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block glass-card animate-in animate-in-2" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference #</th>
                <th>Billing Period</th>
                <th>Proof</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="!text-center !py-16">
                    <div className="flex flex-col items-center gap-3">
                      <svg
                        className="w-12 h-12"
                        style={{ color: '#334155' }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                      </svg>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>
                        No payments found
                      </p>
                      {search && (
                        <button
                          onClick={() => setSearch('')}
                          className="text-xs"
                          style={{ color: '#22d3ee' }}
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    {/* Customer */}
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: 'rgba(34,211,238,0.1)',
                            color: '#22d3ee',
                            fontFamily: "'Rajdhani', sans-serif",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {getInitials(payment.user_name ?? '?')}
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>
                            {payment.user_name ?? '—'}
                          </p>
                          <p className="text-xs" style={{ color: '#64748b' }}>
                            {payment.user_phone ?? ''}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Amount */}
                    <td>
                      <span
                        style={{
                          fontFamily: "'Rajdhani', sans-serif",
                          fontWeight: 700,
                          fontSize: 15,
                          color: '#f1f5f9',
                        }}
                      >
                        {formatCurrency(payment.amount)}
                      </span>
                    </td>

                    {/* Method */}
                    <td>{methodBadge(payment.method)}</td>

                    {/* Reference # */}
                    <td>
                      {payment.reference_number ? (
                        <span
                          className="font-mono text-xs px-2 py-1 rounded"
                          style={{ background: 'rgba(15,23,41,0.8)', color: '#64748b' }}
                        >
                          {payment.reference_number}
                        </span>
                      ) : (
                        <span style={{ color: '#334155' }}>—</span>
                      )}
                    </td>

                    {/* Billing Period */}
                    <td>
                      {payment.billing_period_start && payment.billing_period_end ? (
                        <span className="text-xs" style={{ color: '#64748b' }}>
                          {formatDate(payment.billing_period_start)} → {formatDate(payment.billing_period_end)}
                        </span>
                      ) : (
                        <span style={{ color: '#334155' }}>—</span>
                      )}
                    </td>

                    {/* Proof */}
                    <td>
                      {payment.proof_image_url ? (
                        <button
                          onClick={() => setLightboxUrl(payment.proof_image_url!)}
                          className="h-10 w-10 rounded-lg overflow-hidden transition-all duration-200 cursor-pointer hover:scale-105"
                          style={{ border: '1px solid rgba(34,211,238,0.15)' }}
                          title="View proof"
                        >
                          <img
                            src={payment.proof_image_url}
                            alt="Proof"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : (
                        <span className="text-xs italic" style={{ color: '#334155' }}>
                          No proof
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td>{statusBadge(payment.status, payment.notes)}</td>

                    {/* Submitted */}
                    <td style={{ color: '#64748b', fontSize: 13 }}>
                      {formatDate(payment.created_at)}
                    </td>

                    {/* Actions */}
                    <td>
                      {payment.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openConfirm('approve', payment)}
                            className="btn-success !py-1.5 !px-3 !text-xs"
                            title="Approve payment"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openConfirm('reject', payment)}
                            className="btn-danger !py-1.5 !px-3 !text-xs"
                            title="Reject payment"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {payment.status !== 'pending' && payment.approver_name && (
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: '#64748b' }}>
                          by {payment.approver_name}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3 animate-in animate-in-2">
        {payments.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <svg
              className="w-12 h-12 mx-auto mb-3"
              style={{ color: '#334155' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>
              No payments found
            </p>
          </div>
        ) : (
          payments.map((payment) => (
            <div key={payment.id} className="glass-card p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: 'rgba(34,211,238,0.1)',
                      color: '#22d3ee',
                      fontFamily: "'Rajdhani', sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {getInitials(payment.user_name ?? '?')}
                  </div>
                  <div>
                    <p
                      className="font-semibold"
                      style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 15, color: '#f1f5f9' }}
                    >
                      {payment.user_name ?? '—'}
                    </p>
                    <p style={{ fontSize: 12, color: '#64748b' }}>{payment.user_phone ?? ''}</p>
                  </div>
                </div>
                {statusBadge(payment.status, payment.notes)}
              </div>

              {/* Amount + Method */}
              <div className="flex items-center justify-between mb-3">
                <span
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontWeight: 700,
                    fontSize: 20,
                    color: '#f1f5f9',
                  }}
                >
                  {formatCurrency(payment.amount)}
                </span>
                {methodBadge(payment.method)}
              </div>

              {/* Reference */}
              {payment.reference_number && (
                <p
                  className="font-mono text-xs text-[#64748b] mb-3 px-2 py-1 rounded inline-block"
                  style={{ background: 'rgba(15,23,41,0.8)' }}
                >
                  Ref: {payment.reference_number}
                </p>
              )}

              {/* Billing Period */}
              {payment.billing_period_start && payment.billing_period_end && (
                <p className="text-xs mb-3" style={{ color: '#64748b' }}>
                  Period: {formatDate(payment.billing_period_start)} → {formatDate(payment.billing_period_end)}
                </p>
              )}

              {/* Proof thumbnail */}
              {payment.proof_image_url ? (
                <button
                  onClick={() => setLightboxUrl(payment.proof_image_url!)}
                  className="block mb-3 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity w-full"
                  style={{ border: '1px solid rgba(34,211,238,0.12)' }}
                >
                  <img
                    src={payment.proof_image_url}
                    alt="Proof"
                    className="w-full max-h-32 object-cover"
                  />
                </button>
              ) : (
                <p className="text-xs italic mb-3" style={{ color: '#334155' }}>
                  No proof uploaded
                </p>
              )}

              {/* Actions */}
              {payment.status === 'pending' && (
                <div
                  className="flex gap-2 pt-3"
                  style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}
                >
                  <button
                    onClick={() => openConfirm('approve', payment)}
                    className="btn-success !py-2 !px-4 !text-xs flex-1"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => openConfirm('reject', payment)}
                    className="btn-danger !py-2 !px-4 !text-xs flex-1"
                  >
                    Reject
                  </button>
                </div>
              )}

              {payment.status !== 'pending' && payment.approver_name && (
                <p
                  className="text-xs pt-2"
                  style={{ color: '#64748b', borderTop: '1px solid rgba(34,211,238,0.06)' }}
                >
                  {payment.status === 'approved' ? 'Approved' : 'Reviewed'} by {payment.approver_name}
                </p>
              )}

              <p className="text-xs mt-2" style={{ color: '#475569' }}>
                Submitted {formatDate(payment.created_at)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-6">
          <p
            className="text-sm"
            style={{ color: '#64748b', fontFamily: "'Outfit', sans-serif" }}
          >
            Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of{' '}
            {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-outline disabled:opacity-30"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="btn-outline disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <LightboxModal url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          action={confirmModal.action}
          payment={confirmModal.payment}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmModal(null)}
          loading={actionLoading}
        />
      )}
    </div>
  )
}
