import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';
import type { User, UserStatus } from '../../lib/types';

interface CustomerForm {
  full_name: string;
  phone: string;
  password: string;
  email: string;
  address: string;
  status: 'active' | 'inactive';
  latitude: string;
  longitude: string;
}

const emptyForm: CustomerForm = {
  full_name: '',
  phone: '',
  password: '',
  email: '',
  address: '',
  status: 'active',
  latitude: '',
  longitude: '',
};

const LIMIT = 20;

export default function Customers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [geoLoading, setGeoLoading] = useState(false);
  const geoRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams({
        role: 'customer',
        page: String(page),
        limit: String(LIMIT),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get<{ data: User[]; total: number; page: number; limit: number }>(`/users?${params}`);
      setUsers(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      setError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchUsers();
  }, [page, debouncedSearch, statusFilter]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setForm({
      full_name: user.full_name,
      phone: user.phone,
      password: '',
      email: user.email || '',
      address: user.address || '',
      status: user.status || 'active',
      latitude: user.latitude != null ? String(user.latitude) : '',
      longitude: user.longitude != null ? String(user.longitude) : '',
    });
    setEditingId(user.id);
    setModalOpen(true);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setGeoLoading(true);
    geoRef.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!geoRef.current) return;
        setForm(f => ({
          ...f,
          latitude: String(pos.coords.latitude.toFixed(7)),
          longitude: String(pos.coords.longitude.toFixed(7)),
        }));
        setGeoLoading(false);
        toast.success('Location captured');
      },
      (err) => {
        if (!geoRef.current) return;
        setGeoLoading(false);
        toast.error('Could not get location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        const body: Record<string, unknown> = {
          full_name: form.full_name,
          phone: form.phone,
          status: form.status,
        };
        if (form.email) body.email = form.email;
        if (form.address) body.address = form.address;
        if (form.password) body.password = form.password;
        if (form.latitude && form.longitude) {
          body.latitude = parseFloat(form.latitude);
          body.longitude = parseFloat(form.longitude);
        }
        await api.put(`/users/${editingId}`, body);
      } else {
        await api.post('/users', {
          full_name: form.full_name,
          phone: form.phone,
          password: form.password,
          role: 'customer',
          ...(form.email && { email: form.email }),
          ...(form.address && { address: form.address }),
        });
      }
      setModalOpen(false);
      setLoading(true);
      await fetchUsers();
      toast.success(editingId ? 'Customer updated' : 'Customer created');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || (editingId ? 'Failed to update customer' : 'Failed to add customer');
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      setLoading(true);
      await fetchUsers();
      toast.success('Customer deleted');
    } catch {
      toast.error('Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  const statusBadge = (status: UserStatus) => {
    const cls: Record<string, string> = {
      active: 'badge badge-active',
      inactive: 'badge badge-inactive',
    };
    return <span className={cls[status] || 'badge'}>{status}</span>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-in">
          <div className="h-8 w-40 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-white/5 animate-pulse mt-2" />
        </div>
        <div className="h-11 w-full max-w-md rounded-xl bg-white/5 animate-pulse animate-in animate-in-1" />
        <div className="glass-card p-0 animate-in animate-in-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 border-b border-white/[0.03] mx-4 flex items-center">
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
          <h1 className="page-header">Customers</h1>
          <p className="page-subtitle">Manage your customer accounts and information</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Customer
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

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-2 animate-in animate-in-1">
        {(['all', 'active', 'inactive'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              statusFilter === s
                ? 'bg-secondary text-[#060a13]'
                : 'bg-white/5 text-[#64748b] hover:bg-white/8 hover:text-[#94a3b8]'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-md animate-in animate-in-1">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input !pl-11"
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block glass-card animate-in animate-in-2">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Address</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="!text-center !py-16">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-12 h-12 text-[#334155]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                      </svg>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>No customers found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="!font-semibold !text-[#f1f5f9]">{user.full_name}</td>
                    <td><span className="font-mono text-xs">{user.phone}</span></td>
                    <td>{user.email || <span className="text-[#334155]">--</span>}</td>
                    <td>
                      {user.address
                        ? <span title={user.address}>{user.address.length > 20 ? user.address.slice(0, 20) + '…' : user.address}</span>
                        : <span className="text-[#334155]">--</span>}
                    </td>
                    <td>
                      {user.latitude != null && user.longitude != null ? (
                        <a
                          href={`https://maps.google.com/?q=${user.latitude},${user.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${user.latitude.toFixed(5)}, ${user.longitude.toFixed(5)}`}
                          className="inline-flex items-center gap-1 text-[#22d3ee] hover:text-[#67e8f9] transition-colors text-xs"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                          </svg>
                          Maps
                        </a>
                      ) : (
                        <span className="text-[#334155]">--</span>
                      )}
                    </td>
                    <td>{statusBadge(user.status)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(user)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-[#64748b] hover:text-[#22d3ee] transition-colors"
                          title="Edit customer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-[#64748b] hover:text-[#f87171] transition-colors"
                          title="Delete customer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
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
      <div className="md:hidden space-y-3 animate-in animate-in-2">
        {users.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <svg className="w-12 h-12 text-[#334155] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>No customers found</p>
          </div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="glass-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-[#f1f5f9]" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 16 }}>{user.full_name}</p>
                  <p className="font-mono text-xs text-[#64748b] mt-0.5">{user.phone}</p>
                </div>
                <div className="flex items-center gap-1">
                  {statusBadge(user.status)}
                  <button onClick={() => openEdit(user)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-[#64748b] hover:text-[#22d3ee] transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                  </button>
                  <button onClick={() => setDeleteTarget(user)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-[#64748b] hover:text-[#f87171] transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                  </button>
                </div>
              </div>
              {user.email && (
                <p className="text-xs text-[#64748b]" style={{ fontFamily: "'Outfit', sans-serif" }}>{user.email}</p>
              )}
              {user.address && (
                <p className="text-xs text-[#64748b] mt-0.5" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {user.address.length > 30 ? user.address.slice(0, 30) + '…' : user.address}
                </p>
              )}
              {user.latitude != null && user.longitude != null && (
                <a
                  href={`https://maps.google.com/?q=${user.latitude},${user.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#22d3ee] text-xs mt-1 hover:underline"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  View on Maps
                </a>
              )}
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <svg className="w-7 h-7 text-[#f87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <h2 className="page-header" style={{ fontSize: 20 }}>Delete {deleteTarget.full_name}?</h2>
              <p className="text-sm mt-2" style={{ color: '#94a3b8', fontFamily: "'Outfit',sans-serif" }}>
                This cannot be undone. The customer's subscriptions and payment history will remain.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-outline" disabled={deleting}>Cancel</button>
              <button onClick={handleDelete} className="btn-danger" disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="page-header mb-6" style={{ fontSize: 22 }}>
              {editingId ? 'Edit Customer' : 'Add Customer'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Phone *</label>
                <input
                  type="text"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">
                  Password {editingId ? '(leave blank to keep)' : '*'}
                </label>
                <input
                  type="password"
                  required={!editingId}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="form-input"
                />
              </div>
              {editingId && (
                <div>
                  <label className="form-label">
                    GPS Coordinates
                    <span className="ml-2 text-[#475569] text-xs font-normal">(for technician navigation)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Latitude"
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                      className="form-input flex-1"
                    />
                    <input
                      type="text"
                      placeholder="Longitude"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                      className="form-input flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={geoLoading}
                      title="Use my current location"
                      className="w-10 h-10 flex-shrink-0 rounded-lg flex items-center justify-center border border-white/10 bg-white/5 hover:bg-white/10 text-[#22d3ee] disabled:opacity-40 transition-all"
                    >
                      {geoLoading ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {form.latitude && form.longitude && (
                    <a
                      href={`https://maps.google.com/?q=${form.latitude},${form.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#22d3ee] text-xs mt-1.5 hover:underline"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      Preview on Google Maps
                    </a>
                  )}
                </div>
              )}
              {editingId && (
                <div>
                  <label className="form-label">Status</label>
                  <div className="flex gap-3 mt-1">
                    {(['active', 'inactive'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, status: s }))}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                          form.status === s
                            ? s === 'active' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-red-500/15 border-red-500/40 text-red-400'
                            : 'bg-transparent border-white/10 text-[#64748b] hover:border-white/20'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
