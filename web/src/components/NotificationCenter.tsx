import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { formatRelativeTime, formatCurrency, formatDate } from '../lib/utils'
import type { Notification, Payment, Subscription } from '../lib/types'

const LS_KEY = 'omji_read_notifs'

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore
  }
}

function buildNotifications(
  payments: Payment[],
  subscriptions: Subscription[],
  readIds: Set<string>
): Notification[] {
  const notifs: Notification[] = []

  for (const p of payments) {
    const id = `payment_pending_${p.id}`
    notifs.push({
      id,
      type: 'payment_pending',
      title: 'Payment Pending',
      message: `${p.user_name ?? 'Unknown'} submitted ${formatCurrency(p.amount)} via ${p.method}`,
      read: readIds.has(id),
      created_at: p.created_at,
      link: '/admin/payments',
    })
  }

  for (const s of subscriptions) {
    const id = `subscription_overdue_${s.id}`
    notifs.push({
      id,
      type: 'subscription_overdue',
      title: 'Overdue Subscription',
      message: `${s.user_name ?? 'Unknown'}'s subscription is overdue since ${formatDate(s.next_due_date)}`,
      read: readIds.has(id),
      created_at: s.updated_at,
      link: '/admin/subscriptions?status=overdue',
    })
  }

  // Sort newest first
  notifs.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return notifs
}

// Icons per notification type
function NotifIcon({ type }: { type: Notification['type'] }) {
  if (type === 'payment_pending') {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
        <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
        </svg>
      </div>
    )
  }
  if (type === 'subscription_overdue') {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
    )
  }
  if (type === 'payment_approved') {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
    )
  }
  if (type === 'payment_rejected') {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
    )
  }
  // info / fallback
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
      <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    </div>
  )
}

export default function NotificationCenter() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [showPermBanner, setShowPermBanner] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const prevPendingCountRef = useRef<number>(0)

  // Check whether browser notification banner should show
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (window.Notification.permission === 'default') {
        setShowPermBanner(true)
      }
    }
  }, [])

  const fireBrowserNotif = useCallback((count: number) => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      window.Notification.permission !== 'granted'
    ) return
    if (!document.hidden) return
    new window.Notification('New Payment Pending', {
      body: `${count} pending payment${count > 1 ? 's' : ''} require your attention.`,
    })
  }, [])

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const readIds = getReadIds()

      const [paymentsRes, subsRes] = await Promise.all([
        api.get<{ data: Payment[]; total: number }>('/payments?status=pending&page=1&limit=10'),
        api.get<{ data: Subscription[]; total: number }>('/subscriptions?status=overdue&page=1&limit=10'),
      ])

      const payments: Payment[] = paymentsRes.data?.data ?? []
      const subs: Subscription[] = subsRes.data?.data ?? []

      const newPendingCount = payments.length
      if (newPendingCount > prevPendingCountRef.current) {
        fireBrowserNotif(newPendingCount)
      }
      prevPendingCountRef.current = newPendingCount

      const built = buildNotifications(payments, subs, readIds)
      setNotifications(built)
    } catch {
      // silently ignore fetch errors
    } finally {
      setLoading(false)
    }
  }, [fireBrowserNotif])

  // Initial fetch + 2-minute interval
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 120_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllRead = () => {
    const readIds = getReadIds()
    notifications.forEach((n) => readIds.add(n.id))
    saveReadIds(readIds)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleItemClick = (notif: Notification) => {
    // Mark as read
    const readIds = getReadIds()
    readIds.add(notif.id)
    saveReadIds(readIds)
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    )
    setOpen(false)
    if (notif.link) {
      navigate(notif.link)
    }
  }

  const handleEnableNotifs = async () => {
    if (!('Notification' in window)) return
    const perm = await window.Notification.requestPermission()
    if (perm === 'granted' || perm === 'denied') {
      setShowPermBanner(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Browser notification permission banner */}
      {showPermBanner && (
        <div className="fixed top-16 right-4 z-[60] flex items-center gap-3 bg-[#0d1627] border border-[rgba(34,211,238,0.15)] rounded-xl px-4 py-3 shadow-lg max-w-xs">
          <svg className="w-4 h-4 text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          <p className="font-body text-[12px] text-[#94a3b8] flex-1 leading-snug">
            Enable browser notifications for payment alerts
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleEnableNotifs}
              className="font-body text-[11px] font-semibold text-secondary hover:text-secondary/80 transition-colors cursor-pointer"
            >
              Enable
            </button>
            <button
              onClick={() => setShowPermBanner(false)}
              className="text-[#475569] hover:text-[#94a3b8] transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-[#64748b] hover:text-text-primary hover:bg-[rgba(255,255,255,0.04)] transition-all duration-200 cursor-pointer"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[360px] bg-[#0d1627] border border-[rgba(34,211,238,0.08)] rounded-2xl shadow-2xl z-50 overflow-hidden"
          style={{
            animation: 'slideDown 0.18s ease-out both',
          }}
        >
          <style>{`
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(34,211,238,0.06)]">
            <div className="flex items-center gap-2">
              <span className="font-heading text-[14px] font-semibold text-text-primary">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500/15 text-red-400 text-[10px] font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="font-body text-[12px] text-secondary hover:text-secondary/70 transition-colors cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
                <div className="w-12 h-12 rounded-full bg-[rgba(34,211,238,0.05)] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#334155]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                </div>
                <p className="font-body text-[13px] text-[#475569] text-center">
                  No notifications
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[rgba(34,211,238,0.04)]">
                {notifications.map((notif) => (
                  <li key={notif.id}>
                    <button
                      onClick={() => handleItemClick(notif)}
                      className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 cursor-pointer hover:bg-[rgba(255,255,255,0.02)] relative ${
                        !notif.read
                          ? 'border-l-2 border-secondary bg-[rgba(34,211,238,0.02)]'
                          : 'border-l-2 border-transparent'
                      }`}
                    >
                      <NotifIcon type={notif.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`font-body text-[13px] font-medium truncate ${notif.read ? 'text-[#94a3b8]' : 'text-text-primary'}`}>
                            {notif.title}
                          </p>
                          <span className="font-body text-[11px] text-[#475569] flex-shrink-0">
                            {formatRelativeTime(notif.created_at)}
                          </span>
                        </div>
                        <p className="font-body text-[12px] text-[#64748b] mt-0.5 leading-snug line-clamp-2">
                          {notif.message}
                        </p>
                      </div>
                      {!notif.read && (
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-secondary mt-1.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[rgba(34,211,238,0.06)] text-center">
              <p className="font-body text-[11px] text-[#334155]">
                Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
