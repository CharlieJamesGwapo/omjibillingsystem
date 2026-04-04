package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jdns/billingsystem/internal/model"
)

type ActivityLogRepo struct {
	db *pgxpool.Pool
}

func NewActivityLogRepo(db *pgxpool.Pool) *ActivityLogRepo {
	return &ActivityLogRepo{db: db}
}

func (r *ActivityLogRepo) Create(ctx context.Context, log *model.ActivityLog) (*model.ActivityLog, error) {
	detailsJSON, err := json.Marshal(log.Details)
	if err != nil {
		return nil, fmt.Errorf("marshal activity log details: %w", err)
	}

	result := &model.ActivityLog{}
	var detailsRaw []byte
	err = r.db.QueryRow(ctx, `
		INSERT INTO activity_logs (user_id, action, target_type, target_id, details, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, user_id, action, target_type, target_id, details, ip_address, created_at`,
		log.UserID, log.Action, log.TargetType, log.TargetID, detailsJSON, log.IPAddress,
	).Scan(&result.ID, &result.UserID, &result.Action, &result.TargetType, &result.TargetID,
		&detailsRaw, &result.IPAddress, &result.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create activity log: %w", err)
	}

	if detailsRaw != nil {
		if err := json.Unmarshal(detailsRaw, &result.Details); err != nil {
			return nil, fmt.Errorf("unmarshal activity log details: %w", err)
		}
	}
	return result, nil
}

func (r *ActivityLogRepo) List(ctx context.Context, limit int) ([]*model.ActivityLog, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.db.Query(ctx, `
		SELECT al.id, al.user_id, al.action, al.target_type, al.target_id, al.details, al.ip_address, al.created_at,
		       u.full_name
		FROM activity_logs al
		JOIN users u ON u.id = al.user_id
		ORDER BY al.created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("list activity logs: %w", err)
	}
	defer rows.Close()

	var logs []*model.ActivityLog
	for rows.Next() {
		al := &model.ActivityLog{}
		var detailsRaw []byte
		if err := rows.Scan(&al.ID, &al.UserID, &al.Action, &al.TargetType, &al.TargetID,
			&detailsRaw, &al.IPAddress, &al.CreatedAt, &al.UserName); err != nil {
			return nil, fmt.Errorf("scan activity log: %w", err)
		}
		if detailsRaw != nil {
			if err := json.Unmarshal(detailsRaw, &al.Details); err != nil {
				return nil, fmt.Errorf("unmarshal activity log details: %w", err)
			}
		}
		logs = append(logs, al)
	}
	return logs, rows.Err()
}

// Ensure uuid is used (for TargetID type compatibility)
var _ uuid.UUID
