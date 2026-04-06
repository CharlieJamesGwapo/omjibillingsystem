import { useState, useEffect } from 'react';
import api from '../../lib/api';

interface MonthlyIncome {
  month: string;
  amount: number;
}

export default function Reports() {
  const [income, setIncome] = useState<MonthlyIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchIncome() {
      try {
        const res = await api.get<MonthlyIncome[]>('/dashboard/income');
        setIncome(res.data ?? []);
      } catch {
        setError('Failed to load income data');
      } finally {
        setLoading(false);
      }
    }
    fetchIncome();
  }, []);

  const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const totalIncome = income.reduce((sum, m) => sum + m.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary border-t-transparent" />
          <p className="text-sm text-text-secondary">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Page Header */}
      <div className="animate-in animate-in-1">
        <h1 className="page-header">Reports</h1>
        <p className="page-subtitle">Financial overview and income breakdown</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-3.5 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-destructive hover:text-destructive/70 ml-4">&times;</button>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 animate-in animate-in-2">
        {/* Total Income */}
        <div className="stat-card" style={{ borderColor: 'rgba(34,211,238,0.2)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
          </div>
          <p className="font-heading text-3xl font-bold text-secondary tracking-tight">{formatCurrency(totalIncome)}</p>
          <p className="text-text-secondary text-xs mt-1 font-medium uppercase tracking-wider">Total Income</p>
        </div>

        {/* Months Reported */}
        <div className="stat-card" style={{ borderColor: 'rgba(59,130,246,0.2)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
          </div>
          <p className="font-heading text-3xl font-bold text-blue-400 tracking-tight">{income.length}</p>
          <p className="text-text-secondary text-xs mt-1 font-medium uppercase tracking-wider">Months Reported</p>
        </div>

        {/* Monthly Average */}
        <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
          </div>
          <p className="font-heading text-3xl font-bold text-accent tracking-tight">
            {income.length > 0 ? formatCurrency(totalIncome / income.length) : '₱0.00'}
          </p>
          <p className="text-text-secondary text-xs mt-1 font-medium uppercase tracking-wider">Monthly Average</p>
        </div>
      </div>

      {/* Monthly Income Table */}
      <div className="glass-card overflow-hidden animate-in animate-in-3">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="font-heading text-lg font-bold text-text-primary">Monthly Income</h2>
          <p className="page-subtitle !mt-1">Revenue collected per billing period</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">Income</th>
                <th className="text-right">% of Total</th>
                <th style={{ width: '30%' }}>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {income.length === 0 ? (
                <tr>
                  <td colSpan={4} className="!text-center !py-16">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-text-secondary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                      </svg>
                      <p className="text-text-secondary text-sm">No income data available</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {income.map((row) => {
                    const percentage = totalIncome > 0 ? (row.amount / totalIncome) * 100 : 0;
                    return (
                      <tr key={row.month}>
                        <td className="!font-medium !text-text-primary">{row.month}</td>
                        <td className="text-right">
                          <span className="font-heading font-bold text-text-primary tabular-nums">
                            {formatCurrency(row.amount)}
                          </span>
                        </td>
                        <td className="text-right tabular-nums">
                          {percentage.toFixed(1)}%
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${percentage}%`,
                                  background: 'linear-gradient(90deg, #22d3ee 0%, #3b82f6 100%)',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="!bg-white/[0.02]">
                    <td className="!font-bold !text-text-primary font-heading">Total</td>
                    <td className="text-right">
                      <span className="font-heading font-bold text-secondary tabular-nums">
                        {formatCurrency(totalIncome)}
                      </span>
                    </td>
                    <td className="text-right !font-bold">100%</td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
