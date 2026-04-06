package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/middleware"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
	"github.com/jdns/billingsystem/internal/service"
	"github.com/jdns/billingsystem/internal/sms"
)

// MessageHandler handles messaging and notification HTTP requests.
type MessageHandler struct {
	messageRepo  *repository.MessageRepo
	userRepo     *repository.UserRepo
	subService   *service.SubscriptionService
	settingsRepo *repository.SettingsRepo
}

// NewMessageHandler creates a new MessageHandler.
func NewMessageHandler(
	messageRepo *repository.MessageRepo,
	userRepo *repository.UserRepo,
	subService *service.SubscriptionService,
	settingsRepo *repository.SettingsRepo,
) *MessageHandler {
	return &MessageHandler{
		messageRepo:  messageRepo,
		userRepo:     userRepo,
		subService:   subService,
		settingsRepo: settingsRepo,
	}
}

// getSMSProvider creates a fresh SMS provider from current DB settings.
func (h *MessageHandler) getSMSProvider(r *http.Request) sms.Provider {
	ctx := r.Context()
	provider, _ := h.settingsRepo.Get(ctx, "sms_provider")
	apiKey, _ := h.settingsRepo.Get(ctx, "sms_api_key")
	baseURL, _ := h.settingsRepo.Get(ctx, "sms_base_url")
	return sms.NewProviderFromSettings(provider, apiKey, baseURL)
}

// replaceVariables replaces {{key}} placeholders in a template string with provided values.
func replaceVariables(template string, vars map[string]string) string {
	result := template
	for key, value := range vars {
		result = strings.ReplaceAll(result, "{{"+key+"}}", value)
	}
	return result
}

// buildTemplateVars builds template variable mappings from a subscription's joined fields.
func buildTemplateVars(sub *model.Subscription) map[string]string {
	return map[string]string{
		"name":     sub.UserName,
		"amount":   fmt.Sprintf("%.2f", sub.PlanPrice),
		"due_date": sub.NextDueDate.Format("January 2, 2006"),
		"plan":     sub.PlanName,
		"speed":    fmt.Sprintf("%d", sub.PlanSpeed),
	}
}

// SendToOne sends a single SMS message to one recipient.
// POST /api/messages/send
func (h *MessageHandler) SendToOne(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RecipientID *uuid.UUID `json:"recipient_id"`
		Phone       string     `json:"phone"`
		Message     string     `json:"message"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Message == "" {
		writeError(w, http.StatusBadRequest, "message is required")
		return
	}

	ctx := r.Context()
	senderID := middleware.GetUserID(ctx)

	phone := req.Phone
	recipientName := ""
	var recipientID *uuid.UUID

	// Look up user if recipient_id is provided
	if req.RecipientID != nil {
		user, err := h.userRepo.GetByID(ctx, *req.RecipientID)
		if err != nil {
			writeError(w, http.StatusNotFound, "recipient not found")
			return
		}
		phone = user.Phone
		recipientName = user.FullName
		recipientID = &user.ID
	}

	if phone == "" {
		writeError(w, http.StatusBadRequest, "phone number is required")
		return
	}

	// Send SMS
	smsProvider := h.getSMSProvider(r)
	now := time.Now()
	status := "sent"
	var errorMsg *string

	if err := smsProvider.SendReminder(phone, req.Message); err != nil {
		status = "failed"
		errStr := err.Error()
		errorMsg = &errStr
		log.Printf("[Message] Failed to send to %s: %v", phone, err)
	}

	var sentAt *time.Time
	if status == "sent" {
		sentAt = &now
	}

	msg := &repository.Message{
		SenderID:       &senderID,
		RecipientID:    recipientID,
		RecipientPhone: phone,
		RecipientName:  recipientName,
		Type:           "custom",
		Subject:        "Custom Message",
		Body:           req.Message,
		Status:         status,
		ErrorMessage:   errorMsg,
		SentAt:         sentAt,
	}

	saved, err := h.messageRepo.Create(ctx, msg)
	if err != nil {
		log.Printf("[Message] Failed to save message record: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to save message")
		return
	}

	writeJSON(w, http.StatusOK, saved)
}

// SendBulk sends a custom message to subscribers matching a filter.
// POST /api/messages/bulk
func (h *MessageHandler) SendBulk(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Filter  string `json:"filter"`
		Message string `json:"message"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Message == "" {
		writeError(w, http.StatusBadRequest, "message is required")
		return
	}

	ctx := r.Context()
	senderID := middleware.GetUserID(ctx)

	subs, err := h.getSubscriptionsByFilter(ctx, req.Filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch subscribers")
		return
	}

	batchID := uuid.New()
	smsProvider := h.getSMSProvider(r)
	sent, failed := 0, 0

	var messages []*repository.Message
	for _, sub := range subs {
		now := time.Now()
		status := "sent"
		var errorMsg *string
		var sentAt *time.Time

		if err := smsProvider.SendReminder(sub.UserPhone, req.Message); err != nil {
			status = "failed"
			errStr := err.Error()
			errorMsg = &errStr
			failed++
		} else {
			sentAt = &now
			sent++
		}

		userID := sub.UserID
		msg := &repository.Message{
			SenderID:       &senderID,
			RecipientID:    &userID,
			RecipientPhone: sub.UserPhone,
			RecipientName:  sub.UserName,
			Type:           "custom",
			Subject:        "Bulk Message",
			Body:           req.Message,
			Status:         status,
			ErrorMessage:   errorMsg,
			BatchID:        &batchID,
			SentAt:         sentAt,
		}
		messages = append(messages, msg)
	}

	if len(messages) > 0 {
		if err := h.messageRepo.CreateBatch(ctx, messages); err != nil {
			log.Printf("[Message] Failed to save batch messages: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to save messages")
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"batch_id": batchID,
		"total":    len(subs),
		"sent":     sent,
		"failed":   failed,
	})
}

// SendTemplate sends a template-based message to subscribers matching a filter.
// POST /api/messages/template
func (h *MessageHandler) SendTemplate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Template string `json:"template"`
		Filter   string `json:"filter"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Template == "" {
		writeError(w, http.StatusBadRequest, "template name is required")
		return
	}

	ctx := r.Context()
	senderID := middleware.GetUserID(ctx)

	tmpl, err := h.messageRepo.GetTemplate(ctx, req.Template)
	if err != nil {
		writeError(w, http.StatusNotFound, "template not found")
		return
	}

	subs, err := h.getSubscriptionsByFilter(ctx, req.Filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch subscribers")
		return
	}

	batchID := uuid.New()
	smsProvider := h.getSMSProvider(r)
	sent, failed := 0, 0

	var messages []*repository.Message
	for _, sub := range subs {
		vars := buildTemplateVars(sub)
		body := replaceVariables(tmpl.Body, vars)

		now := time.Now()
		status := "sent"
		var errorMsg *string
		var sentAt *time.Time

		if err := smsProvider.SendReminder(sub.UserPhone, body); err != nil {
			status = "failed"
			errStr := err.Error()
			errorMsg = &errStr
			failed++
		} else {
			sentAt = &now
			sent++
		}

		userID := sub.UserID
		msg := &repository.Message{
			SenderID:       &senderID,
			RecipientID:    &userID,
			RecipientPhone: sub.UserPhone,
			RecipientName:  sub.UserName,
			Type:           tmpl.Type,
			Subject:        tmpl.Subject,
			Body:           body,
			Status:         status,
			ErrorMessage:   errorMsg,
			BatchID:        &batchID,
			SentAt:         sentAt,
		}
		messages = append(messages, msg)
	}

	if len(messages) > 0 {
		if err := h.messageRepo.CreateBatch(ctx, messages); err != nil {
			log.Printf("[Message] Failed to save template batch messages: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to save messages")
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"batch_id": batchID,
		"total":    len(subs),
		"sent":     sent,
		"failed":   failed,
	})
}

// SendReminders sends payment reminder messages to subscribers due within N days.
// POST /api/messages/reminders
func (h *MessageHandler) SendReminders(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DaysBefore int `json:"days_before"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.DaysBefore <= 0 {
		req.DaysBefore = 2
	}

	ctx := r.Context()
	senderID := middleware.GetUserID(ctx)

	tmpl, err := h.messageRepo.GetTemplate(ctx, "payment_reminder")
	if err != nil {
		log.Printf("[Message] payment_reminder template not found: %v", err)
		writeError(w, http.StatusInternalServerError, "reminder template not found")
		return
	}

	subs, err := h.subService.GetDueSoon(ctx, req.DaysBefore)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get due-soon subscriptions")
		return
	}

	batchID := uuid.New()
	smsProvider := h.getSMSProvider(r)
	sent, failed := 0, 0

	var messages []*repository.Message
	for _, sub := range subs {
		vars := buildTemplateVars(sub)
		body := replaceVariables(tmpl.Body, vars)

		now := time.Now()
		status := "sent"
		var errorMsg *string
		var sentAt *time.Time

		if err := smsProvider.SendReminder(sub.UserPhone, body); err != nil {
			status = "failed"
			errStr := err.Error()
			errorMsg = &errStr
			failed++
		} else {
			sentAt = &now
			sent++
		}

		userID := sub.UserID
		msg := &repository.Message{
			SenderID:       &senderID,
			RecipientID:    &userID,
			RecipientPhone: sub.UserPhone,
			RecipientName:  sub.UserName,
			Type:           "reminder",
			Subject:        tmpl.Subject,
			Body:           body,
			Status:         status,
			ErrorMessage:   errorMsg,
			BatchID:        &batchID,
			SentAt:         sentAt,
		}
		messages = append(messages, msg)
	}

	if len(messages) > 0 {
		if err := h.messageRepo.CreateBatch(ctx, messages); err != nil {
			log.Printf("[Message] Failed to save reminder messages: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to save messages")
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"batch_id": batchID,
		"total":    len(subs),
		"sent":     sent,
		"failed":   failed,
	})
}

// GetHistory returns paginated message history.
// GET /api/messages?page=1&limit=20
func (h *MessageHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	messages, total, err := h.messageRepo.List(r.Context(), limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get messages")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"messages": messages,
		"total":    total,
		"page":     page,
		"limit":    limit,
	})
}

// GetTemplates returns all message templates.
// GET /api/messages/templates
func (h *MessageHandler) GetTemplates(w http.ResponseWriter, r *http.Request) {
	templates, err := h.messageRepo.GetTemplates(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get templates")
		return
	}

	writeJSON(w, http.StatusOK, templates)
}

// UpdateTemplate updates a message template's subject and body.
// PUT /api/messages/templates/{id}
func (h *MessageHandler) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid template id")
		return
	}

	var req struct {
		Subject string `json:"subject"`
		Body    string `json:"body"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Body == "" {
		writeError(w, http.StatusBadRequest, "body is required")
		return
	}

	if err := h.messageRepo.UpdateTemplate(r.Context(), id, req.Subject, req.Body); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update template")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "template updated"})
}

// getSubscriptionsByFilter returns subscriptions matching the given filter string.
func (h *MessageHandler) getSubscriptionsByFilter(ctx context.Context, filter string) ([]*model.Subscription, error) {
	switch filter {
	case "active":
		return h.subService.GetDueSoon(ctx, 365) // active subs
	case "overdue":
		return h.subService.GetOverdue(ctx)
	case "suspended":
		// For suspended, list all and filter
		all, err := h.subService.List(ctx)
		if err != nil {
			return nil, err
		}
		var result []*model.Subscription
		for _, s := range all {
			if s.Status == model.SubStatusSuspended {
				result = append(result, s)
			}
		}
		return result, nil
	default: // "all"
		return h.subService.List(ctx)
	}
}
