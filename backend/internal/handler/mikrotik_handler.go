package handler

import (
	"net/http"
	"strconv"

	"github.com/jdns/billingsystem/internal/mikrotik"
	"github.com/jdns/billingsystem/internal/repository"
)

// MikroTikHandler handles MikroTik status and connection HTTP requests.
type MikroTikHandler struct {
	manager      *mikrotik.Manager
	settingsRepo *repository.SettingsRepo
}

// NewMikroTikHandler creates a new MikroTikHandler.
func NewMikroTikHandler(manager *mikrotik.Manager, settingsRepo *repository.SettingsRepo) *MikroTikHandler {
	return &MikroTikHandler{manager: manager, settingsRepo: settingsRepo}
}

// GetStatus returns whether the MikroTik device is reachable.
func (h *MikroTikHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	connected := h.manager.IsConnected()

	result := map[string]interface{}{
		"connected": connected,
	}

	// Try to get router info if connected
	if connected {
		client := h.manager.Get()
		if client != nil {
			if info, err := client.GetActiveConnections(); err == nil {
				result["queue_count"] = len(info)
			}
		}
	}

	writeJSON(w, http.StatusOK, result)
}

// GetActiveConnections returns all active MikroTik queue entries.
func (h *MikroTikHandler) GetActiveConnections(w http.ResponseWriter, r *http.Request) {
	client := h.manager.Get()
	if client == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}

	connections, err := client.GetActiveConnections()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get active connections")
		return
	}
	writeJSON(w, http.StatusOK, connections)
}

// TestConnection tests a MikroTik connection with the provided credentials without saving.
func (h *MikroTikHandler) TestConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Host     string `json:"host"`
		Port     int    `json:"port"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Host == "" {
		writeError(w, http.StatusBadRequest, "host is required")
		return
	}
	if req.Port == 0 {
		req.Port = 8728
	}

	err := h.manager.TestConnection(req.Host, req.Port, req.Username, req.Password)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"connected": false,
			"message":   err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"connected": true,
		"message":   "Successfully connected to MikroTik at " + req.Host,
	})
}

// SaveAndConnect saves MikroTik settings to DB and reconfigures the live client.
func (h *MikroTikHandler) SaveAndConnect(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Host     string `json:"host"`
		Port     int    `json:"port"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Port == 0 {
		req.Port = 8728
	}

	ctx := r.Context()

	// Save to DB
	settings := map[string]string{
		"mikrotik_host":     req.Host,
		"mikrotik_port":     strconv.Itoa(req.Port),
		"mikrotik_user":     req.Username,
		"mikrotik_password": req.Password,
	}
	if err := h.settingsRepo.SetMultiple(ctx, settings); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save settings")
		return
	}

	// Reconfigure the live client
	h.manager.Configure(req.Host, req.Port, req.Username, req.Password)

	// Check if connected
	connected := h.manager.IsConnected()

	status := "disconnected"
	if connected {
		status = "connected"
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":   true,
		"connected": connected,
		"message":   "MikroTik settings saved. Status: " + status,
	})
}
