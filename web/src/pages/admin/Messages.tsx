import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../../lib/api';

/* ─── parseVariables helper ─── */
function parseVariables(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === 'string' && v.trim()) {
    // Try JSON first: ["name","phone"]
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p;
    } catch {}
    // Fall back to comma-separated: "name,phone,amount"
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/* ─── Types ─── */
interface Customer {
  id: string;
  full_name: string;
  phone: string;
  status?: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  type: string;
  subject?: string;
  body: string;
  variables: unknown; // backend sends string or array — use parseVariables()
}

interface MessageRecord {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  type: string;
  message: string;
  status: 'sent' | 'failed' | 'pending';
  batch_id?: string;
  created_at: string;
}

type Tab = 'send' | 'history' | 'templates';
type SendMode = 'individual' | 'group' | 'template';
type GroupFilter = 'all' | 'active' | 'overdue' | 'suspended';
type HistoryFilter = 'all' | 'sent' | 'failed' | 'pending';

/* ─── Helpers ─── */
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const groupFilterLabels: Record<GroupFilter, string> = {
  all: 'All Subscribers',
  active: 'Active Only',
  overdue: 'Overdue Only',
  suspended: 'Suspended Only',
};

function highlightVariables(text: string) {
  const parts = text.split(/({{[^}]+}})/g);
  return parts.map((part, i) =>
    part.startsWith('{{') ? (
      <span key={i} className="text-secondary font-semibold">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/* ─── Spinner ─── */
function Spinner({ size = 4 }: { size?: number }) {
  return (
    <span
      className={`inline-block w-${size} h-${size} border-2 border-white/30 border-t-white rounded-full animate-spin`}
    />
  );
}

/* ─── Confirmation Modal ─── */
function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading text-lg font-bold text-text-primary mb-2">{title}</h3>
        <p className="text-sm text-[#94a3b8] mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-outline" disabled={loading}>
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-primary" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Sending...
              </span>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Template Edit Modal ─── */
function TemplateEditModal({
  template,
  onClose,
  onSaved,
}: {
  template: MessageTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setSubject(template.subject || '');
      setBody(template.body);
    }
  }, [template]);

  if (!template) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/messages/templates/${template.id}`, { subject, body });
      toast.success('Template saved successfully');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const vars = parseVariables(template.variables);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading text-lg font-bold text-text-primary mb-4">Edit Template</h3>

        <div className="space-y-4">
          <div>
            <label className="form-label">Template Name</label>
            <input
              className="form-input !bg-[rgba(15,23,41,0.4)] !text-[#64748b]"
              value={template.name}
              readOnly
            />
          </div>
          <div>
            <label className="form-label">Subject</label>
            <input
              className="form-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Message subject"
            />
          </div>
          <div>
            <label className="form-label">Body</label>
            <textarea
              className="form-input"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Template body..."
            />
          </div>
          {vars.length > 0 && (
            <div>
              <label className="form-label">Available Variables</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {vars.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="btn-outline" disabled={saving}>
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Saving...
              </span>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Loading Skeleton ─── */
function Skeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-44 rounded-lg bg-white/5 animate-pulse" />
        <div className="h-4 w-72 rounded-lg bg-white/5 animate-pulse mt-2" />
      </div>
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 w-28 rounded-full bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="glass-card p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    sent: 'badge badge-approved',
    failed: 'badge badge-rejected',
    pending: 'badge badge-pending',
  };
  return <span className={cls[status] || 'badge'}>{status}</span>;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="badge" style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc' }}>
      {type}
    </span>
  );
}

/* ─── Main Component ─── */
export default function Messages() {
  const [tab, setTab] = useState<Tab>('send');
  const [loading, setLoading] = useState(true);

  // Send tab state
  const [sendMode, setSendMode] = useState<SendMode>('individual');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<Customer | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [message, setMessage] = useState('');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Quick actions state
  const [quickLoading, setQuickLoading] = useState<string | null>(null);
  const [quickResult, setQuickResult] = useState<
    Record<string, { type: 'success' | 'error'; message: string }>
  >({});
  const [showWelcomeDropdown, setShowWelcomeDropdown] = useState(false);

  // History tab state
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null);

  // Template tab state
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  /* ─── Data Loading ─── */
  const fetchCustomers = useCallback(async () => {
    try {
      const res = await api.get<{ data: Customer[] | null }>('/users?role=customer&limit=200');
      setCustomers(res.data.data ?? []);
    } catch {
      /* silently fail */
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get<MessageTemplate[]>('/messages/templates');
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* silently fail */
    }
  }, []);

  const fetchHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await api.get<{ data: MessageRecord[] | null; total?: number }>(
        `/messages?page=${page}&limit=20`
      );
      const data = res.data.data ?? [];
      setMessages(data);
      setHistoryTotal(res.data.total ?? data.length);
    } catch {
      /* silently fail */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchCustomers(), fetchTemplates()]).finally(() => setLoading(false));
  }, [fetchCustomers, fetchTemplates]);

  useEffect(() => {
    if (tab === 'history') {
      setHistoryPage(1);
      fetchHistory(1);
    }
  }, [tab, fetchHistory]);

  /* ─── Subscriber Count ─── */
  useEffect(() => {
    const filtered = customers.filter((c) => {
      if (groupFilter === 'all') return true;
      return c.status === groupFilter;
    });
    setSubscriberCount(filtered.length);
  }, [groupFilter, customers]);

  /* ─── Search ─── */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = customers
      .filter((c) => c.full_name.toLowerCase().includes(q) || c.phone.includes(q))
      .slice(0, 8);
    setSearchResults(results);
    setShowDropdown(results.length > 0);
  }, [searchQuery, customers]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ─── Send Handlers ─── */
  const handleSendIndividual = async () => {
    if (!selectedRecipient || !message.trim()) return;
    setSending(true);
    try {
      await api.post('/messages/send', {
        recipient_id: selectedRecipient.id,
        message: message.trim(),
      });
      toast.success(`Message sent to ${selectedRecipient.full_name}`);
      setMessage('');
      setSelectedRecipient(null);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendGroup = async () => {
    setSending(true);
    try {
      const res = await api.post<{ sent: number; failed: number }>('/messages/bulk', {
        filter: groupFilter,
        message: message.trim(),
      });
      const d = res.data;
      toast.success(`${d?.sent ?? 0} sent, ${d?.failed ?? 0} failed`);
      setMessage('');
    } catch {
      toast.error('Failed to send group message');
    } finally {
      setSending(false);
      setConfirmModal(null);
    }
  };

  const handleSendTemplate = async () => {
    setSending(true);
    try {
      const res = await api.post<{ sent: number; failed: number }>('/messages/template', {
        template: selectedTemplateId,
        filter: groupFilter,
      });
      const d = res.data;
      toast.success(`Template sent: ${d?.sent ?? 0} sent, ${d?.failed ?? 0} failed`);
    } catch {
      toast.error('Failed to send template');
    } finally {
      setSending(false);
      setConfirmModal(null);
    }
  };

  /* ─── Quick Actions ─── */
  const handleQuickAction = async (action: string, payload?: Record<string, string>) => {
    setQuickLoading(action);
    setQuickResult((prev) => {
      const next = { ...prev };
      delete next[action];
      return next;
    });
    try {
      let res;
      if (action === 'send-reminders') {
        res = await api.post<{ sent: number; failed: number }>('/notifications/send-reminders', {});
      } else if (action === 'send-overdue') {
        res = await api.post<{ sent: number; failed: number }>('/messages/template', {
          template: 'overdue_notice',
          filter: 'overdue',
        });
      } else if (action === 'send-welcome' && payload?.customer_id) {
        res = await api.post<{ sent: number; failed: number }>('/messages/send', {
          recipient_id: payload.customer_id,
          message: 'Welcome to OMJI Internet! Your account has been set up successfully.',
        });
      } else {
        res = await api.post<{ sent: number; failed: number }>(`/messages/${action}`, payload);
      }
      const d = res.data;
      const msg = `${d?.sent ?? 0} sent, ${d?.failed ?? 0} failed`;
      setQuickResult((prev) => ({
        ...prev,
        [action]: { type: 'success', message: msg },
      }));
      toast.success(msg);
    } catch {
      setQuickResult((prev) => ({
        ...prev,
        [action]: { type: 'error', message: 'Action failed' },
      }));
      toast.error('Action failed');
    } finally {
      setQuickLoading(null);
    }
  };

  /* ─── Tabs config ─── */
  const tabs: { label: string; value: Tab; icon: React.ReactNode }[] = [
    {
      label: 'Send Message',
      value: 'send',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
        </svg>
      ),
    },
    {
      label: 'History',
      value: 'history',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: 'Templates',
      value: 'templates',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      ),
    },
  ];

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  /* ─── History pagination ─── */
  const totalPages = Math.max(1, Math.ceil(historyTotal / 20));
  const filteredHistory = historyFilter === 'all' ? messages : messages.filter((m) => m.status === historyFilter);

  const historyFilterButtons: { label: string; value: HistoryFilter; count: number }[] = [
    { label: 'All', value: 'all', count: messages.length },
    { label: 'Sent', value: 'sent', count: messages.filter((m) => m.status === 'sent').length },
    { label: 'Failed', value: 'failed', count: messages.filter((m) => m.status === 'failed').length },
    { label: 'Pending', value: 'pending', count: messages.filter((m) => m.status === 'pending').length },
  ];

  if (loading) return <Skeleton />;

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="page-header">Messages</h1>
        <p className="page-subtitle">Send notifications and manage message templates</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer"
            style={
              tab === t.value
                ? {
                    background: '#22d3ee',
                    color: '#fff',
                    fontFamily: "'Rajdhani', sans-serif",
                    letterSpacing: '0.05em',
                    fontSize: 13,
                  }
                : {
                    background: 'rgba(15,26,46,0.6)',
                    border: '1px solid rgba(34,211,238,0.06)',
                    color: '#94a3b8',
                    fontFamily: "'Rajdhani', sans-serif",
                    letterSpacing: '0.05em',
                    fontSize: 13,
                  }
            }
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ═══ TAB: SEND MESSAGE ═══ */}
      {tab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Left: Compose (2/3 width on desktop) ─── */}
          <div className="lg:col-span-2 glass-card p-6">
            <h2
              className="font-heading text-base font-bold text-text-primary mb-4 tracking-wide"
              style={{ fontFamily: "'Rajdhani', sans-serif" }}
            >
              Compose Message
            </h2>

            {/* Send Mode Toggle — pill buttons */}
            <div
              className="flex rounded-lg overflow-hidden mb-6"
              style={{ background: 'rgba(15,26,46,0.6)', border: '1px solid rgba(34,211,238,0.06)' }}
            >
              {(['individual', 'group', 'template'] as SendMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setSendMode(mode);
                    setMessage('');
                  }}
                  className="flex-1 py-2.5 text-sm font-semibold transition-all duration-200 capitalize cursor-pointer"
                  style={
                    sendMode === mode
                      ? {
                          background: 'rgba(34,211,238,0.12)',
                          color: '#22d3ee',
                          fontFamily: "'Rajdhani', sans-serif",
                          letterSpacing: '0.05em',
                        }
                      : {
                          color: '#64748b',
                          fontFamily: "'Rajdhani', sans-serif",
                          letterSpacing: '0.05em',
                        }
                  }
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* ── Individual Mode ── */}
            {sendMode === 'individual' && (
              <div className="space-y-4">
                <div>
                  <label className="form-label">Recipient</label>
                  {selectedRecipient ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                        style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}
                      >
                        <span className="font-semibold">{selectedRecipient.full_name}</span>
                        <span className="text-[#64748b]">{selectedRecipient.phone}</span>
                        <button
                          onClick={() => {
                            setSelectedRecipient(null);
                            setSearchQuery('');
                          }}
                          className="ml-1 text-[#64748b] hover:text-[#f87171] cursor-pointer"
                        >
                          &times;
                        </button>
                      </span>
                    </div>
                  ) : (
                    <div className="relative" ref={searchRef}>
                      <input
                        className="form-input"
                        placeholder="Search by name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                      />
                      {showDropdown && searchResults.length > 0 && (
                        <div
                          className="absolute z-20 w-full mt-1 rounded-lg overflow-hidden shadow-xl max-h-56 overflow-y-auto"
                          style={{ background: '#0f1a2e', border: '1px solid rgba(34,211,238,0.1)' }}
                        >
                          {searchResults.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setSelectedRecipient(c);
                                setSearchQuery('');
                                setShowDropdown(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgba(34,211,238,0.06)] transition-colors text-left cursor-pointer"
                            >
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                style={{
                                  background: 'rgba(34,211,238,0.1)',
                                  color: '#22d3ee',
                                  fontFamily: "'Rajdhani', sans-serif",
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {c.full_name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#f1f5f9]">{c.full_name}</p>
                                <p className="text-xs text-[#64748b]">{c.phone}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 160))}
                    placeholder="Type your message..."
                  />
                  <p
                    className="mt-1 text-xs"
                    style={{ color: message.length >= 150 ? '#f59e0b' : '#475569' }}
                  >
                    {message.length}/160 characters
                  </p>
                </div>

                <button
                  onClick={handleSendIndividual}
                  disabled={!selectedRecipient || !message.trim() || sending}
                  className="btn-primary w-full disabled:opacity-40 min-h-[44px]"
                >
                  {sending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner />
                      Sending...
                    </span>
                  ) : (
                    'Send Message'
                  )}
                </button>
              </div>
            )}

            {/* ── Group Mode ── */}
            {sendMode === 'group' && (
              <div className="space-y-4">
                <div>
                  <label className="form-label">Filter Recipients</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(Object.keys(groupFilterLabels) as GroupFilter[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setGroupFilter(f)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
                        style={
                          groupFilter === f
                            ? { background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' }
                            : { background: 'rgba(15,26,46,0.6)', color: '#64748b', border: '1px solid rgba(34,211,238,0.06)' }
                        }
                      >
                        {groupFilterLabels[f]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-sm font-medium" style={{ color: '#22d3ee' }}>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}
                    >
                      {subscriberCount}
                    </span>
                    {' '}subscriber{subscriberCount !== 1 ? 's' : ''} will receive this message
                  </p>
                </div>

                <div>
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                  />
                  <p className="mt-1 text-xs text-[#475569]">{message.length} characters</p>
                </div>

                <button
                  onClick={() =>
                    setConfirmModal({
                      title: 'Send Group Message',
                      message: `Send this message to ${subscriberCount} subscriber${subscriberCount !== 1 ? 's' : ''}?`,
                      onConfirm: handleSendGroup,
                    })
                  }
                  disabled={!message.trim() || subscriberCount === 0 || sending}
                  className="btn-primary w-full disabled:opacity-40 min-h-[44px]"
                >
                  Send to {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''}
                </button>
              </div>
            )}

            {/* ── Template Mode ── */}
            {sendMode === 'template' && (
              <div className="space-y-4">
                <div>
                  <label className="form-label">Select Template</label>
                  <select
                    className="form-input"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    <option value="">Choose a template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTemplate && (
                  <div
                    className="rounded-lg p-4 text-sm leading-relaxed"
                    style={{ background: 'rgba(15,26,46,0.6)', border: '1px solid rgba(34,211,238,0.06)' }}
                  >
                    <p className="text-[#64748b] text-xs mb-2 uppercase tracking-wide font-semibold">
                      Preview
                    </p>
                    <p className="text-[#94a3b8]">{highlightVariables(selectedTemplate.body)}</p>
                    {parseVariables(selectedTemplate.variables).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {parseVariables(selectedTemplate.variables).map((v) => (
                          <span
                            key={v}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="form-label">Filter Recipients</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(Object.keys(groupFilterLabels) as GroupFilter[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setGroupFilter(f)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
                        style={
                          groupFilter === f
                            ? { background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' }
                            : { background: 'rgba(15,26,46,0.6)', color: '#64748b', border: '1px solid rgba(34,211,238,0.06)' }
                        }
                      >
                        {groupFilterLabels[f]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-sm font-medium" style={{ color: '#22d3ee' }}>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}
                    >
                      {subscriberCount}
                    </span>
                    {' '}subscriber{subscriberCount !== 1 ? 's' : ''} will receive this template
                  </p>
                </div>

                <button
                  onClick={() =>
                    setConfirmModal({
                      title: 'Send Template',
                      message: `Send "${selectedTemplate?.name}" to ${subscriberCount} subscriber${subscriberCount !== 1 ? 's' : ''}?`,
                      onConfirm: handleSendTemplate,
                    })
                  }
                  disabled={!selectedTemplateId || subscriberCount === 0 || sending}
                  className="btn-primary w-full disabled:opacity-40 min-h-[44px]"
                >
                  {sending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner />
                      Sending...
                    </span>
                  ) : (
                    'Send Template'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* ─── Right: Quick Actions sidebar ─── */}
          <div className="glass-card p-6 h-fit">
            <h2
              className="font-heading text-base font-bold text-text-primary mb-4 tracking-wide"
              style={{ fontFamily: "'Rajdhani', sans-serif" }}
            >
              Quick Actions
            </h2>
            <div className="space-y-3">
              {/* Payment Reminders */}
              <div>
                <button
                  onClick={() => handleQuickAction('send-reminders')}
                  disabled={quickLoading !== null}
                  className="btn-outline w-full !justify-start gap-3 disabled:opacity-40 min-h-[44px]"
                >
                  {quickLoading === 'send-reminders' ? (
                    <Spinner size={4} />
                  ) : (
                    <svg
                      className="w-4 h-4 text-warning shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                      />
                    </svg>
                  )}
                  Send Payment Reminders
                </button>
                {quickResult['send-reminders'] && (
                  <p
                    className={`mt-1.5 text-xs ${
                      quickResult['send-reminders'].type === 'success' ? 'text-[#34d399]' : 'text-[#f87171]'
                    }`}
                  >
                    {quickResult['send-reminders'].message}
                  </p>
                )}
              </div>

              {/* Overdue Notices */}
              <div>
                <button
                  onClick={() => handleQuickAction('send-overdue')}
                  disabled={quickLoading !== null}
                  className="btn-outline w-full !justify-start gap-3 disabled:opacity-40 min-h-[44px]"
                >
                  {quickLoading === 'send-overdue' ? (
                    <Spinner size={4} />
                  ) : (
                    <svg
                      className="w-4 h-4 text-destructive shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                      />
                    </svg>
                  )}
                  Send Overdue Notices
                </button>
                {quickResult['send-overdue'] && (
                  <p
                    className={`mt-1.5 text-xs ${
                      quickResult['send-overdue'].type === 'success' ? 'text-[#34d399]' : 'text-[#f87171]'
                    }`}
                  >
                    {quickResult['send-overdue'].message}
                  </p>
                )}
              </div>

              {/* Welcome Message */}
              <div>
                <div className="relative">
                  <button
                    onClick={() => setShowWelcomeDropdown(!showWelcomeDropdown)}
                    disabled={quickLoading !== null}
                    className="btn-outline w-full !justify-start gap-3 disabled:opacity-40 min-h-[44px]"
                  >
                    {quickLoading === 'send-welcome' ? (
                      <Spinner size={4} />
                    ) : (
                      <svg
                        className="w-4 h-4 text-accent shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z"
                        />
                      </svg>
                    )}
                    Send Welcome Message
                    <svg
                      className="w-3 h-3 ml-auto text-[#64748b]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {showWelcomeDropdown && (
                    <div
                      className="absolute z-20 w-full mt-1 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                      style={{ background: '#0f1a2e', border: '1px solid rgba(34,211,238,0.1)' }}
                    >
                      {customers.slice(0, 20).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setShowWelcomeDropdown(false);
                            handleQuickAction('send-welcome', { customer_id: c.id });
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(34,211,238,0.06)] transition-colors text-left cursor-pointer"
                        >
                          <p className="text-sm text-[#f1f5f9]">{c.full_name}</p>
                          <p className="text-xs text-[#64748b] ml-auto">{c.phone}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {quickResult['send-welcome'] && (
                  <p
                    className={`mt-1.5 text-xs ${
                      quickResult['send-welcome'].type === 'success' ? 'text-[#34d399]' : 'text-[#f87171]'
                    }`}
                  >
                    {quickResult['send-welcome'].message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: HISTORY ═══ */}
      {tab === 'history' && (
        <div>
          {/* Status Filter Pills */}
          <div className="flex gap-2 flex-wrap mb-6">
            {historyFilterButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setHistoryFilter(btn.value)}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer"
                style={
                  historyFilter === btn.value
                    ? {
                        background: '#22d3ee',
                        color: '#fff',
                        fontFamily: "'Rajdhani', sans-serif",
                        letterSpacing: '0.05em',
                        fontSize: 13,
                      }
                    : {
                        background: 'rgba(15,26,46,0.6)',
                        border: '1px solid rgba(34,211,238,0.06)',
                        color: '#94a3b8',
                        fontFamily: "'Rajdhani', sans-serif",
                        letterSpacing: '0.05em',
                        fontSize: 13,
                      }
                }
              >
                {btn.label}
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold"
                  style={
                    historyFilter === btn.value
                      ? { background: 'rgba(255,255,255,0.2)', color: '#fff' }
                      : { background: 'rgba(148,163,184,0.1)', color: '#64748b' }
                  }
                >
                  {btn.count}
                </span>
              </button>
            ))}
          </div>

          {/* Loading state */}
          {historyLoading ? (
            <div className="glass-card p-12 flex items-center justify-center">
              <span className="w-8 h-8 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block glass-card">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date/Time</th>
                        <th>Recipient</th>
                        <th>Type</th>
                        <th>Message</th>
                        <th>Status</th>
                        <th>Batch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="!text-center !py-16">
                            <div className="flex flex-col items-center gap-3">
                              <svg
                                className="w-12 h-12 text-[#334155]"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                                />
                              </svg>
                              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>
                                No messages found
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredHistory.map((msg) => (
                          <tr key={msg.id}>
                            <td style={{ color: '#64748b', fontSize: 13 }}>{formatDate(msg.created_at)}</td>
                            <td>
                              <div>
                                <p className="font-semibold text-[#f1f5f9] text-sm">{msg.recipient_name}</p>
                                <p className="text-xs text-[#64748b]">{msg.recipient_phone}</p>
                              </div>
                            </td>
                            <td>
                              <TypeBadge type={msg.type} />
                            </td>
                            <td className="max-w-xs">
                              <button
                                onClick={() => setExpandedMsg(expandedMsg === msg.id ? null : msg.id)}
                                className="text-left text-sm text-[#94a3b8] cursor-pointer hover:text-[#cbd5e1] transition-colors"
                              >
                                {expandedMsg === msg.id
                                  ? msg.message
                                  : msg.message.length > 60
                                    ? msg.message.slice(0, 60) + '...'
                                    : msg.message}
                              </button>
                            </td>
                            <td>
                              <StatusBadge status={msg.status} />
                            </td>
                            <td>
                              {msg.batch_id ? (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono"
                                  style={{ background: 'rgba(15,23,41,0.8)', color: '#64748b' }}
                                >
                                  {msg.batch_id.slice(0, 8)}
                                </span>
                              ) : (
                                <span className="text-[#334155]">--</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-4 flex items-center justify-between border-t border-white/[0.03]">
                    <p className="text-xs text-[#64748b]">
                      Page {historyPage} of {totalPages} &bull; {historyTotal} total
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const p = historyPage - 1;
                          setHistoryPage(p);
                          fetchHistory(p);
                        }}
                        disabled={historyPage <= 1}
                        className="btn-outline !py-1 !px-3 !text-xs disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => {
                          const p = historyPage + 1;
                          setHistoryPage(p);
                          fetchHistory(p);
                        }}
                        disabled={historyPage >= totalPages}
                        className="btn-outline !py-1 !px-3 !text-xs disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredHistory.length === 0 ? (
                  <div className="glass-card p-8 text-center">
                    <svg
                      className="w-12 h-12 text-[#334155] mx-auto mb-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                      />
                    </svg>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>
                      No messages found
                    </p>
                  </div>
                ) : (
                  filteredHistory.map((msg) => (
                    <div key={msg.id} className="glass-card p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-[#f1f5f9] text-sm">{msg.recipient_name}</p>
                          <p className="text-xs text-[#64748b]">{msg.recipient_phone}</p>
                        </div>
                        <StatusBadge status={msg.status} />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <TypeBadge type={msg.type} />
                        {msg.batch_id && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono"
                            style={{ background: 'rgba(15,23,41,0.8)', color: '#64748b' }}
                          >
                            {msg.batch_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-sm text-[#94a3b8] cursor-pointer"
                        onClick={() => setExpandedMsg(expandedMsg === msg.id ? null : msg.id)}
                      >
                        {expandedMsg === msg.id
                          ? msg.message
                          : msg.message.length > 80
                            ? msg.message.slice(0, 80) + '...'
                            : msg.message}
                      </p>
                      <p className="text-xs text-[#475569] mt-2">{formatDate(msg.created_at)}</p>
                    </div>
                  ))
                )}

                {totalPages > 1 && (
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      onClick={() => {
                        const p = historyPage - 1;
                        setHistoryPage(p);
                        fetchHistory(p);
                      }}
                      disabled={historyPage <= 1}
                      className="btn-outline disabled:opacity-40 min-h-[44px]"
                    >
                      Previous
                    </button>
                    <span className="flex items-center text-xs text-[#64748b] px-2">
                      {historyPage}/{totalPages}
                    </span>
                    <button
                      onClick={() => {
                        const p = historyPage + 1;
                        setHistoryPage(p);
                        fetchHistory(p);
                      }}
                      disabled={historyPage >= totalPages}
                      className="btn-outline disabled:opacity-40 min-h-[44px]"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ TAB: TEMPLATES ═══ */}
      {tab === 'templates' && (
        <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <svg
                className="w-14 h-14 text-[#334155] mx-auto mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: '#64748b' }}>
                No templates found
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((t) => {
                const vars = parseVariables(t.variables);
                return (
                  <div key={t.id} className="glass-card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3
                        className="font-bold text-text-primary"
                        style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 16, letterSpacing: '0.03em' }}
                      >
                        {t.name}
                      </h3>
                      <TypeBadge type={t.type} />
                    </div>

                    <div
                      className="rounded-lg p-3 text-sm leading-relaxed mb-3"
                      style={{ background: 'rgba(15,26,46,0.6)', border: '1px solid rgba(34,211,238,0.06)' }}
                    >
                      <p className="text-[#94a3b8]">{highlightVariables(t.body)}</p>
                    </div>

                    {vars.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {vars.map((v) => (
                          <span
                            key={v}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => setEditingTemplate(t)}
                      className="btn-outline !py-1.5 !px-4 !text-xs"
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ MODALS ═══ */}
      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={() => setConfirmModal(null)}
        loading={sending}
      />

      <TemplateEditModal
        template={editingTemplate}
        onClose={() => setEditingTemplate(null)}
        onSaved={fetchTemplates}
      />
    </div>
  );
}
