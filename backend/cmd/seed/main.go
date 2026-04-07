package main

import (
	"context"
	"log"
	"path/filepath"
	"strings"

	"github.com/jdns/billingsystem/internal/config"
	"github.com/jdns/billingsystem/internal/database"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	pool, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	migrationsDir := filepath.Join("migrations")
	if err := database.RunMigrations(pool, migrationsDir); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	ctx := context.Background()
	userRepo := repository.NewUserRepo(pool)
	planRepo := repository.NewPlanRepo(pool)

	// ---- Seed Users ----
	type seedUser struct {
		phone    string
		name     string
		password string
		role     model.UserRole
	}

	seedUsers := []seedUser{
		{
			phone:    "09170000001",
			name:     "OMJI Admin",
			password: "admin123",
			role:     model.RoleAdmin,
		},
		{
			phone:    "09170000002",
			name:     "Mark Rivera (Technician)",
			password: "tech123",
			role:     model.RoleTechnician,
		},
	}

	for _, su := range seedUsers {
		// Check if user already exists
		existing, _ := userRepo.GetByPhone(ctx, su.phone)
		if existing != nil {
			log.Printf("User already exists: %s (%s) — skipping", su.name, su.phone)
			continue
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(su.password), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash password for %s: %v", su.name, err)
		}
		hashStr := string(hash)

		req := &model.CreateUserRequest{
			Phone:    su.phone,
			FullName: su.name,
			Role:     su.role,
			Password: &hashStr,
			Status:   model.StatusActive,
		}

		user, err := userRepo.Create(ctx, req, &hashStr)
		if err != nil {
			if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
				log.Printf("User already exists (db constraint): %s — skipping", su.name)
				continue
			}
			log.Fatalf("Failed to create user %s: %v", su.name, err)
		}
		log.Printf("Created user: %s (%s) id=%s", user.FullName, user.Phone, user.ID)
	}

	// ---- Seed Plans ----
	type seedPlan struct {
		name      string
		speedMbps int
		price     float64
	}

	seedPlans := []seedPlan{
		{name: "Basic 10Mbps", speedMbps: 10, price: 500},
		{name: "Standard 20Mbps", speedMbps: 20, price: 800},
		{name: "Premium 50Mbps", speedMbps: 50, price: 1500},
	}

	for _, sp := range seedPlans {
		// Check if plan with same name exists already
		existing, _ := planRepo.GetByName(ctx, sp.name)
		if existing != nil {
			log.Printf("Plan already exists: %s — skipping", sp.name)
			continue
		}

		req := &model.CreatePlanRequest{
			Name:      sp.name,
			SpeedMbps: sp.speedMbps,
			Price:     sp.price,
			IsActive:  true,
		}

		plan, err := planRepo.Create(ctx, req)
		if err != nil {
			if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
				log.Printf("Plan already exists (db constraint): %s — skipping", sp.name)
				continue
			}
			log.Fatalf("Failed to create plan %s: %v", sp.name, err)
		}
		log.Printf("Created plan: %s (%dMbps @ ₱%.0f) id=%s", plan.Name, plan.SpeedMbps, plan.Price, plan.ID)
	}

	log.Println("Seed complete.")
}
