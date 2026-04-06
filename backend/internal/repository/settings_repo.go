package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Setting represents a single configuration setting stored in the database.
type Setting struct {
	Key         string    `json:"key"`
	Value       string    `json:"value"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// SettingsRepo handles database operations for the settings table.
type SettingsRepo struct {
	db *pgxpool.Pool
}

// NewSettingsRepo creates a new SettingsRepo.
func NewSettingsRepo(db *pgxpool.Pool) *SettingsRepo {
	return &SettingsRepo{db: db}
}

// GetAll returns all settings ordered by category and key.
func (r *SettingsRepo) GetAll(ctx context.Context) ([]Setting, error) {
	rows, err := r.db.Query(ctx, `
		SELECT key, value, description, category, updated_at
		FROM settings
		ORDER BY category, key`)
	if err != nil {
		return nil, fmt.Errorf("get all settings: %w", err)
	}
	defer rows.Close()

	var settings []Setting
	for rows.Next() {
		var s Setting
		if err := rows.Scan(&s.Key, &s.Value, &s.Description, &s.Category, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan setting: %w", err)
		}
		settings = append(settings, s)
	}
	return settings, rows.Err()
}

// GetByCategory returns settings filtered by the given category.
func (r *SettingsRepo) GetByCategory(ctx context.Context, category string) ([]Setting, error) {
	rows, err := r.db.Query(ctx, `
		SELECT key, value, description, category, updated_at
		FROM settings
		WHERE category = $1
		ORDER BY key`, category)
	if err != nil {
		return nil, fmt.Errorf("get settings by category: %w", err)
	}
	defer rows.Close()

	var settings []Setting
	for rows.Next() {
		var s Setting
		if err := rows.Scan(&s.Key, &s.Value, &s.Description, &s.Category, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan setting: %w", err)
		}
		settings = append(settings, s)
	}
	return settings, rows.Err()
}

// Get returns the value of a single setting by key.
func (r *SettingsRepo) Get(ctx context.Context, key string) (string, error) {
	var value string
	err := r.db.QueryRow(ctx, `SELECT value FROM settings WHERE key = $1`, key).Scan(&value)
	if err != nil {
		return "", fmt.Errorf("get setting %q: %w", key, err)
	}
	return value, nil
}

// Set upserts a single setting value and updates the timestamp.
func (r *SettingsRepo) Set(ctx context.Context, key, value string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO settings (key, value, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`, key, value)
	if err != nil {
		return fmt.Errorf("set setting %q: %w", key, err)
	}
	return nil
}

// SetMultiple upserts multiple settings at once within a transaction.
func (r *SettingsRepo) SetMultiple(ctx context.Context, settings map[string]string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for key, value := range settings {
		_, err := tx.Exec(ctx, `
			INSERT INTO settings (key, value, updated_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`, key, value)
		if err != nil {
			return fmt.Errorf("set setting %q: %w", key, err)
		}
	}

	return tx.Commit(ctx)
}
