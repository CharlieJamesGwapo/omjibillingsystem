import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { parseISO, isPast } from 'date-fns';
import api from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { Subscription, User, Plan, SubStatus } from '../../lib/types';

interface SubForm {
  user_id: string;
  plan_id: string;
  ip_address: string;
  mac_address: string;
  billing_day: string;
  pppoe_username: string;
  pppoe_password: string;
}

interface FormErrors {
  user_id?: string;
  plan_id?: string;
  billing_day?: string;
  pppoe?: string;
}

const emptyForm: SubForm = {
  user_id: '',
  plan_id: '',
  ip_address: '',
  mac_address: '',
  billing_day: '1',
  pppoe_username: '',
  pppoe_password: '',
};

const LIMIT = 20;

// Spinner component
function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function isDateInPast(dateStr: string | null): boolean {
  if (!dateStr) return false;
  try {
    return isPast(parseISO(dateStr));
  } catch {
    return false;
  }
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SubForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<'all' | SubStatus>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Disconnect confirmation modal state
  const [disconnectTarget, setDisconnectTarget] = useState<Subscription | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Per-row reconnect loading
  const [reconnectingId, setReconnectingId] = useState<string | null>(null);
  // Per-row disconnect loading (for the confirmation modal action)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = async () => {
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filter !== 'all') params.set('status', filter);

      const [subsRes, usersRes, plansRes] = await Promise.all([
        api.get<{ data: Subscription[]; total: number; page: number; limit: number }>(`/subscriptions?${params}`),
        api.get<{ data: User[]; total: number }>('/users?role=customer&limit=1000'),
        api.get<Plan[]>('/plans'),
      ]);
      setSubscriptions(subsRes.data.data ?? []);
      setTotal(subsRes.data.total ?? 0);
      setUsers(usersRes.data.data ?? []);
      setPlans(plansRes.data ?? []);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, filter]);

  const handleFilterChange = (value: 'all' | SubStatus) => {
    setFilter(value);
    setPage(1);
  };

  const validateForm = (): FormErrors => {
    const errors: FormErrors = {};
    if (!form.user_id) errors.user_id = 'Customer is required';
    if (!form.plan_id) errors.plan_id = 'Plan is required';

    const billingDay = Number(form.billing_day);
    if (!form.billing_day || isNaN(billingDay) || !Number.isInteger(billingDay) || billingDay < 1 || billingDay > 28) {
      errors.billing_day = 'Billing day must be a whole number between 1 and 28';
    }

    const hasUsername = form.pppoe_username.trim() !== '';
    const hasPassword = form.pppoe_password.trim() !== '';
    if (hasUsername !== hasPassword) {
      errors.pppoe = 'Both PPPoE username and password must be filled, or both left blank';
    }

    return errors;
  };

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
    setFormErrors({});
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
      pppoe_username: sub.pppoe_username || '',
      pppoe_password: sub.pppoe_password || '',
    });
    setFormErrors({});
    setEditingId(sub.id);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSubmitting(true);
    try {
      const body = {
        user_id: form.user_id,
        plan_id: form.plan_id,
        billing_day: Number(form.billing_day),
        ...(form.ip_address && { ip_address: form.ip_address }),
        ...(form.mac_address && { mac_address: form.mac_address }),
        ...(form.pppoe_username && { pppoe_username: form.pppoe_username }),
        ...(form.pppoe_password && { pppoe_password: form.pppoe_password }),
      };
      if (editingId) {
        await api.put(`/subscriptions/${editingId}`, body);
        toast.success('Subscription updated');
      } else {
        await api.post('/subscriptions', body);
        toast.success('Subscription created');
      }
      setModalOpen(false);
      setLoading(true);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (editingId ? 'Failed to update subscription' : 'Failed to add subscription');
      toast.error(msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDisconnect = (sub: Subscription) => {
    setDisconnectTarget(sub);
  };

  const handleDisconnectConfirmed = async () => {
    if (!disconnectTarget) return;
    setDisconnecting(true);
    setDisconnectingId(disconnectTarget.id);
    try {
      await api.post(`/subscriptions/${disconnectTarget.id}/disconnect`);
      toast.success('Client disconnected');
      setDisconnectTarget(null);
      setLoading(true);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect';
      toast.error(msg);
    } finally {
      setDisconnecting(false);
      setDisconnectingId(null);
    }
  };

  const handleReconnect = async (id: string) => {
    setReconnectingId(id);
    try {
      await api.post(`/subscriptions/${id}/reconnect`);
      toast.success('Client reconnected');
      setLoading(true);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reconnect';
      toast.error(msg);
    } finally {
      setReconnectingId(null);
    }
  };

  const filterButtons: { label: string; value: 'all' | SubStatus }[] = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' as SubStatus },
    { label: 'Overdue', value: 'overdue' as SubStatus },
    { label: 'Suspended', value: 'suspended' as SubStatus },
  ];

  const DueDateCell = ({ sub }: { sub: Subscription }) => {
    const isOverdue = sub.status === 'overdue' && isDateInPast(sub.next_due_date);
    return (
      <span className="flex items-center gap-1.5 flex-wrap">
        <span style={{ fontSize: 13, color: '#64748b' }}>{formatDate(sub.next_due_date)}</span>
        {isOverdue && (
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
          >
            OVERDUE
          </span>
        )}
      </span>
    );
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

      {/* Search */}
      <div className="relative w-full sm:max-w-md animate-in animate-in-1">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Search by customer name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input !pl-11"
        />
      </div>

      {/* Status Filter Pills */}
      <div className="flex gap-2 flex-wrap animate-in animate-in-1">
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => handleFilterChange(btn.value)}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200"
            style={
              filter === btn.value
                ? { background: '#22d3ee', color: '#fff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em', fontSize: 13 }
                : { background: 'rgba(15,26,46,0.6)', border: '1px solid rgba(34,211,238,0.06)', color: '#94a3b8', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em', fontSize: 13 }
            }
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block glass-card animate-in animate-in-2">
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
                    <td><DueDateCell sub={sub} /></td>
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
                            onClick={() => confirmDisconnect(sub)}
                            disabled={disconnectingId === sub.id}
                            className="btn-danger !py-1.5 !px-3 !text-xs flex items-center gap-1.5 disabled:opacity-60"
                            title="Disconnect"
                          >
                            {disconnectingId === sub.id ? (
                              <Spinner className="w-3.5 h-3.5" />
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            )}
                            Disconnect
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReconnect(sub.id)}
                            disabled={reconnectingId === sub.id}
                            className="btn-success !py-1.5 !px-3 !text-xs flex items-center gap-1.5 disabled:opacity-60"
                            title="Reconnect"
                          >
                            {reconnectingId === sub.id ? (
                              <Spinner className="w-3.5 h-3.5" />
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                              </svg>
                            )}
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
                  <DueDateCell sub={sub} />
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
                    onClick={() => confirmDisconnect(sub)}
                    disabled={disconnectingId === sub.id}
                    className="btn-danger !py-2 !px-3 !text-xs flex items-center gap-1.5 flex-1 disabled:opacity-60"
                  >
                    {disconnectingId === sub.id ? (
                      <Spinner className="w-3.5 h-3.5" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    )}
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleReconnect(sub.id)}
                    disabled={reconnectingId === sub.id}
                    className="btn-success !py-2 !px-3 !text-xs flex items-center gap-1.5 flex-1 disabled:opacity-60"
                  >
                    {reconnectingId === sub.id ? (
                      <Spinner className="w-3.5 h-3.5" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                      </svg>
                    )}
                    Reconnect
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm" style={{ color: '#64748b', fontFamily: "'Outfit', sans-serif" }}>
            Showing {Math.min((page - 1) * LIMIT + 1, total)}&ndash;{Math.min(page * LIMIT, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-outline disabled:opacity-30"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * LIMIT >= total}
              className="btn-outline disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {disconnectTarget && (
        <div className="modal-overlay" onClick={() => !disconnecting && setDisconnectTarget(null)}>
          <div className="modal-content !max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#f87171' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <h2 className="page-header" style={{ fontSize: 18, marginBottom: 0 }}>
                  Disconnect {disconnectTarget.user_name}?
                </h2>
              </div>
            </div>
            <p className="text-sm mb-6" style={{ color: '#94a3b8', fontFamily: "'Outfit', sans-serif" }}>
              This will suspend their connection and disable their MikroTik access.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDisconnectTarget(null)}
                disabled={disconnecting}
                className="btn-outline disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnectConfirmed}
                disabled={disconnecting}
                className="btn-danger flex items-center gap-2 disabled:opacity-60"
              >
                {disconnecting && <Spinner className="w-4 h-4" />}
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => !submitting && setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="page-header mb-6" style={{ fontSize: 22 }}>
              {editingId ? 'Edit Subscription' : 'Add Subscription'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Customer */}
              <div>
                <label className="form-label">Customer *</label>
                <select
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                  className={`form-input${formErrors.user_id ? ' !border-red-500' : ''}`}
                >
                  <option value="">Select customer</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
                {formErrors.user_id && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.user_id}</p>
                )}
              </div>

              {/* Plan */}
              <div>
                <label className="form-label">Plan *</label>
                <select
                  value={form.plan_id}
                  onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                  className={`form-input${formErrors.plan_id ? ' !border-red-500' : ''}`}
                >
                  <option value="">Select plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.speed_mbps} Mbps - {formatCurrency(p.price)}
                    </option>
                  ))}
                </select>
                {formErrors.plan_id && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.plan_id}</p>
                )}
              </div>

              {/* IP / MAC */}
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

              {/* PPPoE fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    PPPoE Username <span className="text-[#475569] font-normal text-xs">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.pppoe_username}
                    onChange={(e) => setForm({ ...form, pppoe_username: e.target.value })}
                    placeholder="e.g. client01"
                    className={`form-input${formErrors.pppoe ? ' !border-amber-500' : ''}`}
                  />
                </div>
                <div>
                  <label className="form-label">
                    PPPoE Password <span className="text-[#475569] font-normal text-xs">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.pppoe_password}
                    onChange={(e) => setForm({ ...form, pppoe_password: e.target.value })}
                    placeholder="e.g. password123"
                    className={`form-input${formErrors.pppoe ? ' !border-amber-500' : ''}`}
                  />
                </div>
              </div>
              {formErrors.pppoe && (
                <p className="text-xs text-red-400 -mt-2">{formErrors.pppoe}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Only fill PPPoE fields if the customer connects via PPPoE. Leave blank for IP-based queue management.
              </p>

              {/* Billing Day */}
              <div>
                <label className="form-label">Billing Day (1-28) *</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={form.billing_day}
                  onChange={(e) => setForm({ ...form, billing_day: e.target.value })}
                  className={`form-input${formErrors.billing_day ? ' !border-red-500' : ''}`}
                />
                {formErrors.billing_day && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.billing_day}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  className="btn-outline disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex items-center gap-2 disabled:opacity-60"
                >
                  {submitting && <Spinner className="w-4 h-4" />}
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
