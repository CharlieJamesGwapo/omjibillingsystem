package mikrotik

import (
	"fmt"
	"sync"
)

// Manager provides a dynamic MikroTik client that can be reconfigured at runtime
// from admin settings without restarting the server.
type Manager struct {
	mu     sync.RWMutex
	client *Client
}

// NewManager creates a new MikroTik manager with an optional initial client.
func NewManager(initial *Client) *Manager {
	return &Manager{client: initial}
}

// Get returns the current MikroTik client, or nil if not configured.
func (m *Manager) Get() *Client {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.client
}

// Configure creates and sets a new MikroTik client from the given parameters.
// If host is empty, the client is set to nil (disabled).
func (m *Manager) Configure(host string, port int, username, password string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if host == "" {
		m.client = nil
		return
	}

	if port == 0 {
		port = 8728
	}
	addr := fmt.Sprintf("%s:%d", host, port)
	m.client = NewClient(addr, username, password)
}

// TestConnection attempts to connect with the given parameters WITHOUT changing
// the current client. Returns nil on success, error on failure.
func (m *Manager) TestConnection(host string, port int, username, password string) error {
	if host == "" {
		return fmt.Errorf("host is required")
	}
	if port == 0 {
		port = 8728
	}
	addr := fmt.Sprintf("%s:%d", host, port)
	testClient := NewClient(addr, username, password)
	if !testClient.IsConnected() {
		return fmt.Errorf("could not connect to MikroTik at %s", addr)
	}
	return nil
}

// IsConnected checks if the current client can reach the router.
func (m *Manager) IsConnected() bool {
	c := m.Get()
	if c == nil {
		return false
	}
	return c.IsConnected()
}
