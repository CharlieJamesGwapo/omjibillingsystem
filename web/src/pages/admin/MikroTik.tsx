import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../../lib/api';
import type { MikroTikStatus, PPPoESecret } from '../../lib/types';

interface Connection {
  name: string;
  ip_address: string;
  upload_speed: string;
  download_speed: string;
  queue_name: string;
}

export default function MikroTik() {
  const [status, setStatus] = useState<MikroTikStatus | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pppoeSecrets, setPppoeSecrets] = useState<PPPoESecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderMsg, setReminderMsg] = useState('');

  const loadPPPoESecrets = async () => {
    try {
      const res = await api.get('/mikrotik/pppoe/secrets');
      setPppoeSecrets(res.data);
    } catch {
      toast.error('Failed to load PPPoE secrets');
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, connRes] = await Promise.all([
        api.get<MikroTikStatus>('/mikrotik/status'),
        api.get<Connection[]>('/mikrotik/connections'),
      ]);
      setStatus(statusRes.data);
      setConnections(connRes.data ?? []);
      setError('');
      if (statusRes.data?.connected) {
        loadPPPoESecrets();
      }
    } catch {
      setError('Failed to load MikroTik data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const sendReminders = async () => {
    setSendingReminders(true);
    setReminderMsg('');
    try {
      await api.post('/notifications/send-reminders');
      setReminderMsg('Reminders sent successfully');
    } catch {
      setReminderMsg('Failed to send reminders');
    } finally {
      setSendingReminders(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary border-t-transparent" />
          <p className="text-sm text-text-secondary">Loading MikroTik data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Page Header */}
      <div className="flex items-center justify-between animate-in animate-in-1">
        <div>
          <h1 className="page-header">MikroTik</h1>
          <p className="page-subtitle">Router management and connections</p>
        </div>
        <button
          onClick={sendReminders}
          disabled={sendingReminders}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          {sendingReminders ? 'Sending...' : 'Send Reminders'}
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-3.5 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-destructive hover:text-destructive/70 ml-4">&times;</button>
        </div>
      )}

      {reminderMsg && (
        <div
          className={`rounded-xl p-3.5 text-sm flex justify-between items-center ${
            reminderMsg.includes('success')
              ? 'bg-accent/10 border border-accent/30 text-accent'
              : 'bg-destructive/10 border border-destructive/30 text-destructive'
          }`}
        >
          <span>{reminderMsg}</span>
          <button onClick={() => setReminderMsg('')} className="hover:opacity-70 ml-4">&times;</button>
        </div>
      )}

      {/* Connection Status Card */}
      <div className="glass-card p-6 animate-in animate-in-2">
        <div className="flex items-center gap-5 mb-6">
          {/* Large Status Dot */}
          <div className="relative">
            <div
              className={`w-5 h-5 rounded-full ${
                status?.connected ? 'bg-accent' : 'bg-destructive'
              }`}
            />
            {status?.connected && (
              <div className="absolute inset-0 w-5 h-5 rounded-full bg-accent animate-ping opacity-40" />
            )}
          </div>
          <div>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              {status?.connected ? 'Connected' : 'Disconnected'}
            </h2>
            <span className={`badge ${status?.connected ? 'badge-active' : 'badge-rejected'} mt-1`}>
              {status?.connected ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Agent Status Banner */}
        <div className={`rounded-lg border p-4 flex items-center gap-3 mb-4 ${
          status?.agent_connected
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
            status?.agent_connected ? 'bg-green-500' : 'bg-yellow-500'
          }`} />
          <div>
            <p className="font-medium text-sm">
              {status?.agent_connected ? 'Local Agent Connected' : 'Local Agent Offline'}
            </p>
            <p className="text-xs text-gray-500">
              {status?.agent_connected
                ? 'MikroTik commands route through local agent'
                : 'Run the mikrotik-agent binary on your local network'}
            </p>
          </div>
        </div>

        {/* Router Details Mini Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-text-secondary text-xs uppercase tracking-wider font-medium mb-1">Address</p>
            <p className="font-mono text-sm text-text-primary">{status?.address || '-'}</p>
          </div>
          <div className="stat-card">
            <p className="text-text-secondary text-xs uppercase tracking-wider font-medium mb-1">Uptime</p>
            <p className="font-heading text-sm font-bold text-text-primary">{status?.uptime || '-'}</p>
          </div>
          <div className="stat-card">
            <p className="text-text-secondary text-xs uppercase tracking-wider font-medium mb-1">Version</p>
            <p className="font-heading text-sm font-bold text-text-primary">{status?.version || '-'}</p>
          </div>
        </div>
      </div>

      {/* Active Connections Table */}
      <div className="glass-card overflow-hidden animate-in animate-in-3">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-text-primary">Active Connections</h2>
            <p className="page-subtitle !mt-1">{connections.length} queue{connections.length !== 1 ? 's' : ''} active</p>
          </div>
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-2 text-text-secondary/50 text-xs">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-accent/60" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-accent/40 animate-ping" />
            </div>
            Auto-refresh
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name / IP</th>
                <th>Queue</th>
                <th>Upload</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {connections.length === 0 ? (
                <tr>
                  <td colSpan={4} className="!text-center !py-16">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-text-secondary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
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
                      <p className="text-text-primary font-medium">{conn.name}</p>
                      <p className="font-mono text-xs text-text-secondary mt-0.5">{conn.ip_address}</p>
                    </td>
                    <td>
                      <span className="font-mono text-xs bg-white/5 text-text-secondary px-2 py-1 rounded">{conn.queue_name}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                        </svg>
                        <span className="text-accent tabular-nums text-sm">{conn.upload_speed}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                        </svg>
                        <span className="text-secondary tabular-nums text-sm">{conn.download_speed}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PPPoE Secrets Section */}
      {status?.connected && (
        <div className="glass-card overflow-hidden animate-in animate-in-4">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold text-text-primary">PPPoE Secrets</h2>
              <p className="page-subtitle !mt-1">{pppoeSecrets.length} secret{pppoeSecrets.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={loadPPPoESecrets}
              className="btn-outline !py-1.5 !px-3 !text-xs"
            >
              Refresh
            </button>
          </div>
          {pppoeSecrets.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-text-secondary text-sm">No PPPoE secrets found or not loaded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0d1526] border-b border-gray-700">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Username</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Profile</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {pppoeSecrets.map(s => (
                    <tr key={s.name} className="border-b border-gray-700 last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 font-mono text-gray-300">{s.name}</td>
                      <td className="px-5 py-3 text-gray-300">{s.profile}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.disabled
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-accent/10 text-accent'
                        }`}>
                          {s.disabled ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-300 text-xs">{s.comment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
