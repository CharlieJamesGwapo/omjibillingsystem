package mikrotik

// PPPoESecret represents a PPPoE secret entry from MikroTik.
type PPPoESecret struct {
	Name     string `json:"name"`
	Password string `json:"password"`
	Profile  string `json:"profile"`
	Disabled bool   `json:"disabled"`
	Comment  string `json:"comment"`
}

// MikroTikExecutor is the interface for all MikroTik operations.
// Implemented by *Client (direct) and *AgentHub (via local agent).
type MikroTikExecutor interface {
	IsConnected() bool

	// PPPoE secrets management
	AddPPPoESecret(username, password, profile string) error
	DisablePPPoEUser(username string) error
	EnablePPPoEUser(username string) error
	SetPPPoEProfile(username, profile string) error
	KickPPPoESession(username string) error
	DeletePPPoESecret(username string) error
	GetPPPoESecrets() ([]PPPoESecret, error)

	// Simple queue management (existing)
	CreateQueue(name, targetIP, maxUpload, maxDownload string) (string, error)
	DisableQueue(queueID string) error
	EnableQueue(queueID string) error
	UpdateQueueSpeed(queueID, maxUpload, maxDownload string) error
	DeleteQueue(queueID string) error
}

// Compile-time check: *Client must implement MikroTikExecutor.
var _ MikroTikExecutor = (*Client)(nil)
