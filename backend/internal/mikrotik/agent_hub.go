package mikrotik

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// AgentCommand is sent from backend to agent.
type AgentCommand struct {
	ID     string            `json:"id"`
	Op     string            `json:"op"`
	Params map[string]string `json:"params"`
}

// AgentResponse is received from agent.
type AgentResponse struct {
	ID    string              `json:"id"`
	OK    bool                `json:"ok"`
	Error string              `json:"error"`
	Data  []map[string]string `json:"data,omitempty"`
}

// AgentHub manages a single connected local agent over WebSocket.
// It implements MikroTikExecutor by proxying all operations to the agent.
type AgentHub struct {
	secret   string
	mu       sync.Mutex
	conn     *websocket.Conn
	pending  map[string]chan AgentResponse
	upgrader websocket.Upgrader
}

// NewAgentHub creates a new AgentHub with the given shared secret.
func NewAgentHub(secret string) *AgentHub {
	return &AgentHub{
		secret:  secret,
		pending: make(map[string]chan AgentResponse),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

// IsConnected returns true if a local agent is currently connected.
func (h *AgentHub) IsConnected() bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.conn != nil
}

// ServeHTTP upgrades the connection to WebSocket and registers the agent.
// The agent must send the secret as the first message: {"secret":"..."}.
func (h *AgentHub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[AgentHub] WebSocket upgrade error: %v", err)
		return
	}

	// Expect auth message
	var auth struct {
		Secret string `json:"secret"`
	}
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	if err := conn.ReadJSON(&auth); err != nil || auth.Secret != h.secret {
		conn.WriteMessage(websocket.CloseMessage, []byte("unauthorized"))
		conn.Close()
		log.Printf("[AgentHub] Agent rejected: invalid secret")
		return
	}
	conn.SetReadDeadline(time.Time{})

	h.mu.Lock()
	if h.conn != nil {
		h.conn.Close()
	}
	h.conn = conn
	h.mu.Unlock()

	log.Printf("[AgentHub] Local agent connected from %s", r.RemoteAddr)

	for {
		var resp AgentResponse
		if err := conn.ReadJSON(&resp); err != nil {
			log.Printf("[AgentHub] Agent disconnected: %v", err)
			break
		}
		h.mu.Lock()
		ch, ok := h.pending[resp.ID]
		if ok {
			delete(h.pending, resp.ID)
		}
		h.mu.Unlock()
		if ok {
			ch <- resp
		}
	}

	h.mu.Lock()
	if h.conn == conn {
		h.conn = nil
	}
	h.mu.Unlock()
}

// execute sends a command to the agent and waits for a response (10s timeout).
func (h *AgentHub) execute(op string, params map[string]string) ([]map[string]string, error) {
	h.mu.Lock()
	conn := h.conn
	if conn == nil {
		h.mu.Unlock()
		return nil, fmt.Errorf("no local agent connected")
	}
	cmdID := uuid.New().String()
	ch := make(chan AgentResponse, 1)
	h.pending[cmdID] = ch
	h.mu.Unlock()

	cmd := AgentCommand{ID: cmdID, Op: op, Params: params}
	if err := conn.WriteJSON(cmd); err != nil {
		h.mu.Lock()
		delete(h.pending, cmdID)
		h.mu.Unlock()
		return nil, fmt.Errorf("send command to agent: %w", err)
	}

	select {
	case resp := <-ch:
		if !resp.OK {
			return nil, fmt.Errorf("agent error: %s", resp.Error)
		}
		return resp.Data, nil
	case <-time.After(10 * time.Second):
		h.mu.Lock()
		delete(h.pending, cmdID)
		h.mu.Unlock()
		return nil, fmt.Errorf("agent command timed out: %s", op)
	}
}

func (h *AgentHub) AddPPPoESecret(username, password, profile string) error {
	_, err := h.execute("pppoe_add", map[string]string{
		"username": username, "password": password, "profile": profile,
	})
	return err
}

func (h *AgentHub) DisablePPPoEUser(username string) error {
	_, err := h.execute("pppoe_disable", map[string]string{"username": username})
	return err
}

func (h *AgentHub) EnablePPPoEUser(username string) error {
	_, err := h.execute("pppoe_enable", map[string]string{"username": username})
	return err
}

func (h *AgentHub) SetPPPoEProfile(username, profile string) error {
	_, err := h.execute("pppoe_set_profile", map[string]string{
		"username": username, "profile": profile,
	})
	return err
}

func (h *AgentHub) KickPPPoESession(username string) error {
	_, err := h.execute("pppoe_kick", map[string]string{"username": username})
	return err
}

func (h *AgentHub) DeletePPPoESecret(username string) error {
	_, err := h.execute("pppoe_delete", map[string]string{"username": username})
	return err
}

func (h *AgentHub) GetPPPoESecrets() ([]PPPoESecret, error) {
	data, err := h.execute("pppoe_list", nil)
	if err != nil {
		return nil, err
	}
	secrets := make([]PPPoESecret, 0, len(data))
	for _, m := range data {
		secrets = append(secrets, PPPoESecret{
			Name:     m["name"],
			Password: m["password"],
			Profile:  m["profile"],
			Disabled: m["disabled"] == "true",
			Comment:  m["comment"],
		})
	}
	return secrets, nil
}

func (h *AgentHub) CreateQueue(name, targetIP, maxUpload, maxDownload string) (string, error) {
	data, err := h.execute("queue_create", map[string]string{
		"name": name, "target": targetIP, "upload": maxUpload, "download": maxDownload,
	})
	if err != nil {
		return "", err
	}
	if len(data) > 0 {
		return data[0]["id"], nil
	}
	return "", nil
}

func (h *AgentHub) DisableQueue(queueID string) error {
	_, err := h.execute("queue_disable", map[string]string{"id": queueID})
	return err
}

func (h *AgentHub) EnableQueue(queueID string) error {
	_, err := h.execute("queue_enable", map[string]string{"id": queueID})
	return err
}

func (h *AgentHub) UpdateQueueSpeed(queueID, maxUpload, maxDownload string) error {
	_, err := h.execute("queue_update", map[string]string{
		"id": queueID, "upload": maxUpload, "download": maxDownload,
	})
	return err
}

func (h *AgentHub) DeleteQueue(queueID string) error {
	_, err := h.execute("queue_delete", map[string]string{"id": queueID})
	return err
}

// Compile-time interface check.
var _ MikroTikExecutor = (*AgentHub)(nil)

// DecodeAgentCommand decodes a raw JSON message into AgentCommand.
// Used by the agent binary to parse commands.
func DecodeAgentCommand(data []byte) (*AgentCommand, error) {
	var cmd AgentCommand
	if err := json.Unmarshal(data, &cmd); err != nil {
		return nil, err
	}
	return &cmd, nil
}
