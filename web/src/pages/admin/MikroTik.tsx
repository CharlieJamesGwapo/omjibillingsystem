import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { getUserRole } from '../../lib/auth';
import type { MikroTikStatus, PPPoESecret } from '../../lib/types';

interface Connection {
  name: string;
  ip_address: string;
  upload_speed: string;
  download_speed: string;
  queue_name: string;
}

interface RouterForm {
  host: string;
  port: string;
  username: string;
  password: string;
}

interface PPPoEForm {
  username: string;
  password: string;
  profile: string;
  comment: string;
}

const emptyRouterForm: RouterForm = { host: '', port: '8728', username: '', password: '' };
const emptyPPPoEForm: PPPoEForm = { username: '', password: '', profile: 'default', comment: '' };

const AUTO_REFRESH_INTERVAL = 30;

// ── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded-lg bg-white/5 animate-pulse ${className ?? ''}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Status bar skeleton */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-8">
            <SkeletonBlock className="h-6 w-44" />
            <SkeletonBlock className="h-6 w-36" />
            <SkeletonBlock className="h-6 w-40" />
          </div>
          <SkeletonBlock className="h-8 w-28" />
        </div>
      </div>
      {/* Two-col skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="glass-card p-5 lg:col-span-3 space-y-3">
          <SkeletonBlock className="h-5 w-40 mb-4" />
          {[...Array(4)].map((_, i) => <SkeletonBlock key={i} className="h-10 w-full" />)}
        </div>
        <div className="glass-card p-5 lg:col-span-2 space-y-3">
          <SkeletonBlock className="h-5 w-32 mb-4" />
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-10 w-full" />
        </div>
      </div>
      {/* PPPoE skeleton */}
      <div className="glass-card p-5 space-y-3">
        <SkeletonBlock className="h-5 w-36 mb-4" />
        {[...Array(5)].map((_, i) => <SkeletonBlock key={i} className="h-10 w-full" />)}
      </div>
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({
  onClose,
  children,
  danger = false,
}: {
  onClose: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  // ESC key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      style={danger ? { background: 'rgba(239,68,68,0.08)' } : undefined}
      onClick={onClose}
    >
      <div className={`modal-content ${danger ? '!border-destructive/20' : ''}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────────
function StatusDot({ active, color }: { active: boolean; color: 'green' | 'yellow' | 'gray' | 'red' }) {
  const colorMap: Record<string, string> = {
    green: '#22c55e',
    yellow: '#eab308',
    gray: '#6b7280',
    red: '#ef4444',
  };
  const c = active ? colorMap.green : colorMap[color];
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ background: c, boxShadow: active ? `0 0 6px ${c}` : undefined }}
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MikroTik() {
  const userRole = getUserRole();
  const isAdmin = userRole === 'admin';

  // Data state
  const [status, setStatus] = useState<MikroTikStatus | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pppoeSecrets, setPppoeSecrets] = useState<PPPoESecret[]>([]);
  const [loading, setLoading] = useState(true);

  // Countdown
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modal state
  const [showTestModal, setShowTestModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddSecretModal, setShowAddSecretModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PPPoESecret | null>(null);

  // Form state
  const [testForm, setTestForm] = useState<RouterForm>(emptyRouterForm);
  const [configForm, setConfigForm] = useState<RouterForm>(emptyRouterForm);
  const [pppoeForm, setPppoeForm] = useState<PPPoEForm>(emptyPPPoEForm);

  // Password visibility
  const [showTestPw, setShowTestPw] = useState(false);
  const [showConfigPw, setShowConfigPw] = useState(false);
  const [showPPPoEPw, setShowPPPoEPw] = useState(false);

  // Loading/result flags
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [addingSecret, setAddingSecret] = useState(false);
  const [deletingSecret, setDeletingSecret] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const loadPPPoESecrets = useCallback(async () => {
    try {
      const res = await api.get<PPPoESecret[]>('/mikrotik/pppoe/secrets');
      setPppoeSecrets(res.data ?? []);
    } catch {
      toast.error('Failed to load PPPoE secrets');
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, connRes] = await Promise.all([
        api.get<MikroTikStatus>('/mikrotik/status'),
        api.get<Connection[]>('/mikrotik/connections'),
      ]);
      setStatus(statusRes.data);
      setConnections(connRes.data ?? []);
      setLastRefreshed(new Date());
      setCountdown(AUTO_REFRESH_INTERVAL);
      if (statusRes.data?.connected) {
        await loadPPPoESecrets();
      }
    } catch {
      toast.error('Failed to load MikroTik data');
    } finally {
      setLoading(false);
    }
  }, [loadPPPoESecrets]);

  // Auto-refresh every 30s
  useEffect(() => {
    fetchData();
    const refreshInterval = setInterval(fetchData, AUTO_REFRESH_INTERVAL * 1000);
    return () => clearInterval(refreshInterval);
  }, [fetchData]);

  // Countdown ticker
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? AUTO_REFRESH_INTERVAL : prev - 1));
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [lastRefreshed]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      await api.post('/notifications/send-reminders');
      toast.success('Payment reminders sent');
    } catch {
      toast.error('Failed to send reminders');
    } finally {
      setSendingReminders(false);
    }
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingConn(true);
    setTestResult(null);
    try {
      await api.post('/mikrotik/test', {
        host: testForm.host,
        port: Number(testForm.port),
        username: testForm.username,
        password: testForm.password,
      });
      setTestResult({ ok: true, message: 'Connection successful!' });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Connection failed')
          : 'Connection failed';
      setTestResult({ ok: false, message: msg });
    } finally {
      setTestingConn(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api.post('/mikrotik/connect', {
        host: configForm.host,
        port: Number(configForm.port),
        username: configForm.username,
        password: configForm.password,
      });
      toast.success('Router configuration saved and connected');
      setShowConfigModal(false);
      setConfigForm(emptyRouterForm);
      await fetchData();
    } catch {
      toast.error('Failed to save router configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAddSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pppoeForm.username.trim() || !pppoeForm.password.trim()) {
      toast.error('Username and password are required');
      return;
    }
    setAddingSecret(true);
    try {
      await api.post('/mikrotik/pppoe/secrets', {
        username: pppoeForm.username.trim(),
        password: pppoeForm.password,
        profile: pppoeForm.profile.trim() || 'default',
        comment: pppoeForm.comment.trim(),
      });
      toast.success(`PPPoE secret "${pppoeForm.username}" added`);
      setShowAddSecretModal(false);
      setPppoeForm(emptyPPPoEForm);
      await loadPPPoESecrets();
    } catch {
      toast.error('Failed to add PPPoE secret');
    } finally {
      setAddingSecret(false);
    }
  };

  const handleDeleteSecret = async () => {
    if (!deleteTarget) return;
    setDeletingSecret(true);
    try {
      await api.delete(`/mikrotik/pppoe/secrets/${encodeURIComponent(deleteTarget.name)}`);
      toast.success(`PPPoE secret "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      await loadPPPoESecrets();
    } catch {
      toast.error('Failed to delete PPPoE secret');
    } finally {
      setDeletingSecret(false);
    }
  };

  const handleManualRefresh = () => {
    setLoading(true);
    fetchData();
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const secondsAgo = lastRefreshed
    ? Math.floor((Date.now() - lastRefreshed.getTime()) / 1000)
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading && !status) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">MikroTik</h1>
          <p className="page-subtitle">Router management, PPPoE secrets, and active connections</p>
        </div>
      </div>

      {/* ── Section 1: Status Bar ── */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Status indicators */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2">
              <StatusDot active={status?.connected ?? false} color="red" />
              <span className="text-sm text-text-secondary">
                MikroTik API:&nbsp;
                <span className={status?.connected ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                  {status?.connected ? 'Connected' : 'Disconnected'}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot active={status?.agent_connected ?? false} color="yellow" />
              <span className="text-sm text-text-secondary">
                Local Agent:&nbsp;
                <span className={status?.agent_connected ? 'text-green-400 font-medium' : 'text-yellow-400 font-medium'}>
                  {status?.agent_connected ? 'Online' : 'Offline'}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot active={status?.direct_connected ?? false} color="gray" />
              <span className="text-sm text-text-secondary">
                Direct:&nbsp;
                <span className={status?.direct_connected ? 'text-green-400 font-medium' : 'text-gray-400 font-medium'}>
                  {status?.direct_connected ? 'Connected' : 'None'}
                </span>
              </span>
            </div>
          </div>

          {/* Refresh info + button */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-text-secondary/60 whitespace-nowrap">
              {secondsAgo !== null
                ? `Last refreshed ${secondsAgo}s ago · Refreshing in ${countdown}s`
                : `Refreshing in ${countdown}s`}
            </span>
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="btn-outline !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
            >
              <svg
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Agent offline warning ── */}
      {!status?.agent_connected && (
        <div
          className="rounded-xl border p-4 flex items-start gap-3"
          style={{ background: 'rgba(234,179,8,0.06)', borderColor: 'rgba(234,179,8,0.25)' }}
        >
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#eab308' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div>
            <p className="text-sm font-medium" style={{ color: '#eab308' }}>Local agent is not connected</p>
            <p className="text-xs mt-0.5 text-text-secondary">
              PPPoE operations require the agent binary running on your local network.
            </p>
          </div>
        </div>
      )}

      {/* ── Section 2: Two-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Active Connections (60%) */}
        <div className="glass-card overflow-hidden lg:col-span-3">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-base font-bold text-text-primary">Active Connections</h2>
              <span
                className="inline-flex items-center justify-center rounded-full text-xs font-semibold px-2 py-0.5"
                style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}
              >
                {connections.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary/50">
              <div className="relative w-2 h-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#22d3ee', opacity: 0.7 }} />
              </div>
              Live
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>IP Address</th>
                  <th>Upload</th>
                  <th>Download</th>
                  <th>Queue</th>
                </tr>
              </thead>
              <tbody>
                {connections.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="!text-center !py-16">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-text-secondary/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                        </svg>
                        <p className="text-text-secondary text-sm">No active connections</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  connections.map((conn, i) => (
                    <tr key={i}>
                      <td>
                        <span className="font-medium text-text-primary">{conn.name}</span>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-text-secondary">{conn.ip_address}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                          </svg>
                          <span className="text-green-400 tabular-nums text-sm">{conn.upload_speed}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                          </svg>
                          <span className="text-blue-400 tabular-nums text-sm">{conn.download_speed}</span>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-xs bg-white/5 text-text-secondary px-2 py-1 rounded">
                          {conn.queue_name}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Quick Actions (40%) */}
        <div className="glass-card p-5 lg:col-span-2 flex flex-col">
          <h2 className="font-heading text-base font-bold text-text-primary mb-4">Quick Actions</h2>
          <div className="flex flex-col gap-3">
            {/* Send Reminders */}
            <button
              onClick={handleSendReminders}
              disabled={sendingReminders}
              className="flex items-center gap-3 w-full rounded-xl px-4 py-3.5 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', color: '#eab308' }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              <div className="flex-1 text-left">
                <p className="font-semibold">{sendingReminders ? 'Sending...' : 'Send Payment Reminders'}</p>
                <p className="text-xs opacity-60 mt-0.5">Notify overdue clients</p>
              </div>
            </button>

            {/* Test Connection */}
            <button
              onClick={() => { setTestForm(emptyRouterForm); setTestResult(null); setShowTestModal(true); }}
              className="flex items-center gap-3 w-full rounded-xl px-4 py-3.5 text-sm font-medium transition-colors"
              style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)', color: '#22d3ee' }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div className="flex-1 text-left">
                <p className="font-semibold">Test Connection</p>
                <p className="text-xs opacity-60 mt-0.5">Verify router reachability</p>
              </div>
            </button>

            {/* Configure Router */}
            <button
              onClick={() => { setConfigForm(emptyRouterForm); setShowConfigModal(true); }}
              className="flex items-center gap-3 w-full rounded-xl px-4 py-3.5 text-sm font-medium transition-colors"
              style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <div className="flex-1 text-left">
                <p className="font-semibold">Configure Router</p>
                <p className="text-xs opacity-60 mt-0.5">Save connection settings</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 3: PPPoE Secrets ── */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-base font-bold text-text-primary">PPPoE Secrets</h2>
            <span
              className="inline-flex items-center justify-center rounded-full text-xs font-semibold px-2 py-0.5"
              style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}
            >
              {pppoeSecrets.length}
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setPppoeForm(emptyPPPoEForm); setShowAddSecretModal(true); }}
              className="btn-primary !py-2 !px-4 !text-xs flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Secret
            </button>
          )}
        </div>

        {pppoeSecrets.length === 0 ? (
          <div className="px-5 py-16 flex flex-col items-center gap-3 text-center">
            <svg className="w-12 h-12 text-text-secondary/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
            </svg>
            <p className="text-text-secondary text-sm">No PPPoE secrets found</p>
            {!status?.connected && (
              <p className="text-xs text-text-secondary/60">Connect to MikroTik to view secrets</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Profile</th>
                  <th>Status</th>
                  <th>Comment</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pppoeSecrets.map((secret) => (
                  <tr key={secret.name}>
                    <td>
                      <span className="font-mono text-sm text-text-primary">{secret.name}</span>
                    </td>
                    <td>
                      <span className="text-sm text-text-secondary">{secret.profile || '—'}</span>
                    </td>
                    <td>
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={
                          secret.disabled
                            ? { background: 'rgba(239,68,68,0.1)', color: '#f87171' }
                            : { background: 'rgba(34,197,94,0.1)', color: '#4ade80' }
                        }
                      >
                        {secret.disabled ? 'Disabled' : 'Enabled'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-text-secondary">{secret.comment || '—'}</span>
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          onClick={() => setDeleteTarget(secret)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                          style={{ color: '#f87171' }}
                          title="Delete secret"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════════ */}

      {/* ── Test Connection Modal ── */}
      {showTestModal && (
        <Modal onClose={() => setShowTestModal(false)}>
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}
            >
              <svg className="w-5 h-5" style={{ color: '#22d3ee' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold text-text-primary">Test Connection</h2>
              <p className="text-sm text-text-secondary">Verify router is reachable</p>
            </div>
          </div>

          <form onSubmit={handleTestConnection} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="form-label">Host (IP or hostname) *</label>
                <input
                  type="text"
                  required
                  placeholder="192.168.1.1"
                  value={testForm.host}
                  onChange={(e) => setTestForm({ ...testForm, host: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Port</label>
                <input
                  type="number"
                  required
                  value={testForm.port}
                  onChange={(e) => setTestForm({ ...testForm, port: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>
            <div>
              <label className="form-label">Username *</label>
              <input
                type="text"
                required
                value={testForm.username}
                onChange={(e) => setTestForm({ ...testForm, username: e.target.value })}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Password *</label>
              <div className="relative">
                <input
                  type={showTestPw ? 'text' : 'password'}
                  required
                  value={testForm.password}
                  onChange={(e) => setTestForm({ ...testForm, password: e.target.value })}
                  className="form-input !pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowTestPw(!showTestPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  {showTestPw ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Inline test result */}
            {testResult && (
              <div
                className="rounded-lg p-3 text-sm flex items-center gap-2"
                style={
                  testResult.ok
                    ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }
                    : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }
                }
              >
                {testResult.ok ? (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                )}
                {testResult.message}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
              <button type="button" onClick={() => setShowTestModal(false)} className="btn-outline">
                Cancel
              </button>
              <button
                type="submit"
                disabled={testingConn}
                className="btn-primary flex items-center gap-2"
              >
                {testingConn && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                )}
                {testingConn ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Configure Router Modal ── */}
      {showConfigModal && (
        <Modal onClose={() => setShowConfigModal(false)}>
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              <svg className="w-5 h-5" style={{ color: '#60a5fa' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold text-text-primary">Configure Router</h2>
              <p className="text-sm text-text-secondary">Save and connect to MikroTik</p>
            </div>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="form-label">Host (IP or hostname) *</label>
                <input
                  type="text"
                  required
                  placeholder="192.168.1.1"
                  value={configForm.host}
                  onChange={(e) => setConfigForm({ ...configForm, host: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Port</label>
                <input
                  type="number"
                  required
                  value={configForm.port}
                  onChange={(e) => setConfigForm({ ...configForm, port: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>
            <div>
              <label className="form-label">Username *</label>
              <input
                type="text"
                required
                value={configForm.username}
                onChange={(e) => setConfigForm({ ...configForm, username: e.target.value })}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Password *</label>
              <div className="relative">
                <input
                  type={showConfigPw ? 'text' : 'password'}
                  required
                  value={configForm.password}
                  onChange={(e) => setConfigForm({ ...configForm, password: e.target.value })}
                  className="form-input !pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfigPw(!showConfigPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  {showConfigPw ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
              <button type="button" onClick={() => setShowConfigModal(false)} className="btn-outline">
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                className="btn-primary flex items-center gap-2"
              >
                {savingConfig && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                )}
                {savingConfig ? 'Saving...' : 'Save & Connect'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add PPPoE Secret Modal ── */}
      {showAddSecretModal && (
        <Modal onClose={() => setShowAddSecretModal(false)}>
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <svg className="w-5 h-5" style={{ color: '#4ade80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
              </svg>
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold text-text-primary">Add PPPoE Secret</h2>
              <p className="text-sm text-text-secondary">Create a new PPPoE user credential</p>
            </div>
          </div>

          <form onSubmit={handleAddSecret} className="space-y-4">
            <div>
              <label className="form-label">Username *</label>
              <input
                type="text"
                required
                placeholder="client_username"
                value={pppoeForm.username}
                onChange={(e) => setPppoeForm({ ...pppoeForm, username: e.target.value })}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Password *</label>
              <div className="relative">
                <input
                  type={showPPPoEPw ? 'text' : 'password'}
                  required
                  value={pppoeForm.password}
                  onChange={(e) => setPppoeForm({ ...pppoeForm, password: e.target.value })}
                  className="form-input !pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPPPoEPw(!showPPPoEPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  {showPPPoEPw ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">Profile</label>
              <input
                type="text"
                placeholder="default"
                value={pppoeForm.profile}
                onChange={(e) => setPppoeForm({ ...pppoeForm, profile: e.target.value })}
                className="form-input"
              />
              <p className="text-xs text-text-secondary/60 mt-1">Must match a profile name on the router</p>
            </div>
            <div>
              <label className="form-label">Comment <span className="text-text-secondary/50 font-normal">(optional)</span></label>
              <input
                type="text"
                placeholder="e.g. Unit 4B - Juan Dela Cruz"
                value={pppoeForm.comment}
                onChange={(e) => setPppoeForm({ ...pppoeForm, comment: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
              <button type="button" onClick={() => setShowAddSecretModal(false)} className="btn-outline">
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingSecret}
                className="btn-primary flex items-center gap-2"
              >
                {addingSecret && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                )}
                {addingSecret ? 'Adding...' : 'Add Secret'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <Modal onClose={() => !deletingSecret && setDeleteTarget(null)} danger>
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <svg className="w-7 h-7" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h2 className="font-heading text-xl font-bold text-text-primary">
              Delete PPPoE secret "{deleteTarget.name}"?
            </h2>
            <p className="text-text-secondary text-sm mt-2 max-w-xs">
              This will immediately disconnect the client. This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deletingSecret}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteSecret}
              disabled={deletingSecret}
              className="btn-danger flex items-center gap-2"
            >
              {deletingSecret && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              )}
              {deletingSecret ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
