import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import api from '../../lib/api';
import type { Plan } from '../../lib/types';

interface PlanForm {
  name: string;
  speed_mbps: number;
  price: number;
  description: string;
  is_active: boolean;
  mikrotik_profile?: string;
}

const emptyForm: PlanForm = {
  name: '',
  speed_mbps: 0,
  price: 0,
  description: '',
  is_active: true,
  mikrotik_profile: undefined,
};

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleteCheckLoading, setDeleteCheckLoading] = useState(false);
  const [deleteCheckCount, setDeleteCheckCount] = useState(0);

  const fetchPlans = async () => {
    try {
      const res = await api.get<Plan[]>('/plans');
      setPlans(res.data ?? []);
    } catch {
      setError('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setForm({
      name: plan.name,
      speed_mbps: plan.speed_mbps,
      price: plan.price,
      description: plan.description || '',
      is_active: plan.is_active,
      mikrotik_profile: plan.mikrotik_profile || undefined,
    });
    setEditingId(plan.id);
    setModalOpen(true);
  };

  const handleDeleteClick = async (plan: Plan) => {
    setDeleteTarget(plan);
    setDeleteCheckLoading(true);
    try {
      const res = await api.get<{ total: number }>(`/subscriptions?plan_id=${plan.id}&limit=1`);
      setDeleteCheckCount(res.data.total ?? 0);
    } catch {
      setDeleteCheckCount(0);
    } finally {
      setDeleteCheckLoading(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    try {
      await api.delete(`/plans/${plan.id}`);
      setPlans(plans.filter((p) => p.id !== plan.id));
      setDeleteTarget(null);
      toast.success('Plan deleted');
    } catch {
      setError('Failed to delete plan');
      toast.error('Failed — try again');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        speed_mbps: form.speed_mbps,
        price: form.price,
        is_active: form.is_active,
        ...(form.description && { description: form.description }),
        ...(form.mikrotik_profile && { mikrotik_profile: form.mikrotik_profile }),
      };
      if (editingId) {
        await api.put(`/plans/${editingId}`, body);
      } else {
        await api.post('/plans', body);
      }
      setModalOpen(false);
      setLoading(true);
      await fetchPlans();
      toast.success(editingId ? 'Plan updated' : 'Plan created');
    } catch {
      setError(editingId ? 'Failed to update plan' : 'Failed to add plan');
      toast.error('Failed — try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-in">
          <div className="h-8 w-32 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-white/5 animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in animate-in-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-6">
              <div className="h-5 w-32 rounded bg-white/5 animate-pulse mb-4" />
              <div className="h-8 w-24 rounded bg-white/5 animate-pulse mb-3" />
              <div className="h-10 w-40 rounded bg-white/5 animate-pulse mb-4" />
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-in">
        <div>
          <h1 className="page-header">Plans</h1>
          <p className="page-subtitle">Configure internet plans and pricing for your customers</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Plan
        </button>
      </div>

      {error && (
        <div className="glass-card p-4 border-l-4" style={{ borderLeftColor: '#ef4444' }}>
          <div className="flex items-center justify-between">
            <p className="text-[#f87171] text-sm">{error}</p>
            <button onClick={() => setError('')} className="text-[#f87171] hover:text-[#fca5a5] text-lg leading-none">&times;</button>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      {(() => {
        const sortedPlans = [...plans].sort((a, b) => Number(a.price) - Number(b.price));
        return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in animate-in-1">
        {sortedPlans.length === 0 ? (
          <div className="col-span-full glass-card p-12 text-center">
            <svg className="w-14 h-14 text-[#334155] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <p className="text-sm text-[#64748b] mb-3">No internet plans found</p>
            <button onClick={openAdd} className="btn-primary flex items-center gap-2 mt-2 mx-auto">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create First Plan
            </button>
          </div>
        ) : (
          sortedPlans.map((plan) => (
            <div key={plan.id} className="glass-card p-6 flex flex-col">
              {/* Plan Name */}
              <div className="flex items-start justify-between mb-4">
                <h3
                  className="font-bold"
                  style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 20, color: '#f1f5f9' }}
                >
                  {plan.name}
                </h3>
                <span className={`badge ${plan.is_active ? 'badge-active' : 'badge-inactive'}`}>
                  {plan.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Speed Badge */}
              <div className="mb-4">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
                  style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontFamily: "'Rajdhani', sans-serif", fontSize: 13, fontWeight: 600 }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  {plan.speed_mbps} Mbps
                </span>
              </div>

              {/* Price */}
              <div className="mb-4">
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 32, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                  {formatCurrency(plan.price)}
                </span>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>/mo</span>
              </div>

              {/* Description */}
              {plan.description ? (
                <p className="flex-1 mb-4 leading-relaxed" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }} title={plan.description.length > 30 ? plan.description : undefined}>
                  {plan.description.length > 30 ? `${plan.description.slice(0, 30)}…` : plan.description}
                </p>
              ) : (
                <div className="flex-1" />
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
                <button
                  onClick={() => openEdit(plan)}
                  className="btn-outline !py-2 !px-3 !text-xs flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteClick(plan)}
                  className="btn-danger !py-2 !px-3 !text-xs flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="modal-overlay"
          style={{ background: 'rgba(239,68,68,0.08)' }}
          onClick={() => { setDeleteTarget(null); setDeleteCheckCount(0); }}
        >
          <div
            className="modal-content !border-destructive/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <h2 className="font-heading text-xl font-bold text-text-primary">
                Delete plan {deleteTarget.name}?
              </h2>
              <p className="text-text-secondary text-sm mt-2">
                This cannot be undone. Active subscriptions on this plan will not be affected.
              </p>
            </div>
            {deleteCheckLoading ? (
              <div className="mb-4 flex items-center justify-center gap-2 text-sm text-[#64748b]">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Checking active subscriptions…
              </div>
            ) : deleteCheckCount > 0 ? (
              <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-sm text-red-400">
                  ⚠️ This plan has {deleteCheckCount} active subscription{deleteCheckCount > 1 ? 's' : ''}. Deleting it will not affect existing subscriptions but new ones cannot use this plan.
                </p>
              </div>
            ) : null}
            <div className="flex justify-center gap-3">
              <button onClick={() => { setDeleteTarget(null); setDeleteCheckCount(0); }} className="btn-outline">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteTarget)} className="btn-danger">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="page-header mb-6" style={{ fontSize: 22 }}>
              {editingId ? 'Edit Plan' : 'Add Plan'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="form-label">Plan Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Speed (Mbps) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={form.speed_mbps || ''}
                    onChange={(e) => setForm({ ...form, speed_mbps: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Price (P) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={0.01}
                    value={form.price || ''}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="form-input"
                  style={{ resize: 'none' }}
                />
              </div>
              <div>
                <label className="form-label">
                  MikroTik Profile <span className="text-[#475569] font-normal text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.mikrotik_profile ?? ''}
                  onChange={(e) => setForm((f: PlanForm) => ({ ...f, mikrotik_profile: e.target.value || undefined }))}
                  placeholder="e.g. PLAN10M"
                  className="form-input"
                />
                <p className="text-xs mt-1" style={{ color: '#475569' }}>
                  Must match the PPPoE profile name in MikroTik exactly
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#22d3ee' }}
                />
                <label htmlFor="is_active" className="form-label !mb-0">Active</label>
              </div>
              <div className="flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
