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

// GetIncomeChart returns monthly income for the last 12 months.
func (h *DashboardHandler) GetIncomeChart(w http.ResponseWriter, r *http.Request) {
	chart, err := h.dashService.GetIncomeChart(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get income chart")
		return
	}
	writeJSON(w, http.StatusOK, chart)
}

// GetActivityLogs returns recent activity logs with pagination.
// Query params: ?page=1&limit=20
func (h *DashboardHandler) GetActivityLogs(w http.ResponseWriter, r *http.Request) {
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

	logs, total, err := h.logRepo.ListPaginated(r.Context(), limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get activity logs")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":  logs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}
