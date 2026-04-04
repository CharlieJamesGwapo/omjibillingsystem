package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jdns/billingsystem/internal/model"
)

type OTPRepo struct {
	db *pgxpool.Pool
}

func NewOTPRepo(db *pgxpool.Pool) *OTPRepo {
	return &OTPRepo{db: db}
}

func (r *OTPRepo) Create(ctx context.Context, phone, code string, expiresAt time.Time) (*model.OTP, error) {
	otp := &model.OTP{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO otp_codes (phone, code, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, phone, expires_at, verified, created_at`,
		phone, code, expiresAt,
	).Scan(&otp.ID, &otp.Phone, &otp.ExpiresAt, &otp.Verified, &otp.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create otp: %w", err)
	}
	return otp, nil
}

func (r *OTPRepo) Verify(ctx context.Context, phone, code string) (bool, error) {
	result, err := r.db.Exec(ctx, `
		UPDATE otp_codes
		SET verified = true
		WHERE phone = $1
		  AND code = $2
		  AND expires_at > NOW()
		  AND verified = false`,
		phone, code,
	)
	if err != nil {
		return false, fmt.Errorf("verify otp: %w", err)
	}
	return result.RowsAffected() > 0, nil
}

func (r *OTPRepo) CountRecent(ctx context.Context, phone string, since time.Time) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM otp_codes WHERE phone = $1 AND created_at > $2`,
		phone, since,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count recent otp: %w", err)
	}
	return count, nil
}
