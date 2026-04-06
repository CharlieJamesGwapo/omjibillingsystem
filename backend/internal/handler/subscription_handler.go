package handler

import (
	"net/http"
	"strconv"

	"github.com/jdns/billingsystem/internal/middleware"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
	"github.com/jdns/billingsystem/internal/service"
)

// SubscriptionHandler handles subscription-related HTTP requests.
type SubscriptionHandler struct {
	subService *service.SubscriptionService
	subRepo    *repository.SubscriptionRepo
}

// NewSubscriptionHandler creates a new SubscriptionHandler.
func NewSubscriptionHandler(subService *service.SubscriptionService, subRepo *repository.SubscriptionRepo) *SubscriptionHandler {
	return &SubscriptionHandler{subService: subService, subRepo: subRepo}
}

// List returns subscriptions with pagination and search support.
// Query params: ?page=1&limit=20&search=&status=
func (h *SubscriptionHandler) List(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit
	search := r.URL.Query().Get("search")
	status := r.URL.Query().Get("status")

	subs, total, err := h.subRepo.ListPaginated(r.Context(), status, search, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list subscriptions")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":  subs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetByID retrieves a subscription. Customers may only view their own subscriptions.
func (h *SubscriptionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid subscription id")
		return
	}

	sub, err := h.subService.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "subscription not found")
		return
	}

	// Ownership check for customers
	callerRole := middleware.GetRole(r.Context())
	callerID := middleware.GetUserID(r.Context())
	if callerRole == model.RoleCustomer && sub.UserID != callerID {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	writeJSON(w, http.StatusOK, sub)
}

// GetMine returns the subscriptions belonging to the authenticated user.
func (h *SubscriptionHandler) GetMine(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	subs, err := h.subService.GetByUserID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get subscriptions")
		return
	}
	writeJSON(w, http.StatusOK, subs)
}

// Create creates a new subscription.
func (h *SubscriptionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateSubscriptionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	sub, err := h.subService.Create(r.Context(), &req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create subscription")
		return
	}
	writeJSON(w, http.StatusCreated, sub)
}

// Update updates a subscription.
func (h *SubscriptionHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid subscription id")
		return
	}

	var req model.UpdateSubscriptionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	sub, err := h.subService.Update(r.Context(), id, &req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update subscription")
		return
	}
	writeJSON(w, http.StatusOK, sub)
}

// Disconnect suspends a subscription and disables its MikroTik queue.
func (h *SubscriptionHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid subscription id")
		return
	}

	if err := h.subService.Disconnect(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to disconnect subscription")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "subscription disconnected"})
}

// Reconnect reactivates a subscription and enables its MikroTik queue.
func (h *SubscriptionHandler) Reconnect(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid subscription id")
		return
	}

	if err := h.subService.Reconnect(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to reconnect subscription")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "subscription reconnected"})
}
