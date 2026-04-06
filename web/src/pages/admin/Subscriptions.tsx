import { useState, useEffect } from 'react';
import api from '../../lib/api';
import type { Subscription, User, Plan, SubStatus } from '../../lib/types';

interface SubForm {
  user_id: string;
  plan_id: string;
  ip_address: string;
  mac_address: string;
  billing_day: string;
}

const emptyForm: SubForm = {
  user_id: '',
  plan_id: '',
  ip_address: '',
  mac_address: '',
  billing_day: '1',
};

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SubForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [subsRes, usersRes, plansRes] = await Promise.all([
        api.get<Subscription[]>('/subscriptions'),
        api.get<User[]>('/users'),
        api.get<Plan[]>('/plans'),
      ]);
      setSubscriptions(subsRes.data ?? []);
      setUsers((usersRes.data ?? []).filter((u) => u.role === 'customer'));
      setPlans(plansRes.data ?? []);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const formatDate = (date: string) =>
    date
      ? new Date(date).toLocaleDateString('en-PH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '-';

  const statusBadge = (status: SubStatus) => {
    const cls: Record<string, string> = {
      active: 'badge badge-active',
      overdue: 'badge badge-overdue',
      suspended: 'badge badge-suspended',
    };
    return <span className={cls[status] || 'badge'}>{status}</span>;
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (sub: Subscription) => {
    setForm({
      user_id: sub.user_id,
      plan_id: sub.plan_id,
      ip_address: sub.ip_address || '',
      mac_address: sub.mac_address || '',
      billing_day: String(sub.billing_day),
    });
    setEditingId(sub.id);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = {
        user_id: form.user_id,
        plan_id: form.plan_id,
        billing_day: Number(form.billing_day),
        ...(form.ip_address && { ip_address: form.ip_address }),
        ...(form.mac_address && { mac_address: form.mac_address }),
      };
      if (editingId) {
        await api.put(`/subscriptions/${editingId}`, body);
      } else {
        await api.post('/subscriptions', body);
      }
      setModalOpen(false);
      setLoading(true);
      await fetchData();
    } catch {
      setError(editingId ? 'Failed to update subscription' : 'Failed to add subscription');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm('Disconnect this subscription?')) return;
    try {
      await api.post(`/subscriptions/${id}/disconnect`);
      setLoading(true);
      await fetchData();
    } catch {
      setError('Failed to disconnect');
    }
  };

  const handleReconnect = async (id: string) => {
    try {
      await api.post(`/subscriptions/${id}/reconnect`);
      setLoading(true);
      await fetchData();
    } catch {
      setError('Failed to reconnect');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-in">
          <div className="h-8 w-48 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-72 rounded-lg bg-white/5 animate-pulse mt-2" />
        </div>
        <div className="glass-card p-0 animate-in animate-in-1">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-in">
        <div>
          <h1 className="page-header">Subscriptions</h1>
          <p className="page-subtitle">Manage customer subscriptions, connections, and billing cycles</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Subscription
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

      {/* Desktop Table */}
      <div className="hidden lg:block glass-card animate-in animate-in-1">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>Speed</th>
                <th>Price</th>
                <th>IP Address</th>
                <th>Status</th>
                <th>Billing Day</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="!text-center !py-16">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-12 h-12 text-[#334155]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                      </svg>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>No subscriptions found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="!font-semibold !text-[#f1f5f9]">{sub.user_name}</td>
                    <td>{sub.plan_name}</td>
                    <td>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5"
                        style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontFamily: "'Rajdhani', sans-serif", fontSize: 12, fontWeight: 600 }}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                        {sub.plan_speed ?? 0} Mbps
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: '#f1f5f9' }}>
                        {formatCurrency(sub.plan_price ?? 0)}
                      </span>
                    </td>
                    <td>
                      {sub.ip_address ? (
                        <span className="font-mono text-xs px-2 py-1 rounded" style={{ background: 'rgba(15,23,41,0.8)', color: '#64748b' }}>
                          {sub.ip_address}
                        </span>
                      ) : (
                        <span className="text-[#334155]">--</span>
                      )}
                    </td>
                    <td>{statusBadge(sub.status)}</td>
                    <td>
                      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: '#cbd5e1' }}>
                        {sub.billing_day}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: '#64748b' }}>{formatDate(sub.next_due_date)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(sub)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-[#64748b] hover:text-[#22d3ee] transition-colors"
                          title="Edit subscription"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        {sub.status === 'active' || sub.status === 'overdue' ? (
                          <button
                            onClick={() => handleDisconnect(sub.id)}
                            className="btn-danger !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                            title="Disconnect"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Disconnect
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReconnect(sub.id)}
                            className="btn-success !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                            title="Reconnect"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                            </svg>
                            Reconnect
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="lg:hidden space-y-3 animate-in animate-in-1">
        {subscriptions.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <svg className="w-12 h-12 text-[#334155] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
            </svg>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>No subscriptions found</p>
          </div>
        ) : (
          subscriptions.map((sub) => (
            <div key={sub.id} className="glass-card p-4">
              {/* Top row: name + status */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-[#f1f5f9]" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 16 }}>
                    {sub.user_name}
                  </p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: '#64748b' }}>
                    {sub.plan_name}
                  </p>
                </div>
                {statusBadge(sub.status)}
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="form-label !text-[10px] !mb-1">Speed</p>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                    style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontFamily: "'Rajdhani', sans-serif", fontSize: 12, fontWeight: 600 }}
                  >
                    {sub.plan_speed ?? 0} Mbps
                  </span>
                </div>
                <div>
                  <p className="form-label !text-[10px] !mb-1">Price</p>
                  <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>
                    {formatCurrency(sub.plan_price ?? 0)}
                  </span>
                </div>
                <div>
                  <p className="form-label !text-[10px] !mb-1">IP Address</p>
                  {sub.ip_address ? (
                    <span className="font-mono text-xs text-[#64748b]">{sub.ip_address}</span>
                  ) : (
                    <span className="text-[#334155] text-xs">--</span>
                  )}
                </div>
                <div>
                  <p className="form-label !text-[10px] !mb-1">Billing Day</p>
                  <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: 14, color: '#cbd5e1' }}>
                    {sub.billing_day}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="form-label !text-[10px] !mb-1">Due Date</p>
                  <span style={{ fontSize: 13, color: '#64748b' }}>{formatDate(sub.next_due_date)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
                <button
                  onClick={() => openEdit(sub)}
                  className="btn-outline !py-2 !px-3 !text-xs flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                  Edit
                </button>
                {sub.status === 'active' || sub.status === 'overdue' ? (
                  <button
                    onClick={() => handleDisconnect(sub.id)}
                    className="btn-danger !py-2 !px-3 !text-xs flex items-center gap-1.5 flex-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleReconnect(sub.id)}
                    className="btn-success !py-2 !px-3 !text-xs flex items-center gap-1.5 flex-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                    </svg>
                    Reconnect
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="page-header mb-6" style={{ fontSize: 22 }}>
              {editingId ? 'Edit Subscription' : 'Add Subscription'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="form-label">Customer *</label>
                <select
                  required
                  value={form.user_id || ''}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                  className="form-input"
                >
                  <option value="">Select customer</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Plan *</label>
                <select
                  required
                  value={form.plan_id || ''}
                  onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                  className="form-input"
                >
                  <option value="">Select plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.speed_mbps} Mbps - {formatCurrency(p.price)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">IP Address</label>
                  <input
                    type="text"
                    value={form.ip_address}
                    onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                    placeholder="192.168.1.x"
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">MAC Address</label>
                  <input
                    type="text"
                    value={form.mac_address}
                    onChange={(e) => setForm({ ...form, mac_address: e.target.value })}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    className="form-input"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Billing Day (1-28) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={28}
                  value={form.billing_day}
                  onChange={(e) => setForm({ ...form, billing_day: e.target.value })}
                  className="form-input"
                />
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
