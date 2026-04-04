package handler

import (
	"net/http"

	"github.com/jdns/billingsystem/internal/mikrotik"
)

// MikroTikHandler handles MikroTik status and connection HTTP requests.
type MikroTikHandler struct {
	mtClient *mikrotik.Client
}

// NewMikroTikHandler creates a new MikroTikHandler.
func NewMikroTikHandler(mtClient *mikrotik.Client) *MikroTikHandler {
	return &MikroTikHandler{mtClient: mtClient}
}

// GetStatus returns whether the MikroTik device is reachable.
func (h *MikroTikHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	connected := false
	if h.mtClient != nil {
		connected = h.mtClient.IsConnected()
	}
	writeJSON(w, http.StatusOK, map[string]bool{"connected": connected})
}

// GetActiveConnections returns all active MikroTik queue entries.
func (h *MikroTikHandler) GetActiveConnections(w http.ResponseWriter, r *http.Request) {
	if h.mtClient == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}

	connections, err := h.mtClient.GetActiveConnections()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get active connections")
		return
	}
	writeJSON(w, http.StatusOK, connections)
}
