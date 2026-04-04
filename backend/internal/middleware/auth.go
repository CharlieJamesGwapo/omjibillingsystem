package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/service"
)

type contextKey string

const (
	contextKeyUserID contextKey = "user_id"
	contextKeyRole   contextKey = "role"
)

// Auth is an HTTP middleware that validates Bearer JWT tokens and sets user context.
func Auth(authSvc *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, `{"error":"missing or invalid authorization header"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := authSvc.ValidateToken(tokenStr)
			if err != nil {
				http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), contextKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, contextKeyRole, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserID retrieves the authenticated user's UUID from the request context.
func GetUserID(ctx context.Context) uuid.UUID {
	val, _ := ctx.Value(contextKeyUserID).(uuid.UUID)
	return val
}

// GetRole retrieves the authenticated user's role from the request context.
func GetRole(ctx context.Context) model.UserRole {
	val, _ := ctx.Value(contextKeyRole).(model.UserRole)
	return val
}
