package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jdns/billingsystem/internal/model"
)

type SubscriptionRepo struct {
	db *pgxpool.Pool
}

func NewSubscriptionRepo(db *pgxpool.Pool) *SubscriptionRepo {
	return &SubscriptionRepo{db: db}
}

const subscriptionSelectJoin = `
	SELECT s.id, s.user_id, s.plan_id, s.ip_address, s.mac_address, s.billing_day,
	       s.next_due_date, s.grace_days, s.status, s.mikrotik_queue_id, s.created_at, s.updated_at,
	       u.full_name, u.phone, p.name, p.speed_mbps, p.price
	FROM subscriptions s
	JOIN users u ON u.id = s.user_id
	JOIN plans p ON p.id = s.plan_id`

func scanSubscription(row interface{ Scan(...interface{}) error }) (*model.Subscription, error) {
	s := &model.Subscription{}
	err := row.Scan(
		&s.ID, &s.UserID, &s.PlanID, &s.IPAddress, &s.MACAddress, &s.BillingDay,
		&s.NextDueDate, &s.GraceDays, &s.Status, &s.MikroTikQueueID, &s.CreatedAt, &s.UpdatedAt,
		&s.UserName, &s.UserPhone, &s.PlanName, &s.PlanSpeed, &s.PlanPrice,
	)
	return s, err
}

func (r *SubscriptionRepo) Create(ctx context.Context, req *model.CreateSubscriptionRequest) (*model.Subscription, error) {
	graceDays := 2
	if req.GraceDays != nil {
		graceDays = *req.GraceDays
	}

	// Calculate next_due_date from billing_day
	now := time.Now()
	nextDue := time.Date(now.Year(), now.Month(), req.BillingDay, 0, 0, 0, 0, time.UTC)
	if nextDue.Before(now) || nextDue.Equal(now) {
		nextDue = nextDue.AddDate(0, 1, 0)
	}

	var subID uuid.UUID
	err := r.db.QueryRow(ctx, `
		INSERT INTO subscriptions (user_id, plan_id, ip_address, mac_address, billing_day, next_due_date, grace_days)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id`,
		req.UserID, req.PlanID, req.IPAddress, req.MACAddress, req.BillingDay, nextDue, graceDays,
	).Scan(&subID)
	if err != nil {
		return nil, fmt.Errorf("create subscription: %w", err)
	}
	return r.GetByID(ctx, subID)
}

func (r *SubscriptionRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Subscription, error) {
	row := r.db.QueryRow(ctx, subscriptionSelectJoin+` WHERE s.id = $1`, id)
	s, err := scanSubscription(row)
	if err != nil {
		return nil, fmt.Errorf("get subscription by id: %w", err)
	}
	return s, nil
}

func (r *SubscriptionRepo) GetByUserID(ctx context.Context, userID uuid.UUID) ([]*model.Subscription, error) {
	rows, err := r.db.Query(ctx, subscriptionSelectJoin+` WHERE s.user_id = $1 ORDER BY s.created_at DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("get subscriptions by user id: %w", err)
	}
	defer rows.Close()

	var subs []*model.Subscription
	for rows.Next() {
		s, err := scanSubscription(rows)
		if err != nil {
			return nil, fmt.Errorf("scan subscription: %w", err)
		}
		subs = append(subs, s)
	}
	return subs, rows.Err()
}

func (r *SubscriptionRepo) List(ctx context.Context) ([]*model.Subscription, error) {
	rows, err := r.db.Query(ctx, subscriptionSelectJoin+` ORDER BY s.created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list subscriptions: %w", err)
	}
	defer rows.Close()

	var subs []*model.Subscription
	for rows.Next() {
		s, err := scanSubscription(rows)
		if err != nil {
			return nil, fmt.Errorf("scan subscription: %w", err)
		}
		subs = append(subs, s)
	}
	return subs, rows.Err()
}

func (r *SubscriptionRepo) Update(ctx context.Context, id uuid.UUID, req *model.UpdateSubscriptionRequest) (*model.Subscription, error) {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.PlanID != nil {
		setClauses = append(setClauses, fmt.Sprintf("plan_id = $%d", argIdx))
		args = append(args, *req.PlanID)
		argIdx++
	}
	if req.IPAddress != nil {
		setClauses = append(setClauses, fmt.Sprintf("ip_address = $%d", argIdx))
		args = append(args, *req.IPAddress)
		argIdx++
	}
	if req.MACAddress != nil {
		setClauses = append(setClauses, fmt.Sprintf("mac_address = $%d", argIdx))
		args = append(args, *req.MACAddress)
		argIdx++
	}
	if req.BillingDay != nil {
		setClauses = append(setClauses, fmt.Sprintf("billing_day = $%d", argIdx))
		args = append(args, *req.BillingDay)
		argIdx++
	}
	if req.GraceDays != nil {
		setClauses = append(setClauses, fmt.Sprintf("grace_days = $%d", argIdx))
		args = append(args, *req.GraceDays)
		argIdx++
	}
	if req.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
	}

	if len(setClauses) == 0 {
		return r.GetByID(ctx, id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIdx))
	args = append(args, time.Now())
	argIdx++

	args = append(args, id)
	query := fmt.Sprintf(`UPDATE subscriptions SET %s WHERE id = $%d`,
		strings.Join(setClauses, ", "), argIdx)

	_, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("update subscription: %w", err)
	}
	return r.GetByID(ctx, id)
}

func (r *SubscriptionRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status model.SubscriptionStatus) error {
	_, err := r.db.Exec(ctx, `UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	if err != nil {
		return fmt.Errorf("update subscription status: %w", err)
	}
	return nil
}

func (r *SubscriptionRepo) UpdateMikroTikQueueID(ctx context.Context, id uuid.UUID, queueID *string) error {
	_, err := r.db.Exec(ctx, `UPDATE subscriptions SET mikrotik_queue_id = $1, updated_at = NOW() WHERE id = $2`, queueID, id)
	if err != nil {
		return fmt.Errorf("update mikrotik queue id: %w", err)
	}
	return nil
}

func (r *SubscriptionRepo) AdvanceDueDate(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE subscriptions
		SET next_due_date = next_due_date + INTERVAL '1 month', updated_at = NOW()
		WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("advance due date: %w", err)
	}
	return nil
}

func (r *SubscriptionRepo) GetOverdue(ctx context.Context) ([]*model.Subscription, error) {
	query := subscriptionSelectJoin + `
		WHERE s.status != 'suspended'
		AND (s.next_due_date + (s.grace_days || ' days')::interval) < NOW()
		ORDER BY s.next_due_date ASC`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("get overdue subscriptions: %w", err)
	}
	defer rows.Close()

	var subs []*model.Subscription
	for rows.Next() {
		s, err := scanSubscription(rows)
		if err != nil {
			return nil, fmt.Errorf("scan subscription: %w", err)
		}
		subs = append(subs, s)
	}
	return subs, rows.Err()
}

func (r *SubscriptionRepo) GetDueSoon(ctx context.Context, days int) ([]*model.Subscription, error) {
	query := subscriptionSelectJoin + `
		WHERE s.status = 'active'
		AND s.next_due_date BETWEEN NOW() AND NOW() + ($1 || ' days')::interval
		ORDER BY s.next_due_date ASC`

	rows, err := r.db.Query(ctx, query, days)
	if err != nil {
		return nil, fmt.Errorf("get due soon subscriptions: %w", err)
	}
	defer rows.Close()

	var subs []*model.Subscription
	for rows.Next() {
		s, err := scanSubscription(rows)
		if err != nil {
			return nil, fmt.Errorf("scan subscription: %w", err)
		}
		subs = append(subs, s)
	}
	return subs, rows.Err()
}
