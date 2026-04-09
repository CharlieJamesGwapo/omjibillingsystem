import { useState, useEffect, useRef, useMemo } from 'react'
import api from '../../lib/api'
import { formatDateTime, prettyAction, exportToCSV } from '../../lib/utils'
import { toast } from 'sonner'

interface ActivityLog {
  id: string
  user_id: string
  action: string
  target_type: string
  target_id: string
  details: Record<string, unknown>
  ip_address: string
  created_at: string
  user_name?: string
}

interface User {
  id: string
  name?: string
  phone?: string
}

const LIMIT = 20

// ─── Color dot by action ──────────────────────────────────────────────────────

function actionDotColor(action: string): string {
  const a = action.toLowerCase()
  if (a.includes('create') || a.includes('add')) return '#22c55e'       // green
  if (a.includes('update') || a.includes('edit')) return '#3b82f6'      // blue
  if (a.includes('delete') || a.includes('remove')) return '#ef4444'    // red
  if (a.includes('approve')) return '#10b981'                            // emerald
  if (a.includes('reject')) return '#ef4444'                             // red
  if (a.includes('login') || a.includes('auth')) return '#94a3b8'       // gray
  return '#06b6d4'                                                        // cyan default
}

// ─── Syntax-colored JSON renderer ────────────────────────────────────────────

function ColoredJSON({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data, null, 2)
  // Simple regex-based colorisation
  const html = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span style="color:#67e8f9">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span style="color:#86efac">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span style="color:#fbbf24">$1</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:#c4b5fd">$1</span>')

  return (
    <pre
      className="text-xs font-mono bg-[#0a0f1e] p-3 rounded overflow-auto max-h-40"
      style={{ color: '#94a3b8' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td><div className="h-3 bg-white/5 rounded w-32" /></td>
          <td><div className="h-3 bg-white/5 rounded w-24" /></td>
          <td><div className="h-3 bg-white/5 rounded w-20" /></td>
          <td><div className="h-3 bg-white/5 rounded w-28" /></td>
          <td><div className="h-3 bg-white/5 rounded w-20" /></td>
          <td><div className="h-3 bg-white/5 rounded w-16" /></td>
        </tr>
      ))}
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map())

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = (value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

  // Fetch users once on mount
  useEffect(() => {
    api
      .get<{ data: User[]; total: number }>('/users?limit=200')
      .then((res) => {
        const map = new Map<string, string>()
        const users = res.data.data ?? []
        users.forEach((u) => {
          map.set(u.id, u.full_name ?? u.phone ?? u.id.slice(0, 8))
        })
        setUserMap(map)
      })
      .catch(() => {
        // non-fatal — we just won't resolve names
      })
  }, [])

  // Fetch logs on page change
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    api
      .get<{ data: ActivityLog[]; total: number; page: number; limit: number }>(
        `/dashboard/logs?${params}`
      )
      .then((res) => {
        setLogs(res.data.data ?? [])
        setTotal(res.data.total ?? 0)
      })
      .catch(() => {
        toast.error('Failed to load activity logs')
      })
      .finally(() => setLoading(false))
  }, [page])

  // Unique action types for filter dropdown
  const uniqueActions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action))
    return Array.from(set).sort()
  }, [logs])

  // Resolved logs (inject user_name from map)
  const resolvedLogs = useMemo(
    () =>
      logs.map((l) => ({
        ...l,
        user_name: userMap.get(l.user_id) ?? l.user_name ?? 'Unknown',
      })),
    [logs, userMap]
  )

  // Client-side filtering
  const filteredLogs = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    const from = dateFrom ? new Date(dateFrom).getTime() : null
    const to = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null

    return resolvedLogs.filter((log) => {
      if (
        q &&
        !log.action.toLowerCase().includes(q) &&
        !log.target_type.toLowerCase().includes(q) &&
        !(log.user_name ?? '').toLowerCase().includes(q)
      ) {
        return false
      }
      if (actionFilter !== 'all' && log.action !== actionFilter) return false
      const t = new Date(log.created_at).getTime()
      if (from && t < from) return false
      if (to && t > to) return false
      return true
    })
  }, [resolvedLogs, debouncedSearch, actionFilter, dateFrom, dateTo])

  // Toggle row expansion
  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Copy target_id to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'))
  }

  // Export CSV
  const handleExport = () => {
    if (!filteredLogs.length) {
      toast.error('No rows to export')
      return
    }
    exportToCSV(
      `activity-logs-page${page}.csv`,
      filteredLogs.map((l) => ({
        time: formatDateTime(l.created_at),
        actor: l.user_name ?? 'Unknown',
        action: l.action,
        target_type: l.target_type,
        target_id: l.target_id,
        ip_address: l.ip_address,
      }))
    )
    toast.success('CSV exported')
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="space-y-6 animate-in">
      {/* Page Header */}
      <div className="flex items-start justify-between animate-in animate-in-1">
        <div>
          <h1 className="page-header">Activity Logs</h1>
          <p className="page-subtitle">System audit trail</p>
        </div>
        <button
          onClick={handleExport}
          className="btn-outline flex items-center gap-2 mt-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-center animate-in animate-in-2">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: '#475569' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search action, target, user…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="input-field pl-9 w-full"
          />
        </div>

        {/* Action filter */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="input-field min-w-36"
        >
          <option value="all">All Actions</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>
              {prettyAction(a)}
            </option>
          ))}
        </select>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#475569' }}>From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input-field"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#475569' }}>To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input-field"
          />
        </div>

        {/* Clear filters */}
        {(search || actionFilter !== 'all' || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSearch('')
              setDebouncedSearch('')
              setActionFilter('all')
              setDateFrom('')
              setDateTo('')
            }}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden animate-in animate-in-3">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 28 }} />
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>IP Address</th>
                <th>Time</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="!text-center !py-16">
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="w-10 h-10"
                        style={{ color: 'rgba(148,163,184,0.2)' }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9Z" />
                      </svg>
                      <p className="text-sm" style={{ color: '#475569' }}>
                        No activity logs found
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedRows.has(log.id)
                  const hasDetails = Object.keys(log.details ?? {}).length > 0
                  const dotColor = actionDotColor(log.action)

                  return (
                    <>
                      <tr key={log.id}>
                        {/* Color dot */}
                        <td>
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ background: dotColor }}
                          />
                        </td>

                        {/* Actor */}
                        <td>
                          <span className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>
                            {log.user_name ?? 'Unknown'}
                          </span>
                        </td>

                        {/* Action */}
                        <td>
                          <span className="text-sm" style={{ color: dotColor }}>
                            {prettyAction(log.action)}
                          </span>
                        </td>

                        {/* Target */}
                        <td>
                          <span className="text-sm" style={{ color: '#cbd5e1' }}>
                            {prettyAction(log.target_type)}
                          </span>
                          {log.target_id && (
                            <span className="ml-1.5 inline-flex items-center gap-1">
                              <span
                                className="font-mono text-xs"
                                style={{ color: '#64748b' }}
                              >
                                #{log.target_id.slice(0, 8)}
                              </span>
                              <button
                                onClick={() => copyToClipboard(log.target_id)}
                                title="Copy full ID"
                                className="opacity-50 hover:opacity-100 transition-opacity"
                              >
                                <svg
                                  className="w-3 h-3"
                                  style={{ color: '#94a3b8' }}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </span>
                          )}
                        </td>

                        {/* IP */}
                        <td>
                          {log.ip_address ? (
                            <span className="font-mono text-xs" style={{ color: '#64748b' }}>
                              {log.ip_address}
                            </span>
                          ) : (
                            <span style={{ color: 'rgba(100,116,139,0.4)' }}>—</span>
                          )}
                        </td>

                        {/* Time */}
                        <td className="whitespace-nowrap">
                          <span
                            className="text-xs tabular-nums"
                            style={{ color: '#64748b', fontFamily: "'Outfit', sans-serif" }}
                          >
                            {formatDateTime(log.created_at)}
                          </span>
                        </td>

                        {/* Chevron */}
                        <td>
                          {hasDetails && (
                            <button
                              onClick={() => toggleExpand(log.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
                              title={isExpanded ? 'Collapse' : 'Expand details'}
                            >
                              <svg
                                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                style={{ color: '#475569' }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expandable details */}
                      {isExpanded && hasDetails && (
                        <tr key={`${log.id}-details`}>
                          <td colSpan={7} className="!pt-0 !pb-3 !px-6">
                            <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                              <ColoredJSON data={log.details} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
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
            {filteredLogs.length < Math.min(LIMIT, total) && (
              <span className="ml-1">
                ({filteredLogs.length} visible after filters)
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-outline disabled:opacity-30"
            >
              Previous
            </button>
            <span
              className="text-sm px-2"
              style={{ color: '#94a3b8', fontFamily: "'Outfit', sans-serif" }}
            >
              {page} / {totalPages || 1}
            </span>
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
    </div>
  )
}
