CREATE TYPE subscription_status AS ENUM ('active', 'overdue', 'suspended');

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    billing_day INTEGER NOT NULL CHECK (billing_day >= 1 AND billing_day <= 28),
    next_due_date DATE NOT NULL,
    grace_days INTEGER NOT NULL DEFAULT 2,
    status subscription_status NOT NULL DEFAULT 'active',
    mikrotik_queue_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_next_due_date ON subscriptions(next_due_date);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
