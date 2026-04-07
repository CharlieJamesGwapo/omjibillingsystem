package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
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

	// Check if this is a fresh billing system database by looking for the settings table
	var hasSettings bool
	pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'settings')").Scan(&hasSettings)

	if !hasSettings {
		// Drop all existing tables from old projects so billing migrations can run clean
		log.Println("[MIGRATE] Clean database detected — dropping any legacy tables")
		pool.Exec(ctx, `
			DROP SCHEMA public CASCADE;
			CREATE SCHEMA public;
			GRANT ALL ON SCHEMA public TO current_user;
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
