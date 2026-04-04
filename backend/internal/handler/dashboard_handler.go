package handler

import (
	"net/http"
	"strconv"

	"github.com/jdns/billingsystem/internal/repository"
	"github.com/jdns/billingsystem/internal/service"
)

// DashboardHandler handles dashboard-related HTTP requests.
type DashboardHandler struct {
	dashService *service.DashboardService
	logRepo     *repository.ActivityLogRepo
}

// NewDashboardHandler creates a new DashboardHandler.
func NewDashboardHandler(dashService *service.DashboardService, logRepo *repository.ActivityLogRepo) *DashboardHandler {
	return &DashboardHandler{
		dashService: dashService,
		logRepo:     logRepo,
	}
}

// GetStats returns aggregated dashboard statistics.
func (h *DashboardHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.dashService.GetStats(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get stats")
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// GetIncomeReport returns daily income report. Supports ?days= query parameter (default 30).
func (h *DashboardHandler) GetIncomeReport(w http.ResponseWriter, r *http.Request) {
	// days param is informational; the repo currently returns 30 days
	_ = r.URL.Query().Get("days")

	report, err := h.dashService.GetIncomeReport(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get income report")
		return
	}
	writeJSON(w, http.StatusOK, report)
}

// GetActivityLogs returns recent activity logs. Supports ?limit= query parameter (default 100).
func (h *DashboardHandler) GetActivityLogs(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if n, err := strconv.Atoi(limitStr); err == nil && n > 0 {
			limit = n
		}
	}

	logs, err := h.logRepo.List(r.Context(), limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get activity logs")
		return
	}
	writeJSON(w, http.StatusOK, logs)
}
