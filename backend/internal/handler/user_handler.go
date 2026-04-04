package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/middleware"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/service"
)

// UserHandler handles user management HTTP requests.
type UserHandler struct {
	userService *service.UserService
}

// NewUserHandler creates a new UserHandler.
func NewUserHandler(userService *service.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

// List returns all users, optionally filtered by ?role=.
func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	var roleFilter *model.UserRole
	if roleStr := r.URL.Query().Get("role"); roleStr != "" {
		role := model.UserRole(roleStr)
		roleFilter = &role
	}

	users, err := h.userService.List(r.Context(), roleFilter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	writeJSON(w, http.StatusOK, users)
}

// GetByID retrieves a single user. Customers may only view their own profile.
func (h *UserHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	// Customers can only view their own profile
	callerRole := middleware.GetRole(r.Context())
	callerID := middleware.GetUserID(r.Context())
	if callerRole == model.RoleCustomer && callerID != id {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	user, err := h.userService.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

// Create creates a new user.
func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateUserRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Phone == "" || req.FullName == "" || req.Role == "" {
		writeError(w, http.StatusBadRequest, "phone, full_name, and role are required")
		return
	}

	user, err := h.userService.Create(r.Context(), &req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create user")
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

// Update updates an existing user.
func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var req model.UpdateUserRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := h.userService.Update(r.Context(), id, &req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update user")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

// Delete removes a user.
func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	if err := h.userService.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete user")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "user deleted"})
}

// ensure uuid import is used
var _ uuid.UUID
