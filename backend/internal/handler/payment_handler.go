package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/jdns/billingsystem/internal/middleware"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
	"github.com/jdns/billingsystem/internal/service"
)

// PaymentHandler handles payment-related HTTP requests.
type PaymentHandler struct {
	paymentService *service.PaymentService
	paymentRepo    *repository.PaymentRepo
}

// NewPaymentHandler creates a new PaymentHandler.
func NewPaymentHandler(paymentService *service.PaymentService, paymentRepo *repository.PaymentRepo) *PaymentHandler {
	return &PaymentHandler{paymentService: paymentService, paymentRepo: paymentRepo}
}

// List returns payments with pagination and search support.
// Query params: ?page=1&limit=20&search=&status=
func (h *PaymentHandler) List(w http.ResponseWriter, r *http.Request) {
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

	payments, total, err := h.paymentRepo.ListPaginated(r.Context(), status, search, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list payments")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":  payments,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// ListMine returns payments belonging to the authenticated user.
func (h *PaymentHandler) ListMine(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	payments, err := h.paymentService.ListByUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get payments")
		return
	}
	writeJSON(w, http.StatusOK, payments)
}

// Create creates a new payment. Supports multipart/form-data for file uploads.
func (h *PaymentHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req model.CreatePaymentRequest
	req.UserID = userID

	contentType := r.Header.Get("Content-Type")
	isMultipart := len(contentType) >= 19 && contentType[:19] == "multipart/form-data"

	if isMultipart {
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			writeError(w, http.StatusBadRequest, "failed to parse form")
			return
		}

		subIDStr := r.FormValue("subscription_id")
		subID, err := parseUUID(subIDStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid subscription_id")
			return
		}
		req.SubscriptionID = subID

		methodStr := r.FormValue("method")
		if methodStr == "" {
			writeError(w, http.StatusBadRequest, "method is required")
			return
		}
		req.Method = model.PaymentMethod(methodStr)

		if ref := r.FormValue("reference_number"); ref != "" {
			req.ReferenceNumber = &ref
		}

		// TODO: handle actual file upload to R2; for now store nil
		req.ProofImageURL = nil
	} else {
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		req.UserID = userID
	}

	if req.Method == "" {
		writeError(w, http.StatusBadRequest, "method is required")
		return
	}

	payment, err := h.paymentService.Create(r.Context(), &req)
	if err != nil {
		if errors.Is(err, service.ErrSubscriptionNotFound) {
			writeError(w, http.StatusNotFound, "subscription not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create payment")
		return
	}
	writeJSON(w, http.StatusCreated, payment)
}

// Approve approves a pending payment.
func (h *PaymentHandler) Approve(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid payment id")
		return
	}

	callerID := middleware.GetUserID(r.Context())
	var req model.ApproveRejectRequest
	req.ApprovedBy = callerID

	// Parse optional notes
	var body struct {
		Notes *string `json:"notes"`
	}
	_ = decodeJSON(r, &body)
	req.Notes = body.Notes

	payment, err := h.paymentService.Approve(r.Context(), id, &req)
	if err != nil {
		if errors.Is(err, service.ErrPaymentNotPending) {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to approve payment")
		return
	}
	writeJSON(w, http.StatusOK, payment)
}

// Reject rejects a pending payment.
func (h *PaymentHandler) Reject(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid payment id")
		return
	}

	callerID := middleware.GetUserID(r.Context())
	var req model.ApproveRejectRequest
	req.ApprovedBy = callerID

	var body struct {
		Notes *string `json:"notes"`
	}
	_ = decodeJSON(r, &body)
	req.Notes = body.Notes

	payment, err := h.paymentService.Reject(r.Context(), id, &req)
	if err != nil {
		if errors.Is(err, service.ErrPaymentNotPending) {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to reject payment")
		return
	}
	writeJSON(w, http.StatusOK, payment)
}
