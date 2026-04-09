package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
)

type Config struct {
	Port            string
	DatabaseURL     string
	JWTSecret       string
	JWTRefreshSecret string
	MikroTikHost    string
	MikroTikPort    int
	MikroTikUser    string
	MikroTikPass    string
	AgentSecret     string
	SMSProvider     string
	SMSAPIKey       string
	SMSBaseURL      string
	R2AccountID     string
	R2AccessKey     string
	R2SecretKey     string
	R2Bucket        string
	CORSOrigins     string
}

func Load() (*Config, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	mtPort, _ := strconv.Atoi(os.Getenv("MIKROTIK_PORT"))
	if mtPort == 0 {
		mtPort = 8728
	}

	return &Config{
		Port:             port,
		DatabaseURL:      dbURL,
		JWTSecret:        os.Getenv("JWT_SECRET"),
		JWTRefreshSecret: os.Getenv("JWT_REFRESH_SECRET"),
		MikroTikHost:     os.Getenv("MIKROTIK_HOST"),
		MikroTikPort:     mtPort,
		MikroTikUser:     os.Getenv("MIKROTIK_USER"),
		MikroTikPass:     os.Getenv("MIKROTIK_PASSWORD"),
		AgentSecret: func() string {
			s := os.Getenv("AGENT_SECRET")
			if s == "" {
				log.Println("[WARNING] AGENT_SECRET is not set. Using default — NOT safe for production.")
				return "changeme-agent-secret"
			}
			return s
		}(),
		SMSProvider:      os.Getenv("SMS_PROVIDER"),
		SMSAPIKey:        os.Getenv("SMS_API_KEY"),
		SMSBaseURL:       os.Getenv("SMS_BASE_URL"),
		R2AccountID:      os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKey:      os.Getenv("R2_ACCESS_KEY"),
		R2SecretKey:      os.Getenv("R2_SECRET_KEY"),
		R2Bucket:         os.Getenv("R2_BUCKET"),
		CORSOrigins:      os.Getenv("CORS_ORIGINS"),
	}, nil
}
