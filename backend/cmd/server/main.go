package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/jdns/billingsystem/internal/config"
	"github.com/jdns/billingsystem/internal/cron"
	"github.com/jdns/billingsystem/internal/database"
	"github.com/jdns/billingsystem/internal/handler"
	"github.com/jdns/billingsystem/internal/mikrotik"
	"github.com/jdns/billingsystem/internal/repository"
	"github.com/jdns/billingsystem/internal/router"
	"github.com/jdns/billingsystem/internal/service"
	"github.com/jdns/billingsystem/internal/sms"
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

	// ---- Repositories ----
	userRepo := repository.NewUserRepo(pool)
	otpRepo := repository.NewOTPRepo(pool)
	planRepo := repository.NewPlanRepo(pool)
	subRepo := repository.NewSubscriptionRepo(pool)
	paymentRepo := repository.NewPaymentRepo(pool)
	dashRepo := repository.NewDashboardRepo(pool)
	logRepo := repository.NewActivityLogRepo(pool)

	// ---- SMS Provider ----
	smsProvider := sms.NewMockProvider()

	// ---- MikroTik Client ----
	var mtClient *mikrotik.Client
	if cfg.MikroTikHost != "" {
		mtAddr := fmt.Sprintf("%s:%d", cfg.MikroTikHost, cfg.MikroTikPort)
		mtClient = mikrotik.NewClient(mtAddr, cfg.MikroTikUser, cfg.MikroTikPass)
	}

	// ---- Services ----
	authSvc := service.NewAuthService(userRepo, otpRepo, smsProvider, cfg.JWTSecret, cfg.JWTRefreshSecret)
	userSvc := service.NewUserService(userRepo, authSvc)
	planSvc := service.NewPlanService(planRepo)
	subSvc := service.NewSubscriptionService(subRepo, planRepo, mtClient)
	paymentSvc := service.NewPaymentService(paymentRepo, subRepo, subSvc)
	dashSvc := service.NewDashboardService(dashRepo, logRepo)

	// ---- Handlers ----
	authH := handler.NewAuthHandler(authSvc)
	userH := handler.NewUserHandler(userSvc)
	planH := handler.NewPlanHandler(planSvc)
	subH := handler.NewSubscriptionHandler(subSvc)
	payH := handler.NewPaymentHandler(paymentSvc)
	dashH := handler.NewDashboardHandler(dashSvc, logRepo)
	mtH := handler.NewMikroTikHandler(mtClient)
	notifH := handler.NewNotificationHandler(subSvc, smsProvider)

	// ---- Cron Scheduler ----
	scheduler := cron.NewScheduler(subSvc, smsProvider)
	scheduler.Start()
	defer scheduler.Stop()

	// ---- Router ----
	h := router.New(router.Deps{
		AuthService:  authSvc,
		AuthHandler:  authH,
		UserHandler:  userH,
		PlanHandler:  planH,
		SubHandler:   subH,
		PayHandler:   payH,
		DashHandler:  dashH,
		MTHandler:    mtH,
		NotifHandler: notifH,
	}, cfg.CORSOrigins)

	addr := ":" + cfg.Port
	log.Printf("JDNS Billing API starting on %s", addr)
	if err := http.ListenAndServe(addr, h); err != nil {
		log.Fatalf("Server failed: %v", err)
		os.Exit(1)
	}
}
