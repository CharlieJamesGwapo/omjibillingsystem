import { useState, useEffect } from 'react';
import api from '../../lib/api';
import type { Payment, PaymentStatus } from '../../lib/types';

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | PaymentStatus>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      const res = await api.get<Payment[]>('/payments');
      setPayments(res.data ?? []);
    } catch {
      setError('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const statusBadge = (status: PaymentStatus) => {
    const cls: Record<string, string> = {
      pending: 'badge badge-pending',
      approved: 'badge badge-approved',
      rejected: 'badge badge-rejected',
    };
    return <span className={cls[status] || 'badge'}>{status}</span>;
  };

  const methodBadge = (method: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      gcash: { bg: 'rgba(0,112,255,0.12)', color: '#60a5fa' },
      cash: { bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
      bank: { bg: 'rgba(168,85,247,0.12)', color: '#c084fc' },
    };
    const s = styles[method] || { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' };
    return (
      <span className="badge" style={{ background: s.bg, color: s.color }}>
        {method}
      </span>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.post(`/payments/${id}/approve`);
      setLoading(true);
      await fetchPayments();
    } catch {
      setError('Failed to approve payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Reject this payment?')) return;
    setActionLoading(id);
    try {
      await api.post(`/payments/${id}/reject`);
      setLoading(true);
      await fetchPayments();
    } catch {
      setError('Failed to reject payment');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = filter === 'all' ? payments : payments.filter((p) => p.status === filter);

  const filterButtons: { label: string; value: 'all' | PaymentStatus; count: number }[] = [
    { label: 'All', value: 'all', count: payments.length },
    { label: 'Pending', value: 'pending' as PaymentStatus, count: payments.filter((p) => p.status === 'pending').length },
    { label: 'Approved', value: 'approved' as PaymentStatus, count: payments.filter((p) => p.status === 'approved').length },
    { label: 'Rejected', value: 'rejected' as PaymentStatus, count: payments.filter((p) => p.status === 'rejected').length },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-in">
          <div className="h-8 w-36 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-white/5 animate-pulse mt-2" />
        </div>
        <div className="flex gap-2 animate-in animate-in-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 w-24 rounded-full bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="glass-card p-0 animate-in animate-in-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 border-b border-white/[0.03] mx-4 flex items-center">
              <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="animate-in">
        <h1 className="page-header">Payments</h1>
        <p className="page-subtitle">Review and manage all payment transactions</p>
      </div>

      {error && (
        <div className="glass-card p-4 border-l-4" style={{ borderLeftColor: '#ef4444' }}>
          <div className="flex items-center justify-between">
            <p className="text-[#f87171] text-sm">{error}</p>
            <button onClick={() => setError('')} className="text-[#f87171] hover:text-[#fca5a5] text-lg leading-none">&times;</button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap animate-in animate-in-1">
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setFilter(btn.value)}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200"
            style={
              filter === btn.value
                ? { background: '#22d3ee', color: '#fff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em', fontSize: 13 }
                : { background: 'rgba(15,26,46,0.6)', border: '1px solid rgba(34,211,238,0.06)', color: '#94a3b8', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em', fontSize: 13 }
            }
          >
            {btn.label}
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold"
              style={
                filter === btn.value
                  ? { background: 'rgba(255,255,255,0.2)', color: '#fff' }
                  : { background: 'rgba(148,163,184,0.1)', color: '#64748b' }
              }
            >
              {btn.count}
            </span>
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block glass-card animate-in animate-in-2">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="!text-center !py-16">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-12 h-12 text-[#334155]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                      </svg>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>No payments found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontFamily: "'Rajdhani', sans-serif", fontSize: 12, fontWeight: 700 }}
                        >
                          {getInitials(payment.user_name)}
                        </div>
                        <span className="font-semibold" style={{ color: '#f1f5f9' }}>{payment.user_name}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>
                        {formatCurrency(payment.amount)}
                      </span>
                    </td>
                    <td>{methodBadge(payment.method)}</td>
                    <td>
                      {payment.reference_number ? (
                        <span className="font-mono text-xs px-2 py-1 rounded" style={{ background: 'rgba(15,23,41,0.8)', color: '#64748b' }}>
                          {payment.reference_number}
                        </span>
                      ) : (
                        <span className="text-[#334155]">--</span>
                      )}
                    </td>
                    <td>{statusBadge(payment.status)}</td>
                    <td style={{ color: '#64748b', fontSize: 13 }}>{formatDate(payment.created_at)}</td>
                    <td>
                      {payment.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(payment.id)}
                            disabled={actionLoading === payment.id}
                            className="btn-success !py-1.5 !px-3 !text-xs disabled:opacity-40"
                            title="Approve payment"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(payment.id)}
                            disabled={actionLoading === payment.id}
                            className="btn-danger !py-1.5 !px-3 !text-xs disabled:opacity-40"
                            title="Reject payment"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {payment.status === 'approved' && payment.approver_name && (
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
        {filtered.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <svg className="w-12 h-12 text-[#334155] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>No payments found</p>
          </div>
        ) : (
          filtered.map((payment) => (
            <div key={payment.id} className="glass-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontFamily: "'Rajdhani', sans-serif", fontSize: 12, fontWeight: 700 }}
                  >
                    {getInitials(payment.user_name)}
                  </div>
                  <div>
                    <p className="font-semibold text-[#f1f5f9]" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 15 }}>{payment.user_name}</p>
                    <p style={{ fontSize: 12, color: '#64748b' }}>{formatDate(payment.created_at)}</p>
                  </div>
                </div>
                {statusBadge(payment.status)}
              </div>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 20, color: '#f1f5f9' }}>
                  {formatCurrency(payment.amount)}
                </span>
                {methodBadge(payment.method)}
              </div>
              {payment.reference_number && (
                <p className="font-mono text-xs text-[#64748b] mb-3 px-2 py-1 rounded inline-block" style={{ background: 'rgba(15,23,41,0.8)' }}>
                  {payment.reference_number}
                </p>
              )}
              {payment.status === 'pending' && (
                <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
                  <button
                    onClick={() => handleApprove(payment.id)}
                    disabled={actionLoading === payment.id}
                    className="btn-success !py-2 !px-4 !text-xs flex-1 disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(payment.id)}
                    disabled={actionLoading === payment.id}
                    className="btn-danger !py-2 !px-4 !text-xs flex-1 disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              )}
              {payment.status === 'approved' && payment.approver_name && (
                <p className="text-xs text-[#64748b] pt-2" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
                  Approved by {payment.approver_name}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
