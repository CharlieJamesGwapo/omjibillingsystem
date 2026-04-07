import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Subscription, PaymentMethod } from '../../lib/types';
import api from '../../lib/api';

const PAYMENT_METHODS: {
  label: string;
  value: PaymentMethod;
  colorSelected: string;
  colorIcon: string;
  icon: React.ReactNode;
}[] = [
  {
    label: 'GCash',
    value: 'gcash',
    colorSelected: 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)]',
    colorIcon: 'bg-blue-500/15 text-blue-400',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
  },
  {
    label: 'Maya',
    value: 'maya',
    colorSelected: 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    colorIcon: 'bg-emerald-500/15 text-emerald-400',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 6v3" />
      </svg>
    ),
  },
  {
    label: 'Bank Transfer',
    value: 'bank',
    colorSelected: 'border-slate-400 shadow-[0_0_20px_rgba(148,163,184,0.1)]',
    colorIcon: 'bg-slate-400/15 text-slate-300',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
      </svg>
    ),
  },
  {
    label: 'Cash',
    value: 'cash',
    colorSelected: 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    colorIcon: 'bg-amber-500/15 text-amber-400',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
];

const NEEDS_REFERENCE: PaymentMethod[] = ['gcash', 'maya', 'bank'];

export default function SubmitPayment() {
  const navigate = useNavigate();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [subscriptionId, setSubscriptionId] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<PaymentMethod>('gcash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [billingStart, setBillingStart] = useState('');
  const [billingEnd, setBillingEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .get('/subscriptions/mine')
      .then((res) => {
        const subs = (res.data ?? []) as Subscription[];
        setSubscriptions(subs);
        if (subs.length === 1) {
          setSubscriptionId(subs[0].id);
          setAmount(Number(subs[0].plan_price));
        }
      })
      .catch(() => setError('Failed to load subscriptions.'))
      .finally(() => setLoading(false));
  }, []);

  // Auto-fill amount when subscription changes
  const handleSubscriptionChange = (id: string) => {
    setSubscriptionId(id);
    const sub = subscriptions.find((s) => s.id === id);
    if (sub) {
      setAmount(Number(sub.plan_price));
    }
  };

  const validate = (): string[] => {
    const errs: string[] = [];
    const fErrs: Record<string, string> = {};

    if (!subscriptionId) {
      errs.push('Please select a subscription.');
      fErrs.subscription = 'Please select a subscription.';
    }
    if (amount === '' || amount <= 0) {
      errs.push('Amount must be greater than 0.');
      fErrs.amount = 'Amount must be greater than 0.';
    }
    if (NEEDS_REFERENCE.includes(method) && !referenceNumber.trim()) {
      errs.push('Reference number is required for this payment method.');
      fErrs.reference = 'Reference number is required for this payment method.';
    }
    if (!billingStart) {
      errs.push('Billing period start is required.');
      fErrs.billingStart = 'Start date is required.';
    }
    if (!billingEnd) {
      errs.push('Billing period end is required.');
      fErrs.billingEnd = 'End date is required.';
    }
    if (billingStart && billingEnd && billingStart > billingEnd) {
      errs.push('Billing period start must be before end.');
      fErrs.billingEnd = 'End must be after start.';
    }

    setFieldErrors(fErrs);
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors([]);
    setFieldErrors({});
    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('subscription_id', subscriptionId);
      formData.append('amount', String(amount));
      formData.append('method', method);
      if (referenceNumber) formData.append('reference_number', referenceNumber);
      if (billingStart) formData.append('billing_period_start', billingStart);
      if (billingEnd) formData.append('billing_period_end', billingEnd);
      if (notes) formData.append('notes', notes);
      if (proofFile) formData.append('proof_image', proofFile);

      await api.post('/payments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(true);
    } catch {
      setError('Failed to submit payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 animate-in">
        <div>
          <div className="h-8 w-52 rounded-lg bg-bg-surface animate-pulse" />
          <div className="h-4 w-72 rounded-lg bg-bg-surface animate-pulse mt-2" />
        </div>
        <div className="glass-card p-8 space-y-6">
          <div className="h-12 w-full rounded-lg bg-bg-surface animate-pulse" />
          <div className="h-20 w-full rounded-lg bg-bg-surface animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-bg-surface animate-pulse" />
            ))}
          </div>
          <div className="h-12 w-full rounded-lg bg-bg-surface animate-pulse" />
          <div className="h-12 w-full rounded-lg bg-bg-surface animate-pulse" />
          <div className="h-14 w-full rounded-lg bg-bg-surface animate-pulse" />
        </div>
      </div>
    );
  }

  /* ── Success state ── */
  if (success) {
    return (
      <div className="mx-auto max-w-lg mt-12 animate-in">
        <div className="glass-card border-l-4 border-l-accent p-10 text-center space-y-6">
          {/* Checkmark */}
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/15">
              <svg className="h-10 w-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="page-header !text-center">
              Payment Submitted!
            </h2>
            <p className="text-sm text-text-secondary max-w-xs mx-auto">
              Your payment has been submitted successfully and is now pending admin approval. You will be notified once it's reviewed.
            </p>
          </div>

          <button
            onClick={() => navigate('/portal/payments')}
            className="btn-primary w-full"
          >
            Back to Payments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Page Header */}
      <div className="animate-in">
        <h1 className="page-header">Submit Payment</h1>
        <p className="page-subtitle">
          Upload your payment details for verification
        </p>
      </div>

      {/* Global Errors */}
      {(error || validationErrors.length > 0) && (
        <div className="glass-card border-l-4 border-l-destructive p-5 space-y-2 animate-in">
          {error && (
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-destructive shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}
          {validationErrors.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 text-destructive shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <p className="text-sm text-destructive">{e}</p>
            </div>
          ))}
        </div>
      )}

      {/* No Subscriptions */}
      {subscriptions.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 px-6 animate-in animate-in-1">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-bg-surface mb-6">
            <svg className="h-10 w-10 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-heading font-bold text-text-primary">
            No Active Subscription
          </h2>
          <p className="mt-2 max-w-sm text-center text-sm text-text-secondary">
            You need an active subscription to submit a payment. Contact support to get started.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="glass-card p-8 space-y-8 animate-in animate-in-1"
        >
          {/* ── Step 1: Subscription Selector ── */}
          <div className="space-y-2">
            <label className="form-label">Subscription</label>
            {subscriptions.length === 1 ? (
              <div className="stat-card flex items-center gap-3 !border-secondary/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/15 shrink-0">
                  <svg className="h-5 w-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-heading font-bold text-text-primary">{subscriptions[0].plan_name}</p>
                  <p className="text-xs text-text-secondary">&#8369;{Number(subscriptions[0].plan_price).toLocaleString()}/mo</p>
                </div>
              </div>
            ) : (
              <div>
                <select
                  value={subscriptionId}
                  onChange={(e) => handleSubscriptionChange(e.target.value)}
                  className={`form-input ${fieldErrors.subscription ? '!border-destructive' : ''}`}
                >
                  <option value="">Select subscription</option>
                  {subscriptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.plan_name} — &#8369;{Number(s.plan_price).toLocaleString()}
                    </option>
                  ))}
                </select>
                {fieldErrors.subscription && (
                  <p className="mt-1.5 text-xs text-destructive">{fieldErrors.subscription}</p>
                )}
              </div>
            )}
          </div>

          {/* ── Step 2: Amount Display ── */}
          <div className="space-y-2">
            <label className="form-label">Amount</label>
            <div className="stat-card !border-secondary/20 !p-0 overflow-hidden">
              <div className="flex items-center">
                <div className="flex items-center justify-center w-14 h-full bg-secondary/10 self-stretch border-r border-secondary/10">
                  <span className="font-heading text-xl font-bold text-secondary">&#8369;</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="flex-1 bg-transparent px-4 py-4 font-heading text-[28px] font-bold text-text-primary placeholder-text-secondary/30 outline-none"
                />
              </div>
            </div>
            {fieldErrors.amount && (
              <p className="mt-1.5 text-xs text-destructive">{fieldErrors.amount}</p>
            )}
          </div>

          {/* ── Step 3: Payment Method ── */}
          <div className="space-y-3">
            <label className="form-label">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map((m) => {
                const isSelected = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={`glass-card relative flex flex-col items-center gap-2.5 px-4 py-5 text-center transition-all cursor-pointer ${
                      isSelected
                        ? `!border-2 ${m.colorSelected}`
                        : 'hover:border-white/10'
                    }`}
                  >
                    {/* Checkmark overlay */}
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <svg className="h-4 w-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                    )}

                    {/* Icon */}
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${m.colorIcon}`}>
                      {m.icon}
                    </div>

                    {/* Label */}
                    <span className={`font-heading text-[14px] font-bold tracking-wide ${
                      isSelected ? 'text-text-primary' : 'text-text-secondary'
                    }`}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Step 4: Reference Number ── */}
          {NEEDS_REFERENCE.includes(method) && (
            <div className="space-y-2 animate-in">
              <div className="flex items-center gap-2">
                <label className="form-label !mb-0">Reference Number</label>
                <div className="group relative">
                  <svg className="h-4 w-4 text-text-secondary cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 glass-card !rounded-lg p-3 text-xs text-text-secondary z-10">
                    Enter the transaction reference number from your payment receipt
                  </div>
                </div>
              </div>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. 1234567890"
                className={`form-input font-mono ${fieldErrors.reference ? '!border-destructive' : ''}`}
              />
              {fieldErrors.reference && (
                <p className="mt-1.5 text-xs text-destructive">{fieldErrors.reference}</p>
              )}
            </div>
          )}

          {/* ── Step 5: Billing Period ── */}
          <div className="space-y-2">
            <label className="form-label">Billing Period</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs text-text-secondary mb-1.5">Start Date</span>
                <input
                  type="date"
                  value={billingStart}
                  onChange={(e) => setBillingStart(e.target.value)}
                  className={`form-input ${fieldErrors.billingStart ? '!border-destructive' : ''}`}
                />
                {fieldErrors.billingStart && (
                  <p className="mt-1.5 text-xs text-destructive">{fieldErrors.billingStart}</p>
                )}
              </div>
              <div>
                <span className="block text-xs text-text-secondary mb-1.5">End Date</span>
                <input
                  type="date"
                  value={billingEnd}
                  onChange={(e) => setBillingEnd(e.target.value)}
                  className={`form-input ${fieldErrors.billingEnd ? '!border-destructive' : ''}`}
                />
                {fieldErrors.billingEnd && (
                  <p className="mt-1.5 text-xs text-destructive">{fieldErrors.billingEnd}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Step 6: Proof of Payment ── */}
          <div className="space-y-2">
            <label className="form-label">
              Proof of Payment <span className="font-body font-normal text-text-secondary/60 normal-case tracking-normal">(optional)</span>
            </label>
            {proofPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img src={proofPreview} alt="Proof" className="w-full max-h-48 object-cover" />
                <button
                  type="button"
                  onClick={() => { setProofFile(null); setProofPreview(null); }}
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-bg-deep/80 flex items-center justify-center hover:bg-destructive/30 transition-colors cursor-pointer"
                >
                  <svg className="h-4 w-4 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className="glass-card flex flex-col items-center justify-center gap-3 py-10 cursor-pointer hover:border-secondary/20 transition-colors">
                <svg className="h-8 w-8 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                <span className="text-sm text-text-secondary">Click to upload proof of payment</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setProofFile(file);
                      setProofPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
            )}
          </div>

          {/* ── Step 7: Notes ── */}
          <div className="space-y-2">
            <label className="form-label">
              Notes <span className="font-body font-normal text-text-secondary/60 normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional details about your payment..."
              className="form-input resize-none"
            />
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-border" />

          {/* ── Submit Button ── */}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2 !py-4 !text-sm"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Submitting...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Submit Payment
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
