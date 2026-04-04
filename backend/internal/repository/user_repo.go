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

type UserRepo struct {
	db *pgxpool.Pool
}

func NewUserRepo(db *pgxpool.Pool) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) Create(ctx context.Context, req *model.CreateUserRequest, passwordHash *string) (*model.User, error) {
	u := &model.User{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO users (phone, full_name, email, address, role, password_hash, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, phone, full_name, email, address, role, status, created_at, updated_at`,
		req.Phone, req.FullName, req.Email, req.Address, req.Role, passwordHash, req.Status,
	).Scan(&u.ID, &u.Phone, &u.FullName, &u.Email, &u.Address, &u.Role, &u.Status, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}

func (r *UserRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	u := &model.User{}
	err := r.db.QueryRow(ctx, `
		SELECT id, phone, full_name, email, address, role, password_hash, status, created_at, updated_at
		FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Phone, &u.FullName, &u.Email, &u.Address, &u.Role, &u.PasswordHash, &u.Status, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return u, nil
}

func (r *UserRepo) GetByPhone(ctx context.Context, phone string) (*model.User, error) {
	u := &model.User{}
	err := r.db.QueryRow(ctx, `
		SELECT id, phone, full_name, email, address, role, password_hash, status, created_at, updated_at
		FROM users WHERE phone = $1`, phone,
	).Scan(&u.ID, &u.Phone, &u.FullName, &u.Email, &u.Address, &u.Role, &u.PasswordHash, &u.Status, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get user by phone: %w", err)
	}
	return u, nil
}

func (r *UserRepo) List(ctx context.Context, role *model.UserRole) ([]*model.User, error) {
	query := `SELECT id, phone, full_name, email, address, role, status, created_at, updated_at FROM users`
	args := []interface{}{}
	if role != nil {
		query += ` WHERE role = $1`
		args = append(args, *role)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []*model.User
	for rows.Next() {
		u := &model.User{}
		if err := rows.Scan(&u.ID, &u.Phone, &u.FullName, &u.Email, &u.Address, &u.Role, &u.Status, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepo) Update(ctx context.Context, id uuid.UUID, req *model.UpdateUserRequest, passwordHash *string) (*model.User, error) {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.FullName != nil {
		setClauses = append(setClauses, fmt.Sprintf("full_name = $%d", argIdx))
		args = append(args, *req.FullName)
		argIdx++
	}
	if req.Email != nil {
		setClauses = append(setClauses, fmt.Sprintf("email = $%d", argIdx))
		args = append(args, *req.Email)
		argIdx++
	}
	if req.Address != nil {
		setClauses = append(setClauses, fmt.Sprintf("address = $%d", argIdx))
		args = append(args, *req.Address)
		argIdx++
	}
	if req.Role != nil {
		setClauses = append(setClauses, fmt.Sprintf("role = $%d", argIdx))
		args = append(args, *req.Role)
		argIdx++
	}
	if req.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
	}
	if passwordHash != nil {
		setClauses = append(setClauses, fmt.Sprintf("password_hash = $%d", argIdx))
		args = append(args, *passwordHash)
		argIdx++
	}

	if len(setClauses) == 0 {
		return r.GetByID(ctx, id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIdx))
	args = append(args, time.Now())
	argIdx++

	args = append(args, id)
	query := fmt.Sprintf(`UPDATE users SET %s WHERE id = $%d
		RETURNING id, phone, full_name, email, address, role, status, created_at, updated_at`,
		strings.Join(setClauses, ", "), argIdx)

	u := &model.User{}
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&u.ID, &u.Phone, &u.FullName, &u.Email, &u.Address, &u.Role, &u.Status, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update user: %w", err)
	}
	return u, nil
}

func (r *UserRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	return nil
}
