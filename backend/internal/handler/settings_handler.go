package handler

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/jdns/billingsystem/internal/repository"
	"github.com/jdns/billingsystem/internal/sms"
)

// SettingsHandler handles settings-related HTTP requests.
type SettingsHandler struct {
	settingsRepo *repository.SettingsRepo
	smsProvider  sms.Provider
}

// NewSettingsHandler creates a new SettingsHandler.
func NewSettingsHandler(settingsRepo *repository.SettingsRepo, smsProvider sms.Provider) *SettingsHandler {
	return &SettingsHandler{
		settingsRepo: settingsRepo,
		smsProvider:  smsProvider,
	}
}

// isSensitiveKey returns true if the setting key contains sensitive data.
func isSensitiveKey(key string) bool {
	return strings.Contains(key, "api_key") || strings.Contains(key, "password") || strings.Contains(key, "secret")
}

// maskValue masks sensitive values for display. Returns "••••••" if non-empty, empty string if empty.
func maskValue(value string) string {
	if value == "" {
		return ""
	}
	return "••••••"
}

// GetSettings returns all settings grouped by category. Sensitive values are masked.
func (h *SettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.settingsRepo.GetAll(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get settings")
		return
	}

	// Group by category and mask sensitive values
	grouped := make(map[string][]repository.Setting)
	for _, s := range settings {
		if isSensitiveKey(s.Key) {
			s.Value = maskValue(s.Value)
		}
		grouped[s.Category] = append(grouped[s.Category], s)
	}

	writeJSON(w, http.StatusOK, grouped)
}

// UpdateSettings updates multiple settings at once.
func (h *SettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Settings map[string]string `json:"settings"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.Settings) == 0 {
		writeError(w, http.StatusBadRequest, "no settings provided")
		return
	}

	// Filter out masked values — don't overwrite real secrets with placeholders
	filtered := make(map[string]string)
	for k, v := range req.Settings {
		if v == "••••••" {
			continue // Skip masked values
		}
		filtered[k] = v
	}
	if len(filtered) == 0 {
		writeError(w, http.StatusBadRequest, "no settings to update")
		return
	}

	if err := h.settingsRepo.SetMultiple(r.Context(), filtered); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update settings")
		return
	}

	// Return updated settings
	settings, err := h.settingsRepo.GetAll(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get updated settings")
		return
	}

	grouped := make(map[string][]repository.Setting)
	for _, s := range settings {
		if isSensitiveKey(s.Key) {
			s.Value = maskValue(s.Value)
		}
		grouped[s.Category] = append(grouped[s.Category], s)
	}

	writeJSON(w, http.StatusOK, grouped)
}

// TestSMS sends a test SMS message using the current SMS settings.
func (h *SettingsHandler) TestSMS(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Phone string `json:"phone"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Phone == "" {
		writeError(w, http.StatusBadRequest, "phone number is required")
		return
	}

	ctx := r.Context()

	// Read current SMS settings from DB to create a temporary provider
	provider, _ := h.settingsRepo.Get(ctx, "sms_provider")
	apiKey, _ := h.settingsRepo.Get(ctx, "sms_api_key")
	baseURL, _ := h.settingsRepo.Get(ctx, "sms_base_url")

	testProvider := sms.NewProviderFromSettings(provider, apiKey, baseURL)

	message := fmt.Sprintf("This is a test SMS from OMJI Billing System. If you received this, your SMS configuration is working correctly.")
	err := testProvider.SendReminder(req.Phone, message)
	if err != nil {
		log.Printf("[Settings] Test SMS failed: %v", err)
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"message": fmt.Sprintf("SMS test failed: %v", err),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Test SMS sent to %s successfully", req.Phone),
	})
}
