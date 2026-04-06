package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

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
	settingsRepo := repository.NewSettingsRepo(pool)

	// ---- SMS Provider ----
	// Check DB settings first, fall back to .env values
	smsProviderName := cfg.SMSProvider
	smsAPIKey := cfg.SMSAPIKey
	smsBaseURL := cfg.SMSBaseURL

	if dbProvider, err := settingsRepo.Get(context.Background(), "sms_provider"); err == nil && dbProvider != "" {
		smsProviderName = dbProvider
		log.Println("[SMS] Using provider from DB settings:", dbProvider)
	}
	if dbKey, err := settingsRepo.Get(context.Background(), "sms_api_key"); err == nil && dbKey != "" {
		smsAPIKey = dbKey
		log.Println("[SMS] Using API key from DB settings")
	}
	if dbURL, err := settingsRepo.Get(context.Background(), "sms_base_url"); err == nil && dbURL != "" {
		smsBaseURL = dbURL
		log.Println("[SMS] Using base URL from DB settings")
	}

	smsProvider := sms.NewProviderFromSettings(smsProviderName, smsAPIKey, smsBaseURL)

	// ---- MikroTik Manager ----
	// Check DB settings first, then fall back to .env
	var initialMTClient *mikrotik.Client
	mtHost := cfg.MikroTikHost
	mtPort := cfg.MikroTikPort
	mtUser := cfg.MikroTikUser
	mtPass := cfg.MikroTikPass

	if dbHost, err := settingsRepo.Get(context.Background(), "mikrotik_host"); err == nil && dbHost != "" {
		mtHost = dbHost
		log.Println("[MikroTik] Using host from DB settings:", dbHost)
	}
	if dbPort, err := settingsRepo.Get(context.Background(), "mikrotik_port"); err == nil && dbPort != "" {
		if p, err := strconv.Atoi(dbPort); err == nil {
			mtPort = p
		}
	}
	if dbUser, err := settingsRepo.Get(context.Background(), "mikrotik_user"); err == nil && dbUser != "" {
		mtUser = dbUser
	}
	if dbPass, err := settingsRepo.Get(context.Background(), "mikrotik_password"); err == nil && dbPass != "" {
		mtPass = dbPass
	}

	if mtHost != "" {
		mtAddr := fmt.Sprintf("%s:%d", mtHost, mtPort)
		initialMTClient = mikrotik.NewClient(mtAddr, mtUser, mtPass)
		log.Printf("[MikroTik] Configured for %s", mtAddr)
	}
	mtManager := mikrotik.NewManager(initialMTClient)

	// ---- Services ----
	authSvc := service.NewAuthService(userRepo, otpRepo, smsProvider, cfg.JWTSecret, cfg.JWTRefreshSecret)
	userSvc := service.NewUserService(userRepo, authSvc)
	planSvc := service.NewPlanService(planRepo)
	subSvc := service.NewSubscriptionService(subRepo, planRepo, mtManager)
	paymentSvc := service.NewPaymentService(paymentRepo, subRepo, subSvc)
	dashSvc := service.NewDashboardService(dashRepo, logRepo)

	// ---- Handlers ----
	authH := handler.NewAuthHandler(authSvc)
	userH := handler.NewUserHandler(userSvc)
	planH := handler.NewPlanHandler(planSvc)
	subH := handler.NewSubscriptionHandler(subSvc)
	payH := handler.NewPaymentHandler(paymentSvc)
	dashH := handler.NewDashboardHandler(dashSvc, logRepo)
	mtH := handler.NewMikroTikHandler(mtManager, settingsRepo)
	notifH := handler.NewNotificationHandler(subSvc, smsProvider)
	settingsH := handler.NewSettingsHandler(settingsRepo, smsProvider)

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
		MTHandler:       mtH,
		NotifHandler:    notifH,
		SettingsHandler: settingsH,
	}, cfg.CORSOrigins)

	addr := ":" + cfg.Port
	log.Printf("OMJI Billing API starting on %s", addr)
	if err := http.ListenAndServe(addr, h); err != nil {
		log.Fatalf("Server failed: %v", err)
		os.Exit(1)
	}
}
