CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id),
    recipient_id UUID REFERENCES users(id),
    recipient_phone TEXT NOT NULL,
    recipient_name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'custom',
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    batch_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_batch ON messages(batch_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'custom',
    variables TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO message_templates (name, subject, body, type, variables) VALUES
    ('payment_reminder', 'Payment Reminder', 'Hi {{name}}, your internet bill of PHP {{amount}} is due on {{due_date}}. Please pay on time to avoid disconnection. - OMJI Internet', 'reminder', 'name,amount,due_date'),
    ('overdue_notice', 'Overdue Notice', 'Hi {{name}}, your internet connection has been suspended due to non-payment of PHP {{amount}}. Please settle your bill to reconnect. - OMJI Internet', 'overdue', 'name,amount'),
    ('payment_received', 'Payment Received', 'Hi {{name}}, we received your payment of PHP {{amount}} via {{method}}. Thank you! - OMJI Internet', 'payment', 'name,amount,method'),
    ('welcome', 'Welcome to OMJI', 'Welcome {{name}}! Your OMJI Internet subscription ({{plan}} - {{speed}}Mbps) is now active. Contact us for any concerns. - OMJI Internet', 'welcome', 'name,plan,speed'),
    ('custom', 'Custom Message', '{{message}}', 'custom', 'message'),
    ('disconnection', 'Service Disconnection', 'Hi {{name}}, your internet service has been disconnected due to non-payment. Please settle PHP {{amount}} to restore service. - OMJI Internet', 'disconnection', 'name,amount'),
    ('reconnection', 'Service Restored', 'Hi {{name}}, your internet service has been restored. Thank you for your payment! - OMJI Internet', 'reconnection', 'name')
ON CONFLICT (name) DO NOTHING;
