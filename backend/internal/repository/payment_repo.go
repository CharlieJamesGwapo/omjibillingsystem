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

type PaymentRepo struct {
	db *pgxpool.Pool
}

func NewPaymentRepo(db *pgxpool.Pool) *PaymentRepo {
	return &PaymentRepo{db: db}
}

const paymentSelectJoin = `
	SELECT p.id, p.user_id, p.subscription_id, p.amount, p.method, p.reference_number,
	       p.proof_image_url, p.status, p.approved_by, p.billing_period_start, p.billing_period_end,
	       p.notes, p.created_at, p.updated_at,
	       u.full_name, u.phone,
	       a.full_name
	FROM payments p
	JOIN users u ON u.id = p.user_id
	LEFT JOIN users a ON a.id = p.approved_by`

func scanPayment(row interface{ Scan(...interface{}) error }) (*model.Payment, error) {
	pay := &model.Payment{}
	err := row.Scan(
		&pay.ID, &pay.UserID, &pay.SubscriptionID, &pay.Amount, &pay.Method,
		&pay.ReferenceNumber, &pay.ProofImageURL, &pay.Status, &pay.ApprovedBy,
		&pay.BillingPeriodStart, &pay.BillingPeriodEnd,
		&pay.Notes, &pay.CreatedAt, &pay.UpdatedAt,
		&pay.UserName, &pay.UserPhone, &pay.ApproverName,
	)
	return pay, err
}

func (r *PaymentRepo) Create(ctx context.Context, req *model.CreatePaymentRequest) (*model.Payment, error) {
	var payID uuid.UUID
	err := r.db.QueryRow(ctx, `
		INSERT INTO payments (user_id, subscription_id, amount, method, reference_number, proof_image_url, billing_period_start, billing_period_end)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id`,
		req.UserID, req.SubscriptionID, req.Amount, req.Method,
		req.ReferenceNumber, req.ProofImageURL,
		req.BillingPeriodStart, req.BillingPeriodEnd,
	).Scan(&payID)
	if err != nil {
		return nil, fmt.Errorf("create payment: %w", err)
	}
	return r.GetByID(ctx, payID)
}

func (r *PaymentRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Payment, error) {
	row := r.db.QueryRow(ctx, paymentSelectJoin+` WHERE p.id = $1`, id)
	pay, err := scanPayment(row)
	if err != nil {
		return nil, fmt.Errorf("get payment by id: %w", err)
	}
	return pay, nil
}

func (r *PaymentRepo) ListByStatus(ctx context.Context, status model.PaymentStatus) ([]*model.Payment, error) {
	rows, err := r.db.Query(ctx, paymentSelectJoin+` WHERE p.status = $1 ORDER BY p.created_at DESC`, status)
	if err != nil {
		return nil, fmt.Errorf("list payments by status: %w", err)
	}
	defer rows.Close()

	var payments []*model.Payment
	for rows.Next() {
		pay, err := scanPayment(rows)
		if err != nil {
			return nil, fmt.Errorf("scan payment: %w", err)
		}
		payments = append(payments, pay)
	}
	return payments, rows.Err()
}

func (r *PaymentRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*model.Payment, error) {
	rows, err := r.db.Query(ctx, paymentSelectJoin+` WHERE p.user_id = $1 ORDER BY p.created_at DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("list payments by user id: %w", err)
	}
	defer rows.Close()

	var payments []*model.Payment
	for rows.Next() {
		pay, err := scanPayment(rows)
		if err != nil {
			return nil, fmt.Errorf("scan payment: %w", err)
		}
		payments = append(payments, pay)
	}
	return payments, rows.Err()
}

func (r *PaymentRepo) ListPaginated(ctx context.Context, status string, search string, limit, offset int) ([]*model.Payment, int, error) {
	where := []string{}
	args := []interface{}{}
	argIdx := 1

	if status != "" {
		where = append(where, fmt.Sprintf("p.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if search != "" {
		where = append(where, fmt.Sprintf("(u.full_name ILIKE $%d OR u.phone ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = " WHERE " + strings.Join(where, " AND ")
	}

	// Count total
	var total int
	countQuery := "SELECT COUNT(*) FROM payments p JOIN users u ON u.id = p.user_id LEFT JOIN users a ON a.id = p.approved_by" + whereClause
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count payments: %w", err)
	}

	// Fetch paginated
	dataQuery := paymentSelectJoin + whereClause +
		fmt.Sprintf(" ORDER BY p.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	dataArgs := append(args, limit, offset)

	rows, err := r.db.Query(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list payments paginated: %w", err)
	}
	defer rows.Close()

	var payments []*model.Payment
	for rows.Next() {
		pay, err := scanPayment(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan payment: %w", err)
		}
		payments = append(payments, pay)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return payments, total, nil
}

func (r *PaymentRepo) Approve(ctx context.Context, id uuid.UUID, req *model.ApproveRejectRequest) (*model.Payment, error) {
	_, err := r.db.Exec(ctx, `
		UPDATE payments SET status = 'approved', approved_by = $1, updated_at = $2 WHERE id = $3`,
		req.ApprovedBy, time.Now(), id,
	)
	if err != nil {
		return nil, fmt.Errorf("approve payment: %w", err)
	}
	return r.GetByID(ctx, id)
}

func (r *PaymentRepo) Reject(ctx context.Context, id uuid.UUID, req *model.ApproveRejectRequest) (*model.Payment, error) {
	_, err := r.db.Exec(ctx, `
		UPDATE payments SET status = 'rejected', approved_by = $1, notes = $2, updated_at = $3 WHERE id = $4`,
		req.ApprovedBy, req.Notes, time.Now(), id,
	)
	if err != nil {
		return nil, fmt.Errorf("reject payment: %w", err)
	}
	return r.GetByID(ctx, id)
}
