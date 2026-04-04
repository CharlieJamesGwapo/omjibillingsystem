package handler

import (
	"net/http"

	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/service"
)

// PlanHandler handles internet plan HTTP requests.
type PlanHandler struct {
	planService *service.PlanService
}

// NewPlanHandler creates a new PlanHandler.
func NewPlanHandler(planService *service.PlanService) *PlanHandler {
	return &PlanHandler{planService: planService}
}

// List returns all plans. Supports ?active=true to filter to active-only.
func (h *PlanHandler) List(w http.ResponseWriter, r *http.Request) {
	activeOnly := r.URL.Query().Get("active") == "true"
	plans, err := h.planService.List(r.Context(), activeOnly)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list plans")
		return
	}
	writeJSON(w, http.StatusOK, plans)
}

// Create creates a new internet plan.
func (h *PlanHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreatePlanRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.SpeedMbps <= 0 || req.Price <= 0 {
		writeError(w, http.StatusBadRequest, "name, speed_mbps, and price are required")
		return
	}

	plan, err := h.planService.Create(r.Context(), &req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create plan")
		return
	}
	writeJSON(w, http.StatusCreated, plan)
}

// Update updates an existing plan.
func (h *PlanHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid plan id")
		return
	}

	var req model.UpdatePlanRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	plan, err := h.planService.Update(r.Context(), id, &req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update plan")
		return
	}
	writeJSON(w, http.StatusOK, plan)
}

// Delete removes a plan.
func (h *PlanHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid plan id")
		return
	}

	if err := h.planService.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete plan")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "plan deleted"})
}
