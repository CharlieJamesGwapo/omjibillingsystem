package middleware

import (
	"net/http"

	"github.com/jdns/billingsystem/internal/model"
)

// RequireRole returns middleware that allows only the specified roles.
func RequireRole(roles ...model.UserRole) func(http.Handler) http.Handler {
	allowed := make(map[model.UserRole]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role := GetRole(r.Context())
			if _, ok := allowed[role]; !ok {
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// AdminOnly allows only admin users.
func AdminOnly() func(http.Handler) http.Handler {
	return RequireRole(model.RoleAdmin)
}

// AdminOrTech allows admin and technician users.
func AdminOrTech() func(http.Handler) http.Handler {
	return RequireRole(model.RoleAdmin, model.RoleTechnician)
}
