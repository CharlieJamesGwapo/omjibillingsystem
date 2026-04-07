package router

import (
	"net/http"
	"strings"

	"github.com/jdns/billingsystem/internal/handler"
	"github.com/jdns/billingsystem/internal/middleware"
	"github.com/jdns/billingsystem/internal/service"
)

// Deps holds all service and handler dependencies required to build the router.
type Deps struct {
	AuthService  *service.AuthService
	AuthHandler  *handler.AuthHandler
	UserHandler  *handler.UserHandler
	PlanHandler  *handler.PlanHandler
	SubHandler   *handler.SubscriptionHandler
	PayHandler   *handler.PaymentHandler
	DashHandler  *handler.DashboardHandler
	MTHandler       *handler.MikroTikHandler
	NotifHandler    *handler.NotificationHandler
	SettingsHandler *handler.SettingsHandler
	MsgHandler      *handler.MessageHandler
}

// New builds and returns the fully wired HTTP handler with all routes and middleware.
func New(deps Deps, corsOrigins string) http.Handler {
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Public auth routes
	mux.HandleFunc("POST /api/auth/otp/request", deps.AuthHandler.RequestOTP)
	mux.HandleFunc("POST /api/auth/otp/verify", deps.AuthHandler.VerifyOTP)
	mux.HandleFunc("POST /api/auth/login", deps.AuthHandler.Login)
	mux.HandleFunc("POST /api/auth/refresh", deps.AuthHandler.Refresh)

	authMW := middleware.Auth(deps.AuthService)
	adminOnly := middleware.AdminOnly()
	adminOrTech := middleware.AdminOrTech()
	anyRole := middleware.RequireRole("admin", "technician", "customer")

	chain := func(h http.HandlerFunc, middlewares ...func(http.Handler) http.Handler) http.Handler {
		var result http.Handler = h
		for i := len(middlewares) - 1; i >= 0; i-- {
			result = middlewares[i](result)
		}
		return result
	}

	// --- Users ---
	mux.Handle("GET /api/users", chain(deps.UserHandler.List, authMW, adminOrTech))
	mux.Handle("POST /api/users", chain(deps.UserHandler.Create, authMW, adminOnly))
	mux.Handle("PUT /api/users/me", chain(deps.UserHandler.UpdateMe, authMW, anyRole))
	mux.Handle("GET /api/users/{id}", chain(deps.UserHandler.GetByID, authMW, anyRole))
	mux.Handle("PUT /api/users/{id}", chain(deps.UserHandler.Update, authMW, adminOrTech))
	mux.Handle("DELETE /api/users/{id}", chain(deps.UserHandler.Delete, authMW, adminOnly))

	// --- Plans ---
	mux.Handle("GET /api/plans", chain(deps.PlanHandler.List, authMW, anyRole))
	mux.Handle("POST /api/plans", chain(deps.PlanHandler.Create, authMW, adminOnly))
	mux.Handle("PUT /api/plans/{id}", chain(deps.PlanHandler.Update, authMW, adminOnly))
	mux.Handle("DELETE /api/plans/{id}", chain(deps.PlanHandler.Delete, authMW, adminOnly))

	// --- Subscriptions ---
	mux.Handle("GET /api/subscriptions", chain(deps.SubHandler.List, authMW, adminOrTech))
	mux.Handle("GET /api/subscriptions/mine", chain(deps.SubHandler.GetMine, authMW, anyRole))
	mux.Handle("GET /api/subscriptions/{id}", chain(deps.SubHandler.GetByID, authMW, anyRole))
	mux.Handle("POST /api/subscriptions", chain(deps.SubHandler.Create, authMW, adminOnly))
	mux.Handle("PUT /api/subscriptions/{id}", chain(deps.SubHandler.Update, authMW, adminOnly))
	mux.Handle("POST /api/subscriptions/{id}/disconnect", chain(deps.SubHandler.Disconnect, authMW, adminOrTech))
	mux.Handle("POST /api/subscriptions/{id}/reconnect", chain(deps.SubHandler.Reconnect, authMW, adminOrTech))

	// --- Payments ---
	mux.Handle("GET /api/payments", chain(deps.PayHandler.List, authMW, adminOrTech))
	mux.Handle("GET /api/payments/mine", chain(deps.PayHandler.ListMine, authMW, anyRole))
	mux.Handle("POST /api/payments", chain(deps.PayHandler.Create, authMW, anyRole))
	mux.Handle("POST /api/payments/{id}/approve", chain(deps.PayHandler.Approve, authMW, adminOrTech))
	mux.Handle("POST /api/payments/{id}/reject", chain(deps.PayHandler.Reject, authMW, adminOrTech))

	// --- Dashboard ---
	mux.Handle("GET /api/dashboard/stats", chain(deps.DashHandler.GetStats, authMW, adminOrTech))
	mux.Handle("GET /api/dashboard/income", chain(deps.DashHandler.GetIncomeReport, authMW, adminOnly))
	mux.Handle("GET /api/dashboard/chart", chain(deps.DashHandler.GetIncomeChart, authMW, adminOrTech))
	mux.Handle("GET /api/dashboard/logs", chain(deps.DashHandler.GetActivityLogs, authMW, adminOnly))

	// --- MikroTik ---
	mux.Handle("GET /api/mikrotik/status", chain(deps.MTHandler.GetStatus, authMW, adminOnly))
	mux.Handle("GET /api/mikrotik/connections", chain(deps.MTHandler.GetActiveConnections, authMW, adminOrTech))
	mux.Handle("POST /api/mikrotik/test", chain(deps.MTHandler.TestConnection, authMW, adminOnly))
	mux.Handle("POST /api/mikrotik/connect", chain(deps.MTHandler.SaveAndConnect, authMW, adminOnly))

	// --- Settings ---
	mux.Handle("GET /api/settings", chain(deps.SettingsHandler.GetSettings, authMW, adminOnly))
	mux.Handle("PUT /api/settings", chain(deps.SettingsHandler.UpdateSettings, authMW, adminOnly))
	mux.Handle("POST /api/settings/test-sms", chain(deps.SettingsHandler.TestSMS, authMW, adminOnly))

	// --- Notifications ---
	mux.Handle("POST /api/notifications/send-reminders", chain(deps.NotifHandler.SendReminders, authMW, adminOnly))

	// --- Messages ---
	mux.Handle("POST /api/messages/send", chain(deps.MsgHandler.SendToOne, authMW, adminOnly))
	mux.Handle("POST /api/messages/bulk", chain(deps.MsgHandler.SendBulk, authMW, adminOnly))
	mux.Handle("POST /api/messages/template", chain(deps.MsgHandler.SendTemplate, authMW, adminOnly))
	mux.Handle("POST /api/messages/reminders", chain(deps.MsgHandler.SendReminders, authMW, adminOnly))
	mux.Handle("GET /api/messages", chain(deps.MsgHandler.GetHistory, authMW, adminOnly))
	mux.Handle("GET /api/messages/templates", chain(deps.MsgHandler.GetTemplates, authMW, adminOnly))
	mux.Handle("PUT /api/messages/templates/{id}", chain(deps.MsgHandler.UpdateTemplate, authMW, adminOnly))

	// --- Static uploads ---
	mux.Handle("GET /api/uploads/", http.StripPrefix("/api/uploads/", http.FileServer(http.Dir("uploads"))))

	return corsMiddleware(mux, corsOrigins)
}

// corsMiddleware wraps a handler with CORS headers and handles preflight OPTIONS requests.
func corsMiddleware(next http.Handler, originsConfig string) http.Handler {
	allowedOrigins := parseOrigins(originsConfig)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Check if origin is allowed
		if origin != "" && isAllowedOrigin(origin, allowedOrigins) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		} else if origin == "" || len(allowedOrigins) == 0 {
			// Allow all if no origins configured (dev mode)
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "86400")

		// Handle preflight
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func parseOrigins(config string) []string {
	if config == "" {
		return nil
	}
	parts := strings.Split(config, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}

func isAllowedOrigin(origin string, allowed []string) bool {
	for _, a := range allowed {
		if a == origin || a == "*" {
			return true
		}
	}
	return false
}
