import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import type { DashboardStats, Payment, PaymentStatus } from '../../lib/types';

interface ChartData {
  month: string;
  label: string;
  income: number;
  count: number;
}

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, paymentsRes, chartRes, logsRes] = await Promise.all([
          api.get<DashboardStats>('/dashboard/stats'),
          api.get<Payment[]>('/payments'),
          api.get<ChartData[]>('/dashboard/chart').catch(() => ({ data: [] })),
          api.get<ActivityLog[]>('/dashboard/logs').catch(() => ({ data: [] })),
        ]);
        setStats(statsRes.data);
        setPayments((paymentsRes.data ?? []).slice(0, 5));
        setChartData((chartRes.data ?? []).slice(-6));
        const sorted = (logsRes.data ?? []).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setLogs(sorted.slice(0, 8));
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const statusBadge = (status: PaymentStatus) => {
    const cls: Record<string, string> = {
      pending: 'badge badge-pending',
      approved: 'badge badge-approved',
      rejected: 'badge badge-rejected',
    };
    return <span className={cls[status] || 'badge'}>{status}</span>;
  };

  const methodBadge = (method: string) => {
    const colors: Record<string, string> = {
      gcash: 'background: rgba(0,112,255,0.12); color: #60a5fa',
      cash: 'background: rgba(16,185,129,0.12); color: #34d399',
      bank: 'background: rgba(168,85,247,0.12); color: #c084fc',
    };
    const style = colors[method] || 'background: rgba(148,163,184,0.12); color: #94a3b8';
    return (
      <span
        className="badge"
        style={Object.fromEntries(style.split('; ').map(s => { const [k, v] = s.split(': '); return [k, v]; }))}
      >
        {method}
      </span>
    );
  };

  const actionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) return '#10b981';
    if (action.includes('update') || action.includes('edit') || action.includes('approve')) return '#22d3ee';
    if (action.includes('delete') || action.includes('reject') || action.includes('remove')) return '#ef4444';
    if (action.includes('login') || action.includes('auth')) return '#f59e0b';
    return '#64748b';
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-in">
          <div className="h-8 w-48 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-72 rounded-lg bg-white/5 animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 animate-in animate-in-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="stat-card">
              <div className="h-9 w-9 rounded-lg bg-white/5 animate-pulse mb-3" />
              <div className="h-8 w-20 rounded bg-white/5 animate-pulse mb-2" />
              <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="glass-card p-6 animate-in animate-in-2">
          <div className="h-5 w-40 rounded bg-white/5 animate-pulse mb-6" />
          <div className="flex items-end gap-3 h-48">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex-1 rounded-t bg-white/5 animate-pulse" style={{ height: `${30 + Math.random() * 70}%` }} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="glass-card p-6 animate-in animate-in-3">
              <div className="h-5 w-40 rounded bg-white/5 animate-pulse mb-6" />
              <div className="h-48 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="glass-card p-6 animate-in animate-in-4">
          <div className="h-5 w-40 rounded bg-white/5 animate-pulse mb-6" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded bg-white/5 animate-pulse mb-2" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 border-l-4" style={{ borderLeftColor: '#ef4444' }}>
        <p className="text-[#f87171] font-medium">{error}</p>
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Customers',
      value: stats?.total_customers ?? 0,
      color: '#22d3ee',
      trend: '+12% this month',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      ),
    },
    {
      label: 'Active',
      value: stats?.active ?? 0,
      color: '#10b981',
      trend: '+5 new this week',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: 'Overdue',
      value: stats?.overdue ?? 0,
      color: '#f59e0b',
      trend: 'Needs attention',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ),
    },
    {
      label: 'Suspended',
      value: stats?.suspended ?? 0,
      color: '#ef4444',
      trend: 'Disconnected',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    },
    {
      label: 'Monthly Income',
      value: formatCurrency(stats?.monthly_income ?? 0),
      color: '#3b82f6',
      trend: 'Current period',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
        </svg>
      ),
    },
    {
      label: 'Pending Payments',
      value: stats?.pending_payments ?? 0,
      color: '#a855f7',
      trend: 'Awaiting approval',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
  ];

  // Chart calculations
  const maxIncome = Math.max(...chartData.map(d => d.income), 1);
  const totalRevenue = chartData.reduce((sum, d) => sum + d.income, 0);
  const bestMonth = chartData.reduce((best, d) => (d.income > best.income ? d : best), chartData[0] || { label: '-', income: 0 });
  const avgMonthly = chartData.length > 0 ? totalRevenue / chartData.length : 0;

  // Subscription breakdown
  const activeCount = stats?.active ?? 0;
  const overdueCount = stats?.overdue ?? 0;
  const suspendedCount = stats?.suspended ?? 0;
  const totalSubs = activeCount + overdueCount + suspendedCount;
  const activePct = totalSubs > 0 ? (activeCount / totalSubs) * 100 : 0;
  const overduePct = totalSubs > 0 ? (overdueCount / totalSubs) * 100 : 0;
  const suspendedPct = totalSubs > 0 ? (suspendedCount / totalSubs) * 100 : 0;
  const conicGradient = totalSubs > 0
    ? `conic-gradient(#10b981 0% ${activePct}%, #f59e0b ${activePct}% ${activePct + overduePct}%, #ef4444 ${activePct + overduePct}% 100%)`
    : 'conic-gradient(#1e293b 0% 100%)';

  const formattedDate = currentTime.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = currentTime.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-in">
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="page-subtitle">Welcome back. Here's what's happening today.</p>
        </div>
        <div className="text-right">
          <p className="font-heading text-sm font-semibold text-text-primary tracking-wide">{formattedTime}</p>
          <p className="font-body text-xs text-[#64748b]">{formattedDate}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 animate-in animate-in-1">
        {cards.map((card) => (
          <div
            key={card.label}
            className="stat-card"
            style={{ borderLeft: `4px solid ${card.color}` }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: `${card.color}15`, color: card.color }}
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
              {card.trend}
            </p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      {chartData.length > 0 && (
        <div className="glass-card p-6 animate-in animate-in-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-bold text-text-primary">Revenue Overview</h2>
              <p className="font-body text-xs text-[#64748b] mt-1">Last {chartData.length} Months</p>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end gap-3 h-52 mb-2 px-2">
            {chartData.map((d, i) => {
              const heightPct = (d.income / maxIncome) * 100;
              return (
                <div
                  key={d.month}
                  className="flex-1 flex flex-col items-center justify-end relative"
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {hoveredBar === i && (
                    <div
                      className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs font-heading font-bold text-white whitespace-nowrap z-10"
                      style={{ background: 'rgba(15,26,46,0.95)', border: '1px solid rgba(34,211,238,0.2)' }}
                    >
                      {formatCurrency(d.income)}
                    </div>
                  )}
                  <div
                    className="w-full rounded-t-lg transition-all duration-300 cursor-pointer"
                    style={{
                      height: `${Math.max(heightPct, 4)}%`,
                      background: 'linear-gradient(180deg, #22d3ee 0%, #3b82f6 100%)',
                      opacity: hoveredBar === null || hoveredBar === i ? 1 : 0.4,
                      minHeight: 4,
                    }}
                  />
                  <p className="font-heading text-[10px] font-semibold text-[#64748b] mt-2 uppercase tracking-wide">
                    {d.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Mini Stats below chart */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
            <div className="text-center">
              <p className="font-heading text-xs font-semibold uppercase tracking-widest text-[#64748b]">Total Revenue</p>
              <p className="font-heading text-xl font-bold text-text-primary mt-1">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-xs font-semibold uppercase tracking-widest text-[#64748b]">Best Month</p>
              <p className="font-heading text-xl font-bold text-[#10b981] mt-1">{bestMonth?.label ?? '-'}</p>
              <p className="font-body text-[11px] text-[#64748b]">{formatCurrency(bestMonth?.income ?? 0)}</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-xs font-semibold uppercase tracking-widest text-[#64748b]">Avg Monthly</p>
              <p className="font-heading text-xl font-bold text-text-primary mt-1">{formatCurrency(avgMonthly)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Two Column: Subscription Breakdown + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Breakdown */}
        <div className="glass-card p-6 animate-in animate-in-3">
          <h2 className="font-heading text-lg font-bold text-text-primary mb-6">Subscription Status</h2>
          <div className="flex flex-col items-center">
            {/* Donut Chart */}
            <div className="relative w-44 h-44 mb-6">
              <div
                className="w-full h-full rounded-full"
                style={{ background: conicGradient }}
              />
              <div
                className="absolute inset-4 rounded-full flex flex-col items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(15,26,46,0.95) 0%, rgba(10,17,32,0.98) 100%)' }}
              >
                <p className="font-heading text-3xl font-bold text-text-primary leading-none">{totalSubs}</p>
                <p className="font-heading text-[10px] font-semibold uppercase tracking-widest text-[#64748b] mt-1">Total</p>
              </div>
            </div>
            {/* Legend */}
            <div className="w-full space-y-3">
              {[
                { label: 'Active', count: activeCount, pct: activePct, color: '#10b981' },
                { label: 'Overdue', count: overdueCount, pct: overduePct, color: '#f59e0b' },
                { label: 'Suspended', count: suspendedCount, pct: suspendedPct, color: '#ef4444' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="font-body text-sm text-[#94a3b8]">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-heading text-sm font-bold text-text-primary">{item.count}</span>
                    <span className="font-body text-xs text-[#64748b] w-12 text-right">{item.pct.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6 animate-in animate-in-3">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-lg font-bold text-text-primary">Recent Activity</h2>
            <Link to="/admin/activity-logs" className="font-heading text-xs font-semibold uppercase tracking-widest text-secondary hover:text-[#67e8f9] transition-colors">
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
                  <div className="mt-1.5 flex-shrink-0">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: actionColor(log.action) }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-[#cbd5e1] truncate">
                      <span className="font-semibold text-text-primary capitalize">{log.action.replace(/_/g, ' ')}</span>
                      {log.target_type && (
                        <span className="text-[#64748b]"> {log.target_type}</span>
                      )}
                    </p>
                    <p className="font-body text-[11px] text-[#475569] mt-0.5">{timeAgo(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Payments */}
      <div className="glass-card animate-in animate-in-4">
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(34,211,238,0.06)' }}>
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-lg font-bold text-text-primary">Recent Payments</h2>
            <span className="badge badge-admin">{payments.length}</span>
          </div>
          <Link to="/admin/payments" className="font-heading text-xs font-semibold uppercase tracking-widest text-secondary hover:text-[#67e8f9] transition-colors">
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
                    <td className="!font-semibold !text-[#f1f5f9]">{p.user_name}</td>
                    <td>
                      <span className="font-heading text-[15px] font-bold text-text-primary">
                        {formatCurrency(p.amount)}
                      </span>
                    </td>
                    <td>{methodBadge(p.method)}</td>
                    <td>{statusBadge(p.status)}</td>
                    <td className="text-[#64748b] text-[13px]">{formatDate(p.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
