import { useState, useEffect } from 'react';
import api from '../../lib/api';
import type { User, UserStatus } from '../../lib/types';

interface CustomerForm {
  full_name: string;
  phone: string;
  password: string;
  email: string;
  address: string;
}

const emptyForm: CustomerForm = {
  full_name: '',
  phone: '',
  password: '',
  email: '',
  address: '',
};

export default function Customers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await api.get<User[]>('/users');
      setUsers((res.data ?? []).filter((u) => u.role === 'customer'));
    } catch {
      setError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase())
  );

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
    });
    setEditingId(user.id);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        const body: Record<string, string> = {
          full_name: form.full_name,
          phone: form.phone,
        };
        if (form.email) body.email = form.email;
        if (form.address) body.address = form.address;
        if (form.password) body.password = form.password;
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
    } catch {
      setError(editingId ? 'Failed to update customer' : 'Failed to add customer');
    } finally {
      setSubmitting(false);
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
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="!text-center !py-16">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-12 h-12 text-[#334155]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                      </svg>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>No customers found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id}>
                    <td className="!font-semibold !text-[#f1f5f9]">{user.full_name}</td>
                    <td><span className="font-mono text-xs">{user.phone}</span></td>
                    <td>{user.email || <span className="text-[#334155]">--</span>}</td>
                    <td>{statusBadge(user.status)}</td>
                    <td>
                      <button
                        onClick={() => openEdit(user)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-[#64748b] hover:text-[#22d3ee] transition-colors"
                        title="Edit customer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>No customers found</p>
          </div>
        ) : (
          filtered.map((user) => (
            <div key={user.id} className="glass-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-[#f1f5f9]" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 16 }}>{user.full_name}</p>
                  <p className="font-mono text-xs text-[#64748b] mt-0.5">{user.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(user.status)}
                  <button
                    onClick={() => openEdit(user)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-[#64748b] hover:text-[#22d3ee] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>
                </div>
              </div>
              {user.email && (
                <p className="text-xs text-[#64748b]" style={{ fontFamily: "'Outfit', sans-serif" }}>{user.email}</p>
              )}
            </div>
          ))
        )}
      </div>

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
