import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../../lib/api';

type TabKey = 'sms' | 'mikrotik' | 'branding' | 'security' | 'about';

interface SettingsMap {
  [key: string]: string;
}

type DirtyMap = Record<TabKey, boolean>;
type ErrorMap = Record<string, string>;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'sms', label: 'SMS / Notifications' },
  { key: 'mikrotik', label: 'MikroTik' },
  { key: 'branding', label: 'Branding' },
  { key: 'security', label: 'Security' },
  { key: 'about', label: 'About' },
];

const TAB_KEYS: Record<TabKey, string[]> = {
  sms: ['sms_provider', 'sms_api_key', 'sms_base_url', 'sms_sender_name', 'reminder_days_before', 'grace_period_hours', 'auto_disconnect'],
  mikrotik: ['mikrotik_host', 'mikrotik_port', 'mikrotik_user', 'mikrotik_password', 'agent_secret'],
  branding: ['brand_name', 'brand_tagline', 'brand_logo_url', 'company_name', 'company_phone', 'company_address'],
  security: ['agent_secret'],
  about: [],
};

const MASKED = '••••••';

// Eye icons
const EyeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

// Spinner
const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// Password field component
function PasswordField({
  label,
  settingKey,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  settingKey: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const isMasked = value === MASKED;
  const displayValue = isMasked ? '' : value;

  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className={`form-input pr-12${error ? ' border-red-500' : ''}`}
          placeholder={isMasked ? 'Leave blank to keep current' : (placeholder ?? '')}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          data-key={settingKey}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#94a3b8] cursor-pointer"
          tabIndex={-1}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  );
}

function buildSavePayload(changed: Record<string, string>): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const [k, v] of Object.entries(changed)) {
    if (v === MASKED) continue;
    payload[k] = v;
  }
  return payload;
}

function validateTab(tab: TabKey, settings: SettingsMap): ErrorMap {
  const errors: ErrorMap = {};

  if (tab === 'sms' || tab === 'mikrotik') {
    if (tab === 'sms') {
      const rd = parseInt(settings.reminder_days_before ?? '3', 10);
      if (isNaN(rd) || rd < 1 || rd > 14) {
        errors.reminder_days_before = 'Must be between 1 and 14';
      }
      const gp = parseInt(settings.grace_period_hours ?? '24', 10);
      if (isNaN(gp) || gp < 0 || gp > 168) {
        errors.grace_period_hours = 'Must be between 0 and 168';
      }
    }
    if (tab === 'mikrotik') {
      const port = parseInt(settings.mikrotik_port ?? '8728', 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.mikrotik_port = 'Port must be between 1 and 65535';
      }
    }
  }

  if (tab === 'branding') {
    const logo = settings.brand_logo_url ?? '';
    if (logo && !logo.startsWith('http')) {
      errors.brand_logo_url = 'Logo URL must start with http';
    }
  }

  return errors;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabKey>('sms');
  const [settings, setSettings] = useState<SettingsMap>({});
  const [originalSettings, setOriginalSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<DirtyMap>({ sms: false, mikrotik: false, branding: false, security: false, about: false });
  const [errors, setErrors] = useState<ErrorMap>({});

  // SMS test
  const [testPhone, setTestPhone] = useState('');
  const [testingSms, setTestingSms] = useState(false);

  // MikroTik
  const [testingMik, setTestingMik] = useState(false);
  const [mikStatus, setMikStatus] = useState<{ connected: boolean; tested: boolean; message: string }>({ connected: false, tested: false, message: '' });
  const [connectingMik, setConnectingMik] = useState(false);

  // Send reminders
  const [sendingReminders, setSendingReminders] = useState(false);

  // Agent guide collapsed
  const [agentGuideOpen, setAgentGuideOpen] = useState(false);

  // Security: show fields
  const [showAgentSecret, setShowAgentSecret] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await api.get<SettingsMap>('/settings');
        const data = res.data ?? {};
        setSettings(data);
        setOriginalSettings(data);
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const updateSetting = useCallback((key: string, value: string, tab: TabKey) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => ({ ...prev, [tab]: true }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const saveTab = async (tab: TabKey) => {
    const tabErrors = validateTab(tab, settings);
    if (Object.keys(tabErrors).length > 0) {
      setErrors(tabErrors);
      toast.error('Please fix validation errors before saving');
      return;
    }

    setSaving(true);
    try {
      const keys = TAB_KEYS[tab];
      const changed: Record<string, string> = {};
      keys.forEach((k) => {
        if (settings[k] !== undefined) {
          changed[k] = settings[k];
        }
      });
      const payload = buildSavePayload(changed);
      await api.put('/settings', payload);
      setOriginalSettings((prev) => ({ ...prev, ...payload }));
      setDirty((prev) => ({ ...prev, [tab]: false }));
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testSms = async () => {
    if (!testPhone.trim()) return;
    setTestingSms(true);
    try {
      await api.post('/settings/test-sms', { phone: testPhone });
      toast.success('Test SMS sent successfully!');
    } catch {
      toast.error('Failed to send test SMS');
    } finally {
      setTestingSms(false);
    }
  };

  const testMikrotik = async () => {
    setTestingMik(true);
    setMikStatus({ connected: false, tested: false, message: '' });
    try {
      const res = await api.post<{ connected: boolean; message: string }>('/mikrotik/test', {
        host: settings.mikrotik_host ?? '',
        port: parseInt(settings.mikrotik_port ?? '8728', 10) || 8728,
        username: settings.mikrotik_user ?? '',
        password: settings.mikrotik_password === '••••••' ? '' : (settings.mikrotik_password ?? ''),
      });
      setMikStatus({ connected: res.data.connected, tested: true, message: res.data.message ?? '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Connection test failed';
      setMikStatus({ connected: false, tested: true, message: msg });
    } finally {
      setTestingMik(false);
    }
  };

  const saveAndConnectMikrotik = async () => {
    const tabErrors = validateTab('mikrotik', settings);
    if (Object.keys(tabErrors).length > 0) {
      setErrors(tabErrors);
      toast.error('Please fix validation errors before saving');
      return;
    }
    setConnectingMik(true);
    try {
      const res = await api.post<{ connected: boolean; message: string }>('/mikrotik/connect', {
        host: settings.mikrotik_host ?? '',
        port: parseInt(settings.mikrotik_port ?? '8728', 10) || 8728,
        username: settings.mikrotik_user ?? '',
        password: settings.mikrotik_password === '••••••' ? '' : (settings.mikrotik_password ?? ''),
      });
      setMikStatus({ connected: res.data.connected, tested: true, message: res.data.message ?? '' });
      if (res.data.connected) {
        toast.success(res.data.message || 'Connected successfully');
        setDirty((prev) => ({ ...prev, mikrotik: false }));
      } else {
        toast.error(res.data.message || 'Connection failed');
      }
    } catch {
      toast.error('Failed to save & connect MikroTik');
    } finally {
      setConnectingMik(false);
    }
  };

  const sendReminders = async () => {
    setSendingReminders(true);
    try {
      const res = await api.post<{ count?: number }>('/notifications/send-reminders');
      const count = res.data?.count ?? 0;
      toast.success(`${count} reminder(s) sent successfully`);
    } catch {
      toast.error('Failed to send reminders');
    } finally {
      setSendingReminders(false);
    }
  };

  const regenerateSecret = () => {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    const hex = Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
    updateSetting('agent_secret', hex, 'security');
  };

  const exportSettings = () => {
    const sensitiveKeys = new Set(['sms_api_key', 'mikrotik_password', 'agent_secret']);
    const exportable: Record<string, string> = {};
    for (const [k, v] of Object.entries(settings)) {
      if (!sensitiveKeys.has(k) && v !== MASKED) {
        exportable[k] = v;
      }
    }
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'settings-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ----- RENDER -----

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="h-8 w-32 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-white/5 animate-pulse mt-2" />
        </div>
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 w-28 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="glass-card p-8">
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
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="page-header">Settings</h1>
        <p className="page-subtitle">System configuration and preferences</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="relative px-5 py-2.5 rounded-xl font-heading text-xs font-semibold uppercase tracking-widest transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={
              activeTab === tab.key
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

      {/* ── SMS / NOTIFICATIONS TAB ── */}
      {activeTab === 'sms' && (
        <div className="glass-card p-8">
          <div className="space-y-6 max-w-xl">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>SMS Configuration</h2>

            <div>
              <label className="form-label">SMS Provider</label>
              <select
                className="form-input"
                value={settings.sms_provider ?? 'mock'}
                onChange={(e) => updateSetting('sms_provider', e.target.value, 'sms')}
              >
                <option value="mock">Mock (Testing)</option>
                <option value="infobip">Infobip</option>
                <option value="semaphore">Semaphore</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <PasswordField
              label="API Key"
              settingKey="sms_api_key"
              value={settings.sms_api_key ?? ''}
              onChange={(v) => updateSetting('sms_api_key', v, 'sms')}
              error={errors.sms_api_key}
            />

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

            <div style={{ borderTop: '1px solid rgba(34,211,238,0.06)', paddingTop: '1.5rem' }}>
              <h3 className="font-heading text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>Notification Timing</h3>

              <div className="space-y-4">
                <div>
                  <label className="form-label">Reminder Days Before Due (1–14)</label>
                  <input
                    type="number"
                    className={`form-input${errors.reminder_days_before ? ' border-red-500' : ''}`}
                    min={1}
                    max={14}
                    value={settings.reminder_days_before ?? '3'}
                    onChange={(e) => updateSetting('reminder_days_before', e.target.value, 'sms')}
                  />
                  {errors.reminder_days_before && (
                    <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.reminder_days_before}</p>
                  )}
                </div>

                <div>
                  <label className="form-label">Grace Period Hours (0–168)</label>
                  <input
                    type="number"
                    className={`form-input${errors.grace_period_hours ? ' border-red-500' : ''}`}
                    min={0}
                    max={168}
                    value={settings.grace_period_hours ?? '24'}
                    onChange={(e) => updateSetting('grace_period_hours', e.target.value, 'sms')}
                  />
                  {errors.grace_period_hours && (
                    <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.grace_period_hours}</p>
                  )}
                </div>

                <div>
                  <label className="form-label">Auto-Disconnect Overdue</label>
                  <div className="mt-2">
                    <label className="inline-flex items-center gap-3 cursor-pointer">
                      <div
                        className="relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer"
                        style={{ background: settings.auto_disconnect === 'true' ? '#10b981' : 'rgba(100,116,139,0.3)' }}
                        onClick={() => updateSetting('auto_disconnect', settings.auto_disconnect === 'true' ? 'false' : 'true', 'sms')}
                      >
                        <div
                          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                          style={{ transform: settings.auto_disconnect === 'true' ? 'translateX(22px)' : 'translateX(2px)' }}
                        />
                      </div>
                      <span className="font-body text-sm" style={{ color: '#94a3b8' }}>
                        {settings.auto_disconnect === 'true' ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Test SMS */}
            <div style={{ borderTop: '1px solid rgba(34,211,238,0.06)', paddingTop: '1.5rem' }}>
              <h3 className="font-heading text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>Test SMS</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="09xxxxxxxxx"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
                <button
                  onClick={testSms}
                  disabled={testingSms || !testPhone.trim()}
                  className="btn-outline whitespace-nowrap"
                >
                  {testingSms ? (
                    <span className="flex items-center gap-2"><Spinner /> Sending...</span>
                  ) : (
                    'Send Test SMS'
                  )}
                </button>
              </div>
            </div>

            {/* Manual Actions */}
            <div style={{ borderTop: '1px solid rgba(34,211,238,0.06)', paddingTop: '1.5rem' }}>
              <h3 className="font-heading text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>Manual Actions</h3>
              <button
                onClick={sendReminders}
                disabled={sendingReminders}
                className="btn-outline"
              >
                {sendingReminders ? (
                  <span className="flex items-center gap-2"><Spinner /> Sending...</span>
                ) : (
                  'Send Payment Reminders Now'
                )}
              </button>
            </div>

            {/* Save */}
            <div className="pt-2">
              <button
                onClick={() => saveTab('sms')}
                disabled={saving || !dirty.sms}
                className="btn-primary"
                style={{ opacity: !dirty.sms ? 0.4 : 1, cursor: !dirty.sms ? 'not-allowed' : 'pointer' }}
              >
                {saving ? (
                  <span className="flex items-center gap-2"><Spinner /> Saving...</span>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MIKROTIK TAB ── */}
      {activeTab === 'mikrotik' && (
        <div className="glass-card p-8">
          <div className="space-y-6 max-w-xl">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>MikroTik Router Settings</h2>

            <div>
              <label className="form-label">Router Host / IP</label>
              <input
                type="text"
                className="form-input"
                placeholder="192.168.1.1"
                value={settings.mikrotik_host ?? ''}
                onChange={(e) => updateSetting('mikrotik_host', e.target.value, 'mikrotik')}
              />
            </div>

            <div>
              <label className="form-label">Port</label>
              <input
                type="number"
                className={`form-input${errors.mikrotik_port ? ' border-red-500' : ''}`}
                placeholder="8728"
                value={settings.mikrotik_port ?? '8728'}
                onChange={(e) => updateSetting('mikrotik_port', e.target.value, 'mikrotik')}
              />
              {errors.mikrotik_port && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.mikrotik_port}</p>
              )}
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

            <PasswordField
              label="Password"
              settingKey="mikrotik_password"
              value={settings.mikrotik_password ?? ''}
              onChange={(v) => updateSetting('mikrotik_password', v, 'mikrotik')}
              error={errors.mikrotik_password}
            />

            <PasswordField
              label="Agent Secret"
              settingKey="agent_secret"
              value={settings.agent_secret ?? ''}
              onChange={(v) => updateSetting('agent_secret', v, 'mikrotik')}
              error={errors.agent_secret}
            />

            {/* Test + Connect */}
            <div style={{ borderTop: '1px solid rgba(34,211,238,0.06)', paddingTop: '1.5rem' }}>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={testMikrotik}
                  disabled={testingMik}
                  className="btn-outline"
                >
                  {testingMik ? (
                    <span className="flex items-center gap-2"><Spinner /> Testing...</span>
                  ) : (
                    'Test Connection'
                  )}
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
                      {mikStatus.message || (mikStatus.connected ? 'Connected' : 'Disconnected')}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={saveAndConnectMikrotik}
                  disabled={connectingMik}
                  className="btn-primary"
                >
                  {connectingMik ? (
                    <span className="flex items-center gap-2"><Spinner /> Connecting...</span>
                  ) : (
                    'Save & Connect'
                  )}
                </button>
              </div>
            </div>

            {/* Agent Setup Guide */}
            <div style={{ borderTop: '1px solid rgba(34,211,238,0.06)', paddingTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setAgentGuideOpen((o) => !o)}
                className="flex items-center gap-2 font-heading text-xs font-semibold uppercase tracking-widest cursor-pointer"
                style={{ color: '#94a3b8' }}
              >
                <svg
                  className="w-4 h-4 transition-transform duration-200"
                  style={{ transform: agentGuideOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                </svg>
                Agent Setup Guide
              </button>

              {agentGuideOpen && (
                <div className="mt-4">
                  <p className="font-body text-sm mb-3" style={{ color: '#94a3b8' }}>
                    How to run the local MikroTik bridge agent:
                  </p>
                  <pre
                    className="rounded-xl p-4 font-mono text-xs overflow-x-auto"
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(34,211,238,0.12)',
                      color: '#7dd3fc',
                      lineHeight: '1.7',
                    }}
                  >{`BACKEND_URL=wss://your-app.onrender.com \\
AGENT_SECRET=your-secret \\
MIKROTIK_HOST=192.168.1.1:8728 \\
MIKROTIK_USER=admin \\
MIKROTIK_PASS=yourpassword \\
./billingsystem-agent`}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── BRANDING TAB ── */}
      {activeTab === 'branding' && (
        <div className="glass-card p-8">
          <div className="space-y-6 max-w-xl">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Brand Identity</h2>

            <div>
              <label className="form-label">Brand Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="OMJI Internet"
                value={settings.brand_name ?? ''}
                onChange={(e) => updateSetting('brand_name', e.target.value, 'branding')}
              />
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>Shown in the sidebar and throughout the admin panel</p>
            </div>

            <div>
              <label className="form-label">Tagline</label>
              <input
                type="text"
                className="form-input"
                placeholder="Billing System"
                value={settings.brand_tagline ?? ''}
                onChange={(e) => updateSetting('brand_tagline', e.target.value, 'branding')}
              />
            </div>

            <div>
              <label className="form-label">Logo URL</label>
              <input
                type="text"
                className={`form-input${errors.brand_logo_url ? ' border-red-500' : ''}`}
                placeholder="https://example.com/logo.png"
                value={settings.brand_logo_url ?? ''}
                onChange={(e) => updateSetting('brand_logo_url', e.target.value, 'branding')}
              />
              {errors.brand_logo_url && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.brand_logo_url}</p>
              )}
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>Direct link to your logo image (PNG, SVG). Leave blank to use the initial letter.</p>
              {settings.brand_logo_url && !errors.brand_logo_url && (
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={settings.brand_logo_url}
                    alt="Logo preview"
                    className="h-12 w-12 rounded-lg object-contain"
                    style={{ border: '1px solid rgba(34,211,238,0.15)' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-xs" style={{ color: '#64748b' }}>Preview</span>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid rgba(34,211,238,0.06)', paddingTop: '1.5rem' }}>
              <h3 className="font-heading text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>Company Info</h3>

              <div className="space-y-4">
                <div>
                  <label className="form-label">Company Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="OMJI Internet Services"
                    value={settings.company_name ?? ''}
                    onChange={(e) => updateSetting('company_name', e.target.value, 'branding')}
                  />
                </div>

                <div>
                  <label className="form-label">Company Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="09xxxxxxxxx"
                    value={settings.company_phone ?? ''}
                    onChange={(e) => updateSetting('company_phone', e.target.value, 'branding')}
                  />
                </div>

                <div>
                  <label className="form-label">Company Address</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Full business address"
                    value={settings.company_address ?? ''}
                    onChange={(e) => updateSetting('company_address', e.target.value, 'branding')}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => saveTab('branding')}
                disabled={saving || !dirty.branding}
                className="btn-primary"
                style={{ opacity: !dirty.branding ? 0.4 : 1, cursor: !dirty.branding ? 'not-allowed' : 'pointer' }}
              >
                {saving ? (
                  <span className="flex items-center gap-2"><Spinner /> Saving...</span>
                ) : (
                  'Save Branding'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {activeTab === 'security' && (
        <div className="glass-card p-8">
          <div className="space-y-6 max-w-xl">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Security</h2>

            {/* Info box */}
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.2)',
              }}
            >
              <p className="font-body text-sm" style={{ color: '#93c5fd' }}>
                The Agent Secret authenticates the local MikroTik bridge agent. Change it if the agent is compromised.
              </p>
            </div>

            <div>
              <label className="form-label">Agent Secret</label>
              <div className="relative">
                <input
                  type={showAgentSecret ? 'text' : 'password'}
                  className="form-input pr-12"
                  placeholder={settings.agent_secret === MASKED ? 'Leave blank to keep current' : 'Enter agent secret'}
                  value={settings.agent_secret === MASKED ? '' : (settings.agent_secret ?? '')}
                  onChange={(e) => updateSetting('agent_secret', e.target.value, 'security')}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowAgentSecret((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#94a3b8] cursor-pointer"
                  tabIndex={-1}
                >
                  {showAgentSecret ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {errors.agent_secret && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.agent_secret}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={regenerateSecret}
                className="btn-outline"
              >
                Regenerate Secret
              </button>
              <button
                onClick={() => saveTab('security')}
                disabled={saving || !dirty.security}
                className="btn-primary"
                style={{ opacity: !dirty.security ? 0.4 : 1, cursor: !dirty.security ? 'not-allowed' : 'pointer' }}
              >
                {saving ? (
                  <span className="flex items-center gap-2"><Spinner /> Saving...</span>
                ) : (
                  'Save Secret'
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── ABOUT TAB ── */}
      {activeTab === 'about' && (
        <div className="glass-card p-8">
          <div className="space-y-8 max-w-xl">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>About</h2>

            {/* App Info */}
            <div className="space-y-3">
              <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid rgba(34,211,238,0.06)' }}>
                <span className="font-body text-sm" style={{ color: '#94a3b8' }}>Application</span>
                <span className="font-heading text-sm font-semibold" style={{ color: '#e2e8f0' }}>BillingSystem</span>
              </div>
              <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid rgba(34,211,238,0.06)' }}>
                <span className="font-body text-sm" style={{ color: '#94a3b8' }}>Version</span>
                <span className="font-mono text-sm px-2 py-0.5 rounded" style={{ background: 'rgba(34,211,238,0.08)', color: '#22d3ee' }}>1.0.0</span>
              </div>
              <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid rgba(34,211,238,0.06)' }}>
                <span className="font-body text-sm" style={{ color: '#94a3b8' }}>Environment</span>
                <span
                  className="font-mono text-xs px-2 py-0.5 rounded"
                  style={{
                    background: import.meta.env.PROD ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    color: import.meta.env.PROD ? '#34d399' : '#fbbf24',
                    border: `1px solid ${import.meta.env.PROD ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  }}
                >
                  {import.meta.env.PROD ? 'production' : 'development'}
                </span>
              </div>
              <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid rgba(34,211,238,0.06)' }}>
                <span className="font-body text-sm" style={{ color: '#94a3b8' }}>Brand</span>
                <span className="font-body text-sm" style={{ color: '#e2e8f0' }}>{settings.brand_name || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="font-body text-sm" style={{ color: '#94a3b8' }}>Company</span>
                <span className="font-body text-sm" style={{ color: '#e2e8f0' }}>{settings.company_name || '—'}</span>
              </div>
            </div>

            {/* System Health */}
            <div>
              <h3 className="font-heading text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>System Health</h3>
              <div className="space-y-3">
                {[
                  {
                    label: 'SMS Provider',
                    ok: !!settings.sms_provider && settings.sms_provider !== 'mock',
                    detail: settings.sms_provider || 'not configured',
                  },
                  {
                    label: 'MikroTik Host',
                    ok: !!settings.mikrotik_host,
                    detail: settings.mikrotik_host || 'not configured',
                  },
                  {
                    label: 'Agent Secret',
                    ok: !!settings.agent_secret,
                    detail: settings.agent_secret ? 'configured' : 'not set',
                  },
                  {
                    label: 'Brand Name',
                    ok: !!settings.brand_name,
                    detail: settings.brand_name || 'not set',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg px-4 py-3"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: item.ok ? '#10b981' : '#f59e0b' }}
                      />
                      <span className="font-body text-sm" style={{ color: '#e2e8f0' }}>{item.label}</span>
                    </div>
                    <span className="font-mono text-xs" style={{ color: '#64748b' }}>{item.detail}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Export */}
            <div style={{ borderTop: '1px solid rgba(34,211,238,0.06)', paddingTop: '1.5rem' }}>
              <h3 className="font-heading text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#94a3b8' }}>Export</h3>
              <p className="font-body text-sm mb-4" style={{ color: '#64748b' }}>
                Download all non-sensitive settings as a JSON file.
              </p>
              <button onClick={exportSettings} className="btn-outline">
                Export Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
