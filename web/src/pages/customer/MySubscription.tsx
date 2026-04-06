import { useState, useEffect } from 'react';
import type { Subscription, SubStatus } from '../../lib/types';
import api from '../../lib/api';

export default function MySubscription() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/subscriptions/mine')
      .then((res) => setSubscriptions(res.data ?? []))
      .catch(() => setError('Failed to load subscriptions.'))
      .finally(() => setLoading(false));
  }, []);

  const badgeClass = (status: SubStatus) => {
    switch (status) {
      case 'active':
        return 'badge badge-active';
      case 'overdue':
        return 'badge badge-overdue';
      case 'suspended':
        return 'badge badge-suspended';
      default:
        return 'badge badge-inactive';
    }
  };

  const warningBorder = (status: SubStatus) => {
    if (status === 'suspended') return 'border-l-4 border-l-destructive';
    if (status === 'overdue') return 'border-l-4 border-l-warning';
    return '';
  };

  const hasWarning = subscriptions.some(
    (s) => s.status === 'overdue' || s.status === 'suspended',
  );

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="space-y-8 animate-in">
        <div>
          <div className="h-8 w-56 rounded-lg bg-bg-surface animate-pulse" />
          <div className="h-4 w-80 rounded-lg bg-bg-surface animate-pulse mt-2" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card p-7 space-y-5">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="h-6 w-40 rounded bg-bg-surface animate-pulse" />
                  <div className="h-5 w-20 rounded-full bg-bg-surface animate-pulse" />
                </div>
                <div className="h-7 w-20 rounded bg-bg-surface animate-pulse" />
              </div>
              <div className="h-10 w-48 rounded bg-bg-surface animate-pulse" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-16 rounded-lg bg-bg-surface animate-pulse" />
                ))}
              </div>
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
      <div className="animate-in">
        <h1 className="page-header">My Subscription</h1>
        <p className="page-subtitle">
          Manage and view your current internet plan details
        </p>
      </div>

      {/* Warning Banner */}
      {hasWarning && (
        <div className="glass-card border-l-4 border-l-warning p-5 flex items-start gap-3 animate-in animate-in-1">
          <svg className="h-5 w-5 text-warning mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-heading font-semibold text-warning uppercase tracking-wide">Attention Required</p>
            <p className="mt-0.5 text-sm text-text-secondary">
              Your subscription requires attention. Please settle any outstanding balance to avoid service interruption.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {subscriptions.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 px-6 animate-in animate-in-1">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-bg-surface mb-6">
            <svg className="h-10 w-10 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-heading font-bold text-text-primary">
            No Active Subscription
          </h2>
          <p className="mt-2 max-w-sm text-center text-sm text-text-secondary">
            You don't have any active internet plans yet. Contact our support team to get started with a subscription.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {subscriptions.map((sub, idx) => (
            <div
              key={sub.id}
              className={`glass-card ${warningBorder(sub.status)} p-7 space-y-6 animate-in animate-in-${Math.min(idx + 1, 4)}`}
            >
              {/* Warning banner inside card */}
              {(sub.status === 'overdue' || sub.status === 'suspended') && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-heading font-semibold uppercase tracking-wide ${
                  sub.status === 'suspended'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-warning/10 text-warning'
                }`}>
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {sub.status === 'suspended'
                    ? 'Service suspended — please settle your balance'
                    : 'Payment overdue — please pay to avoid suspension'}
                </div>
              )}

              {/* Card Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-heading text-[24px] font-bold text-text-primary truncate">
                    {sub.plan_name}
                  </h2>
                  <span className="inline-block mt-1.5 rounded-full bg-secondary/15 text-secondary px-3 py-0.5 text-xs font-heading font-semibold uppercase tracking-wide">
                    {sub.plan_speed} Mbps
                  </span>
                </div>
                <span className={badgeClass(sub.status)}>
                  {sub.status}
                </span>
              </div>

              {/* Price */}
              <div>
                <p className="font-heading text-[28px] font-bold text-text-primary leading-tight">
                  &#8369;{Number(sub.plan_price).toLocaleString()}
                  <span className="text-sm font-normal text-text-secondary">/mo</span>
                </p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-bg-surface/40 px-4 py-3">
                  <p className="form-label !mb-1 !text-[10px]">IP Address</p>
                  <p className="text-sm text-text-primary font-mono">
                    {sub.ip_address || '---'}
                  </p>
                </div>
                <div className="rounded-lg bg-bg-surface/40 px-4 py-3">
                  <p className="form-label !mb-1 !text-[10px]">Billing Day</p>
                  <p className="text-sm text-text-primary font-heading font-semibold">
                    {sub.billing_day
                      ? `Every ${sub.billing_day}${ordinalSuffix(sub.billing_day)}`
                      : '---'}
                  </p>
                </div>
                <div className="rounded-lg bg-bg-surface/40 px-4 py-3">
                  <p className="form-label !mb-1 !text-[10px]">Next Due Date</p>
                  <p className="text-sm text-text-primary font-heading font-semibold">
                    {sub.next_due_date
                      ? new Date(sub.next_due_date).toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '---'}
                  </p>
                </div>
                <div className="rounded-lg bg-bg-surface/40 px-4 py-3">
                  <p className="form-label !mb-1 !text-[10px]">Grace Days</p>
                  <p className="text-sm text-text-primary font-heading font-semibold">
                    {sub.grace_days != null
                      ? `${sub.grace_days} days`
                      : '---'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
