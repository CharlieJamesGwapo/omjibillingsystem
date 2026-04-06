CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO settings (key, value, description, category) VALUES
    ('sms_provider', 'mock', 'SMS provider (mock, skysms, semaphore, twilio)', 'sms'),
    ('sms_api_key', '', 'SMS provider API key', 'sms'),
    ('sms_base_url', '', 'SMS API base URL (leave empty for default)', 'sms'),
    ('sms_sender_name', 'OMJI', 'SMS sender name/ID', 'sms'),
    ('mikrotik_host', '', 'MikroTik router IP address', 'mikrotik'),
    ('mikrotik_port', '8728', 'MikroTik API port', 'mikrotik'),
    ('mikrotik_user', 'admin', 'MikroTik username', 'mikrotik'),
    ('mikrotik_password', '', 'MikroTik password', 'mikrotik'),
    ('company_name', 'OMJI Internet', 'Company/business name', 'general'),
    ('company_phone', '', 'Company contact phone', 'general'),
    ('company_address', '', 'Company address', 'general'),
    ('reminder_days_before', '2', 'Days before due date to send reminder', 'notifications'),
    ('auto_disconnect_enabled', 'true', 'Auto-disconnect overdue subscriptions', 'notifications'),
    ('overdue_grace_hours', '24', 'Hours after due date before auto-disconnect', 'notifications')
ON CONFLICT (key) DO NOTHING;
