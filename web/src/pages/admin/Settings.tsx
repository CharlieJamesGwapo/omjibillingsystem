import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';

type TabKey = 'sms' | 'mikrotik' | 'company' | 'notifications';

interface SettingsMap {
  [key: string]: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'sms', label: 'SMS' },
  { key: 'mikrotik', label: 'MikroTik' },
  { key: 'company', label: 'Company' },
  { key: 'notifications', label: 'Notifications' },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabKey>('sms');
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [dirty, setDirty] = useState<Record<TabKey, boolean>>({ sms: false, mikrotik: false, company: false, notifications: false });

  // SMS test
  const [testPhone, setTestPhone] = useState('');
  const [testingSmS, setTestingSms] = useState(false);
  const [smsResult, setSmsResult] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // MikroTik test
  const [testingMik, setTestingMik] = useState(false);
  const [mikStatus, setMikStatus] = useState<{ connected: boolean; tested: boolean }>({ connected: false, tested: false });

  // Notifications send
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Password visibility toggles
  const [showSmsKey, setShowSmsKey] = useState(false);
  const [showMikPass, setShowMikPass] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await api.get<SettingsMap>('/settings');
        setSettings(res.data ?? {});
      } catch {
        showMessage('Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const showMessage = useCallback((text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const updateSetting = (key: string, value: string, tab: TabKey) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(prev => ({ ...prev, [tab]: true }));
  };

  const saveSettings = async (keys: string[]) => {
    setSaving(true);
    try {
      const payload: SettingsMap = {};
      keys.forEach(k => {
        // Don't send masked password values
        if (settings[k] !== undefined && settings[k] !== '••••••') {
          payload[k] = settings[k];
        }
      });
      await api.put('/settings', { settings: payload });
      showMessage('Settings saved successfully', 'success');
      setDirty(prev => ({ ...prev, [activeTab]: false }));
    } catch {
      showMessage('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const testSms = async () => {
    if (!testPhone.trim()) return;
    setTestingSms(true);
    setSmsResult(null);
    try {
      await api.post('/settings/test-sms', { phone: testPhone });
      setSmsResult({ text: 'Test SMS sent successfully!', type: 'success' });
    } catch {
      setSmsResult({ text: 'Failed to send test SMS', type: 'error' });
    } finally {
      setTestingSms(false);
    }
  };

  const testMikrotik = async () => {
    setTestingMik(true);
    try {
      const res = await api.post<{ connected: boolean; message: string }>('/mikrotik/test', {
        host: settings.mikrotik_host || '',
        port: parseInt(settings.mikrotik_port || '8728', 10),
        username: settings.mikrotik_user || '',
        password: settings.mikrotik_password || '',
      });
      setMikStatus({ connected: res.data.connected, tested: true });
      if (res.data.connected) {
        showMessage(res.data.message, 'success');
      } else {
        showMessage(res.data.message || 'Connection failed', 'error');
      }
    } catch {
      setMikStatus({ connected: false, tested: true });
      showMessage('Failed to test MikroTik connection', 'error');
    } finally {
      setTestingMik(false);
    }
  };

  const saveAndConnectMikrotik = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.post<{ success: boolean; connected: boolean; message: string }>('/mikrotik/connect', {
        host: settings.mikrotik_host || '',
        port: parseInt(settings.mikrotik_port || '8728', 10),
        username: settings.mikrotik_user || '',
        password: settings.mikrotik_password || '',
      });
      setMikStatus({ connected: res.data.connected, tested: true });
      setDirty(d => ({ ...d, mikrotik: false }));
      showMessage(res.data.message, res.data.connected ? 'success' : 'error');
    } catch {
      showMessage('Failed to save MikroTik settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendReminders = async () => {
    setSendingReminders(true);
    setReminderResult(null);
    try {
      const res = await api.post<{ count?: number }>('/notifications/send-reminders');
      const count = res.data?.count ?? 0;
      setReminderResult({ text: `${count} reminder(s) sent successfully`, type: 'success' });
    } catch {
      setReminderResult({ text: 'Failed to send reminders', type: 'error' });
    } finally {
      setSendingReminders(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-in">
          <div className="h-8 w-32 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-white/5 animate-pulse mt-2" />
        </div>
        <div className="flex gap-2 animate-in animate-in-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 w-28 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="glass-card p-8 animate-in animate-in-2">
          <div className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-3 w-24 rounded bg-white/5 animate-pulse mb-2" />
                <div className="h-11 w-full rounded-lg bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-in">
        <h1 className="page-header">Settings</h1>
        <p className="page-subtitle">System configuration and preferences</p>
      </div>

      {/* Global message */}
      {message && (
        <div
          className="px-4 py-3 rounded-xl font-body text-sm animate-in"
          style={{
            background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            color: message.type === 'success' ? '#34d399' : '#f87171',
          }}
        >
          {message.text}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 animate-in animate-in-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="relative px-5 py-2.5 rounded-xl font-heading text-xs font-semibold uppercase tracking-widest transition-all duration-200 cursor-pointer"
            style={activeTab === tab.key
              ? { background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)', color: '#fff' }
              : { background: 'rgba(15,26,46,0.6)', border: '1px solid rgba(34,211,238,0.08)', color: '#94a3b8' }
            }
          >
            {tab.label}
            {dirty[tab.key] && (
              <span
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                style={{ background: '#f59e0b' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* SMS Tab */}
      {activeTab === 'sms' && (
        <div className="glass-card p-8 animate-in animate-in-2">
          <div className="space-y-6 max-w-xl">
            <div>
              <label className="form-label">Provider</label>
              <select
                className="form-input"
                value={settings.sms_provider ?? 'mock'}
                onChange={(e) => updateSetting('sms_provider', e.target.value, 'sms')}
              >
                <option value="mock">Mock (Testing)</option>
                <option value="skysms">SkySMS</option>
                <option value="semaphore">Semaphore</option>
                <option value="twilio">Twilio</option>
              </select>
            </div>

            <div>
              <label className="form-label">API Key</label>
              <div className="relative">
                <input
                  type={showSmsKey ? 'text' : 'password'}
                  className="form-input pr-12"
                  placeholder={settings.sms_api_key === '••••••' ? '••••••' : 'Enter API key'}
                  value={settings.sms_api_key === '••••••' ? '' : (settings.sms_api_key ?? '')}
                  onChange={(e) => updateSetting('sms_api_key', e.target.value, 'sms')}
                />
                <button
                  type="button"
                  onClick={() => setShowSmsKey(!showSmsKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#94a3b8] cursor-pointer"
                >
                  {showSmsKey ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="form-label">Base URL</label>
              <input
                type="text"
                className="form-input"
                placeholder="https://api.example.com"
                value={settings.sms_base_url ?? ''}
                onChange={(e) => updateSetting('sms_base_url', e.target.value, 'sms')}
              />
            </div>

            <div>
              <label className="form-label">Sender Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="OMJI"
                value={settings.sms_sender_name ?? ''}
                onChange={(e) => updateSetting('sms_sender_name', e.target.value, 'sms')}
              />
            </div>

            {/* Test SMS */}
            <div className="pt-6" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
              <p className="font-heading text-xs font-semibold uppercase tracking-widest text-[#94a3b8] mb-4">Test SMS</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  className="form-input flex-1"
                  placeholder="09xxxxxxxxx"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
                <button
                  onClick={testSms}
                  disabled={testingSmS || !testPhone.trim()}
                  className="btn-outline whitespace-nowrap"
                >
                  {testingSmS ? 'Sending...' : 'Send Test'}
                </button>
              </div>
              {smsResult && (
                <p
                  className="font-body text-sm mt-3"
                  style={{ color: smsResult.type === 'success' ? '#34d399' : '#f87171' }}
                >
                  {smsResult.text}
                </p>
              )}
            </div>

            <div className="pt-4">
              <button
                onClick={() => saveSettings(['sms_provider', 'sms_api_key', 'sms_base_url', 'sms_sender_name'])}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MikroTik Tab */}
      {activeTab === 'mikrotik' && (
        <div className="glass-card p-8 animate-in animate-in-2">
          <div className="space-y-6 max-w-xl">
            <div>
              <label className="form-label">Host</label>
              <input
                type="text"
                className="form-input"
                placeholder="192.168.88.1"
                value={settings.mikrotik_host ?? ''}
                onChange={(e) => updateSetting('mikrotik_host', e.target.value, 'mikrotik')}
              />
            </div>

            <div>
              <label className="form-label">Port</label>
              <input
                type="number"
                className="form-input"
                placeholder="8728"
                value={settings.mikrotik_port ?? '8728'}
                onChange={(e) => updateSetting('mikrotik_port', e.target.value, 'mikrotik')}
              />
            </div>

            <div>
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="admin"
                value={settings.mikrotik_user ?? ''}
                onChange={(e) => updateSetting('mikrotik_user', e.target.value, 'mikrotik')}
              />
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  type={showMikPass ? 'text' : 'password'}
                  className="form-input pr-12"
                  placeholder={settings.mikrotik_password === '••••••' ? '••••••' : 'Enter password'}
                  value={settings.mikrotik_password === '••••••' ? '' : (settings.mikrotik_password ?? '')}
                  onChange={(e) => updateSetting('mikrotik_password', e.target.value, 'mikrotik')}
                />
                <button
                  type="button"
                  onClick={() => setShowMikPass(!showMikPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#94a3b8] cursor-pointer"
                >
                  {showMikPass ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Test Connection */}
            <div className="pt-6 flex items-center gap-4" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
              <button
                onClick={testMikrotik}
                disabled={testingMik}
                className="btn-outline"
              >
                {testingMik ? 'Testing...' : 'Test Connection'}
              </button>
              {mikStatus.tested && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: mikStatus.connected ? '#10b981' : '#ef4444' }}
                  />
                  <span
                    className="font-body text-sm"
                    style={{ color: mikStatus.connected ? '#34d399' : '#f87171' }}
                  >
                    {mikStatus.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-4 flex gap-3">
              <button
                onClick={saveAndConnectMikrotik}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving & Connecting...' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Company Tab */}
      {activeTab === 'company' && (
        <div className="glass-card p-8 animate-in animate-in-2">
          <div className="space-y-6 max-w-xl">
            <div>
              <label className="form-label">Company Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="OMJI Internet Services"
                value={settings.company_name ?? ''}
                onChange={(e) => updateSetting('company_name', e.target.value, 'company')}
              />
            </div>

            <div>
              <label className="form-label">Contact Phone</label>
              <input
                type="text"
                className="form-input"
                placeholder="09xxxxxxxxx"
                value={settings.company_phone ?? ''}
                onChange={(e) => updateSetting('company_phone', e.target.value, 'company')}
              />
            </div>

            <div>
              <label className="form-label">Address</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Company address"
                value={settings.company_address ?? ''}
                onChange={(e) => updateSetting('company_address', e.target.value, 'company')}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="pt-4">
              <button
                onClick={() => saveSettings(['company_name', 'company_phone', 'company_address'])}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="glass-card p-8 animate-in animate-in-2">
          <div className="space-y-6 max-w-xl">
            <div>
              <label className="form-label">Reminder Days Before Due</label>
              <input
                type="number"
                className="form-input"
                placeholder="2"
                value={settings.reminder_days_before ?? '2'}
                onChange={(e) => updateSetting('reminder_days_before', e.target.value, 'notifications')}
              />
            </div>

            <div>
              <label className="form-label">Auto-Disconnect Overdue</label>
              <div className="mt-2">
                <label className="relative inline-flex items-center cursor-pointer gap-3">
                  <div
                    className="relative w-11 h-6 rounded-full transition-colors duration-200"
                    style={{
                      background: settings.auto_disconnect === 'true' ? '#10b981' : 'rgba(100,116,139,0.3)',
                    }}
                    onClick={() => updateSetting('auto_disconnect', settings.auto_disconnect === 'true' ? 'false' : 'true', 'notifications')}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{
                        transform: settings.auto_disconnect === 'true' ? 'translateX(22px)' : 'translateX(2px)',
                      }}
                    />
                  </div>
                  <span className="font-body text-sm text-[#94a3b8]">
                    {settings.auto_disconnect === 'true' ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="form-label">Grace Period Hours</label>
              <input
                type="number"
                className="form-input"
                placeholder="24"
                value={settings.grace_period_hours ?? '24'}
                onChange={(e) => updateSetting('grace_period_hours', e.target.value, 'notifications')}
              />
            </div>

            <div className="pt-4">
              <button
                onClick={() => saveSettings(['reminder_days_before', 'auto_disconnect', 'grace_period_hours'])}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {/* Send Reminders */}
            <div className="pt-6" style={{ borderTop: '1px solid rgba(34,211,238,0.06)' }}>
              <p className="font-heading text-xs font-semibold uppercase tracking-widest text-[#94a3b8] mb-4">Manual Actions</p>
              <button
                onClick={sendReminders}
                disabled={sendingReminders}
                className="btn-outline"
              >
                {sendingReminders ? 'Sending...' : 'Send Reminders Now'}
              </button>
              {reminderResult && (
                <p
                  className="font-body text-sm mt-3"
                  style={{ color: reminderResult.type === 'success' ? '#34d399' : '#f87171' }}
                >
                  {reminderResult.text}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
