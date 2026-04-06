import { useState, useEffect } from 'react';
import type { Payment, PaymentStatus } from '../../lib/types';
import api from '../../lib/api';

const STATUS_OPTIONS: { label: string; value: '' | PaymentStatus }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export default function MyPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | PaymentStatus>('');

  useEffect(() => {
    api
      .get('/payments/mine')
      .then((res) => {
        const sorted = ((res.data ?? []) as Payment[]).sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        );
        setPayments(sorted);
      })
      .catch(() => setError('Failed to load payments.'))
      .finally(() => setLoading(false));
  }, []);

  const badgeClass = (status: PaymentStatus) => {
    switch (status) {
      case 'pending':
        return 'badge badge-pending';
      case 'approved':
        return 'badge badge-approved';
      case 'rejected':
        return 'badge badge-rejected';
      default:
        return 'badge badge-inactive';
    }
  };

  const methodBadge = (method: string) => {
    const map: Record<string, string> = {
      gcash: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      maya: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      bank: 'bg-slate-400/10 text-slate-300 border border-slate-400/20',
      cash: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    };
    return map[method] ?? 'bg-bg-surface text-text-secondary';
  };

  const filtered = statusFilter
    ? payments.filter((p) => p.status === statusFilter)
    : payments;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const formatPeriod = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
    });

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="space-y-8 animate-in">
        <div>
          <div className="h-8 w-48 rounded-lg bg-bg-surface animate-pulse" />
          <div className="h-4 w-72 rounded-lg bg-bg-surface animate-pulse mt-2" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-24 rounded-lg bg-bg-surface animate-pulse" />
          ))}
        </div>
        <div className="glass-card p-0 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-6 px-5 py-4 border-b border-border/30">
              <div className="h-4 w-24 rounded bg-bg-surface animate-pulse" />
              <div className="h-4 w-20 rounded bg-bg-surface animate-pulse" />
              <div className="h-4 w-16 rounded bg-bg-surface animate-pulse" />
              <div className="h-4 w-28 rounded bg-bg-surface animate-pulse" />
              <div className="h-4 w-20 rounded bg-bg-surface animate-pulse" />
              <div className="h-4 w-32 rounded bg-bg-surface animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="mx-auto max-w-lg mt-12 animate-in">
        <div className="glass-card p-6 border-l-4 border-l-destructive flex items-start gap-3">
          <svg className="h-5 w-5 text-destructive mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between animate-in">
        <div>
          <h1 className="page-header">My Payments</h1>
          <p className="page-subtitle">
            Track all your submitted payments and their approval status
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 animate-in animate-in-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-lg px-4 py-2 font-heading text-xs font-semibold uppercase tracking-wider transition-all ${
                statusFilter === opt.value
                  ? 'bg-secondary text-white shadow-md shadow-secondary/25'
                  : 'glass-card !rounded-lg px-4 py-2 text-text-secondary hover:text-secondary hover:border-secondary/30'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 px-6 animate-in animate-in-2">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-bg-surface mb-6">
            <svg className="h-10 w-10 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-heading font-bold text-text-primary">
            No Payments Found
          </h2>
          <p className="mt-2 max-w-sm text-center text-sm text-text-secondary">
            {statusFilter
              ? 'No payments match the selected filter. Try clearing it to see all payments.'
              : 'Your payment history will appear here once you submit your first payment.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block glass-card overflow-hidden animate-in animate-in-2">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Period</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="whitespace-nowrap font-semibold text-text-primary">
                      &#8369;{Number(p.amount).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-heading font-semibold uppercase tracking-wider ${methodBadge(p.method)}`}>
                        {p.method}
                      </span>
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-text-secondary">
                      {p.reference_number || '-'}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={badgeClass(p.status)}>
                        {p.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-xs text-text-secondary">
                      {formatPeriod(p.billing_period_start)} &ndash; {formatPeriod(p.billing_period_end)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((p, idx) => (
              <div
                key={p.id}
                className={`glass-card p-5 space-y-4 animate-in animate-in-${Math.min(idx + 1, 4)}`}
              >
                {/* Top row: amount + status */}
                <div className="flex items-center justify-between">
                  <p className="text-lg font-heading font-bold text-text-primary">
                    &#8369;{Number(p.amount).toLocaleString()}
                  </p>
                  <span className={badgeClass(p.status)}>
                    {p.status}
                  </span>
                </div>

                {/* Details stacked */}
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary text-xs uppercase tracking-wider font-heading font-semibold">Date</span>
                    <span className="text-text-primary">{formatDate(p.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary text-xs uppercase tracking-wider font-heading font-semibold">Method</span>
                    <span className={`inline-block rounded-md px-2.5 py-0.5 text-[11px] font-heading font-semibold uppercase tracking-wider ${methodBadge(p.method)}`}>
                      {p.method}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary text-xs uppercase tracking-wider font-heading font-semibold">Reference</span>
                    <span className="text-text-primary font-mono text-xs">{p.reference_number || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary text-xs uppercase tracking-wider font-heading font-semibold">Period</span>
                    <span className="text-text-primary text-xs">
                      {formatPeriod(p.billing_period_start)} &ndash; {formatPeriod(p.billing_period_end)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
