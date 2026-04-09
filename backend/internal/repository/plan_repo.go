package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jdns/billingsystem/internal/model"
)

type PlanRepo struct {
	db *pgxpool.Pool
}

func NewPlanRepo(db *pgxpool.Pool) *PlanRepo {
	return &PlanRepo{db: db}
}

func (r *PlanRepo) Create(ctx context.Context, req *model.CreatePlanRequest) (*model.Plan, error) {
	p := &model.Plan{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO plans (name, speed_mbps, price, description, is_active, mikrotik_profile)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, speed_mbps, price, description, is_active, mikrotik_profile, created_at`,
		req.Name, req.SpeedMbps, req.Price, req.Description, req.IsActive, req.MikroTikProfile,
	).Scan(&p.ID, &p.Name, &p.SpeedMbps, &p.Price, &p.Description, &p.IsActive, &p.MikroTikProfile, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create plan: %w", err)
	}
	return p, nil
}

func (r *PlanRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Plan, error) {
	p := &model.Plan{}
	err := r.db.QueryRow(ctx, `
		SELECT id, name, speed_mbps, price, description, is_active, mikrotik_profile, created_at
		FROM plans WHERE id = $1`, id,
	).Scan(&p.ID, &p.Name, &p.SpeedMbps, &p.Price, &p.Description, &p.IsActive, &p.MikroTikProfile, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get plan by id: %w", err)
	}
	return p, nil
}

func (r *PlanRepo) GetByName(ctx context.Context, name string) (*model.Plan, error) {
	p := &model.Plan{}
	err := r.db.QueryRow(ctx, `
		SELECT id, name, speed_mbps, price, description, is_active, mikrotik_profile, created_at
		FROM plans WHERE name = $1`, name,
	).Scan(&p.ID, &p.Name, &p.SpeedMbps, &p.Price, &p.Description, &p.IsActive, &p.MikroTikProfile, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get plan by name: %w", err)
	}
	return p, nil
}

func (r *PlanRepo) List(ctx context.Context, activeOnly bool) ([]*model.Plan, error) {
	query := `SELECT id, name, speed_mbps, price, description, is_active, mikrotik_profile, created_at FROM plans`
	if activeOnly {
		query += ` WHERE is_active = true`
	}
	query += ` ORDER BY price ASC`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list plans: %w", err)
	}
	defer rows.Close()

	var plans []*model.Plan
	for rows.Next() {
		p := &model.Plan{}
		if err := rows.Scan(&p.ID, &p.Name, &p.SpeedMbps, &p.Price, &p.Description, &p.IsActive, &p.MikroTikProfile, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan plan: %w", err)
		}
		plans = append(plans, p)
	}
	return plans, rows.Err()
}

func (r *PlanRepo) Update(ctx context.Context, id uuid.UUID, req *model.UpdatePlanRequest) (*model.Plan, error) {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.SpeedMbps != nil {
		setClauses = append(setClauses, fmt.Sprintf("speed_mbps = $%d", argIdx))
		args = append(args, *req.SpeedMbps)
		argIdx++
	}
	if req.Price != nil {
		setClauses = append(setClauses, fmt.Sprintf("price = $%d", argIdx))
		args = append(args, *req.Price)
		argIdx++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *req.Description)
		argIdx++
	}
	if req.IsActive != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *req.IsActive)
		argIdx++
	}
	if req.MikroTikProfile != nil {
		setClauses = append(setClauses, fmt.Sprintf("mikrotik_profile = $%d", argIdx))
		args = append(args, *req.MikroTikProfile)
		argIdx++
	}

	if len(setClauses) == 0 {
		return r.GetByID(ctx, id)
	}

	args = append(args, id)
	query := fmt.Sprintf(`UPDATE plans SET %s WHERE id = $%d
		RETURNING id, name, speed_mbps, price, description, is_active, mikrotik_profile, created_at`,
		strings.Join(setClauses, ", "), argIdx)

	p := &model.Plan{}
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&p.ID, &p.Name, &p.SpeedMbps, &p.Price, &p.Description, &p.IsActive, &p.MikroTikProfile, &p.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update plan: %w", err)
	}
	return p, nil
}

func (r *PlanRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM plans WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete plan: %w", err)
	}
	return nil
}
