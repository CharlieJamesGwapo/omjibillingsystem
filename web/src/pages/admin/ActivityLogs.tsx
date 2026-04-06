import { useState, useEffect } from 'react';
import api from '../../lib/api';

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

const LOGS_PER_PAGE = 20;

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(LOGS_PER_PAGE);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await api.get<ActivityLog[]>('/dashboard/logs');
        const sorted = (res.data ?? []).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setLogs(sorted);
      } catch {
        setError('Failed to load activity logs');
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const formatDateTime = (date: string) =>
    new Date(date).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const actionBadgeClass = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes('create') || lower.includes('add')) return 'badge-active';
    if (lower.includes('delete') || lower.includes('remove') || lower.includes('reject')) return 'badge-rejected';
    if (lower.includes('update') || lower.includes('edit') || lower.includes('approve')) return 'badge-admin';
    if (lower.includes('login') || lower.includes('auth')) return 'badge-pending';
    return 'badge-admin';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary border-t-transparent" />
          <p className="text-sm text-text-secondary">Loading activity logs...</p>
        </div>
      </div>
    );
  }

  const visibleLogs = logs.slice(0, visibleCount);
  const hasMore = visibleCount < logs.length;

  return (
    <div className="space-y-6 animate-in">
      {/* Page Header */}
      <div className="animate-in animate-in-1">
        <h1 className="page-header">Activity Logs</h1>
        <p className="page-subtitle">System audit trail</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-3.5 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-destructive hover:text-destructive/70 ml-4">&times;</button>
        </div>
      )}

      {/* Logs Table */}
      <div className="glass-card overflow-hidden animate-in animate-in-2">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="!text-center !py-16">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-text-secondary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                      <p className="text-text-secondary text-sm">No activity logs found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap">
                      <span className="font-[Outfit] text-text-secondary text-xs tabular-nums">
                        {formatDateTime(log.created_at)}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-xs bg-white/5 text-text-secondary px-2 py-1 rounded">
                        {log.user_id.slice(0, 8)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${actionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <span className="text-text-primary text-sm">{log.target_type}</span>
                      {log.target_id && (
                        <span className="text-text-secondary/50 ml-1 text-xs">#{log.target_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td>
                      {Object.keys(log.details).length > 0 ? (
                        <button
                          onClick={() => setExpandedDetail(expandedDetail === log.id ? null : log.id)}
                          className="text-left"
                        >
                          {expandedDetail === log.id ? (
                            <span className="text-xs text-text-secondary break-all max-w-[300px] block">
                              {JSON.stringify(log.details, null, 2)}
                            </span>
                          ) : (
                            <span className="text-xs text-text-secondary truncate block max-w-[200px] hover:text-secondary transition-colors cursor-pointer">
                              {JSON.stringify(log.details)}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="text-text-secondary/30">--</span>
                      )}
                    </td>
                    <td>
                      {log.ip_address ? (
                        <span className="font-mono text-xs text-text-secondary">{log.ip_address}</span>
                      ) : (
                        <span className="text-text-secondary/30">--</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Show More */}
        {hasMore && (
          <div className="px-4 py-4 border-t border-white/5 flex justify-center">
            <button
              onClick={() => setVisibleCount((c) => c + LOGS_PER_PAGE)}
              className="btn-outline text-xs"
            >
              Show More ({logs.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
