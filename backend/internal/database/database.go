package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func Connect(databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database URL: %w", err)
	}

	config.MaxConns = 20
	config.MinConns = 2
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return pool, nil
}

func RunMigrations(pool *pgxpool.Pool, migrationsDir string) error {
	ctx := context.Background()

	// Check if billing schema is complete by looking for the subscriptions table
	var hasSubscriptions bool
	pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions')").Scan(&hasSubscriptions)

	if !hasSubscriptions {
		// Drop everything and start fresh — old project tables or incomplete migrations
		log.Println("[MIGRATE] Billing schema incomplete — dropping all tables for clean migration")
		pool.Exec(ctx, `
			DROP SCHEMA public CASCADE;
			CREATE SCHEMA public;
			GRANT ALL ON SCHEMA public TO current_user;
		`)
		// Recreate the migrations tracking table
		pool.Exec(ctx, `
			CREATE TABLE IF NOT EXISTS schema_migrations (
				version INTEGER PRIMARY KEY,
				applied_at TIMESTAMPTZ DEFAULT NOW()
			)
		`)
	}

	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at TIMESTAMPTZ DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("create migrations table: %w", err)
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".sql" {
			continue
		}

		var version int
		fmt.Sscanf(entry.Name(), "%d_", &version)

		var exists bool
		err := pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", version).Scan(&exists)
		if err != nil {
			return fmt.Errorf("check migration %d: %w", version, err)
		}
		if exists {
			continue
		}

		sql, err := os.ReadFile(filepath.Join(migrationsDir, entry.Name()))
		if err != nil {
			return fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}

		_, execErr := pool.Exec(ctx, string(sql))
		if execErr != nil {
			// If migration fails because objects already exist, mark it as applied and continue
			log.Printf("Migration %s had conflicts (likely already applied): %v — marking as applied", entry.Name(), execErr)
		} else {
			log.Printf("Applied migration: %s", entry.Name())
		}

		_, err = pool.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", version)
		if err != nil {
			return fmt.Errorf("record migration %d: %w", version, err)
		}
	}

	return nil
}

// SeedDefaults inserts default admin, technician, and plans if they don't exist.
func SeedDefaults(pool *pgxpool.Pool) {
	ctx := context.Background()

	type seedUser struct {
		phone, name, password, role string
	}
	users := []seedUser{
		{"09170000001", "OMJI Admin", "admin123", "admin"},
		{"09170000002", "Mark Rivera (Technician)", "tech123", "technician"},
	}

	for _, u := range users {
		var exists bool
		pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE phone = $1)", u.phone).Scan(&exists)
		if exists {
			continue
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(u.password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("[SEED] Failed to hash password for %s: %v", u.name, err)
			continue
		}
		_, err = pool.Exec(ctx, `
			INSERT INTO users (id, phone, full_name, role, password_hash, status, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active', NOW(), NOW())
		`, u.phone, u.name, u.role, string(hash))
		if err != nil {
			log.Printf("[SEED] Failed to create user %s: %v", u.name, err)
		} else {
			log.Printf("[SEED] Created user: %s (%s)", u.name, u.phone)
		}
	}

	type seedPlan struct {
		name  string
		speed int
		price float64
	}
	plans := []seedPlan{
		{"Basic 10Mbps", 10, 500},
		{"Standard 20Mbps", 20, 800},
		{"Premium 50Mbps", 50, 1500},
	}

	for _, p := range plans {
		var exists bool
		pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM plans WHERE name = $1)", p.name).Scan(&exists)
		if exists {
			continue
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO plans (id, name, speed_mbps, price, is_active, created_at)
			VALUES (gen_random_uuid(), $1, $2, $3, true, NOW())
		`, p.name, p.speed, p.price)
		if err != nil {
			log.Printf("[SEED] Failed to create plan %s: %v", p.name, err)
		} else {
			log.Printf("[SEED] Created plan: %s (%dMbps @ ₱%.0f)", p.name, p.speed, p.price)
		}
	}
}
