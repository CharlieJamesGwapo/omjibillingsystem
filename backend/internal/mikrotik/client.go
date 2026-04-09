package mikrotik

import (
	"fmt"

	routeros "github.com/go-routeros/routeros/v3"
)

// Client wraps the RouterOS API client with billing-specific operations.
type Client struct {
	address  string
	username string
	password string
}

// NewClient creates a new MikroTik client with the given connection parameters.
func NewClient(address, username, password string) *Client {
	return &Client{
		address:  address,
		username: username,
		password: password,
	}
}

// connect dials the RouterOS API and returns a connected client.
func (c *Client) connect() (*routeros.Client, error) {
	client, err := routeros.Dial(c.address, c.username, c.password)
	if err != nil {
		return nil, fmt.Errorf("dial routeros %s: %w", c.address, err)
	}
	return client, nil
}

// IsConnected checks whether the RouterOS device is reachable.
func (c *Client) IsConnected() bool {
	client, err := c.connect()
	if err != nil {
		return false
	}
	client.Close()
	return true
}

// CreateQueue adds a new simple queue entry and returns its RouterOS ID (e.g. "*1").
func (c *Client) CreateQueue(name, targetIP, maxUpload, maxDownload string) (string, error) {
	client, err := c.connect()
	if err != nil {
		return "", err
	}
	defer client.Close()

	reply, err := client.Run(
		"/queue/simple/add",
		"=name="+name,
		"=target="+targetIP+"/32",
		"=max-limit="+maxUpload+"/"+maxDownload,
	)
	if err != nil {
		return "", fmt.Errorf("create queue %q: %w", name, err)
	}

	if reply.Done != nil {
		if id, ok := reply.Done.Map["ret"]; ok {
			return id, nil
		}
	}
	return "", nil
}

// DisableQueue sets disabled=yes on the given queue ID.
func (c *Client) DisableQueue(queueID string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/queue/simple/set",
		"=.id="+queueID,
		"=disabled=yes",
	)
	if err != nil {
		return fmt.Errorf("disable queue %q: %w", queueID, err)
	}
	return nil
}

// EnableQueue sets disabled=no on the given queue ID.
func (c *Client) EnableQueue(queueID string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/queue/simple/set",
		"=.id="+queueID,
		"=disabled=no",
	)
	if err != nil {
		return fmt.Errorf("enable queue %q: %w", queueID, err)
	}
	return nil
}

// UpdateQueueSpeed updates the max-limit for an existing queue.
func (c *Client) UpdateQueueSpeed(queueID, maxUpload, maxDownload string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/queue/simple/set",
		"=.id="+queueID,
		"=max-limit="+maxUpload+"/"+maxDownload,
	)
	if err != nil {
		return fmt.Errorf("update queue speed %q: %w", queueID, err)
	}
	return nil
}

// DeleteQueue removes the queue with the given RouterOS ID.
func (c *Client) DeleteQueue(queueID string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/queue/simple/remove",
		"=.id="+queueID,
	)
	if err != nil {
		return fmt.Errorf("delete queue %q: %w", queueID, err)
	}
	return nil
}

// GetActiveConnections returns all simple queue entries as a list of key-value maps.
func (c *Client) GetActiveConnections() ([]map[string]string, error) {
	client, err := c.connect()
	if err != nil {
		return nil, err
	}
	defer client.Close()

	reply, err := client.Run("/queue/simple/print")
	if err != nil {
		return nil, fmt.Errorf("get active connections: %w", err)
	}

	results := make([]map[string]string, 0, len(reply.Re))
	for _, sentence := range reply.Re {
		results = append(results, sentence.Map)
	}
	return results, nil
}

// SpeedString converts an integer Mbps value into the RouterOS speed string format (e.g. 10 -> "10M").
func (c *Client) SpeedString(mbps int) string {
	return fmt.Sprintf("%dM", mbps)
}

// AddPPPoESecret creates a PPPoE secret in /ppp/secret.
func (c *Client) AddPPPoESecret(username, password, profile string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/ppp/secret/add",
		"=name="+username,
		"=password="+password,
		"=profile="+profile,
		"=service=pppoe",
	)
	if err != nil {
		return fmt.Errorf("add pppoe secret %q: %w", username, err)
	}
	return nil
}

// DisablePPPoEUser sets disabled=yes on the PPPoE secret and kicks the active session.
func (c *Client) DisablePPPoEUser(username string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/ppp/secret/set",
		"=numbers="+username,
		"=disabled=yes",
	)
	if err != nil {
		return fmt.Errorf("disable pppoe user %q: %w", username, err)
	}
	return c.kickSession(client, username)
}

// EnablePPPoEUser sets disabled=no on the PPPoE secret.
func (c *Client) EnablePPPoEUser(username string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/ppp/secret/set",
		"=numbers="+username,
		"=disabled=no",
	)
	if err != nil {
		return fmt.Errorf("enable pppoe user %q: %w", username, err)
	}
	return nil
}

// SetPPPoEProfile changes the profile for a PPPoE secret and kicks the active session.
func (c *Client) SetPPPoEProfile(username, profile string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/ppp/secret/set",
		"=numbers="+username,
		"=profile="+profile,
	)
	if err != nil {
		return fmt.Errorf("set pppoe profile %q -> %q: %w", username, profile, err)
	}
	return c.kickSession(client, username)
}

// KickPPPoESession removes the active PPPoE session for a user (forces re-dial).
func (c *Client) KickPPPoESession(username string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()
	return c.kickSession(client, username)
}

// kickSession removes active PPPoE session for username using an open routeros.Client.
func (c *Client) kickSession(conn *routeros.Client, username string) error {
	reply, err := conn.Run(
		"/ppp/active/print",
		"?name="+username,
		"=.proplist=.id",
	)
	if err != nil {
		return nil // no active session is not an error
	}
	for _, re := range reply.Re {
		id := re.Map[".id"]
		if id == "" {
			continue
		}
		_, _ = conn.Run("/ppp/active/remove", "=.id="+id)
	}
	return nil
}

// DeletePPPoESecret removes a PPPoE secret from MikroTik.
func (c *Client) DeletePPPoESecret(username string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	reply, err := client.Run("/ppp/secret/print", "?name="+username, "=.proplist=.id")
	if err != nil {
		return fmt.Errorf("find pppoe secret %q: %w", username, err)
	}
	for _, re := range reply.Re {
		id := re.Map[".id"]
		if id == "" {
			continue
		}
		if _, err := client.Run("/ppp/secret/remove", "=.id="+id); err != nil {
			return fmt.Errorf("delete pppoe secret %q: %w", username, err)
		}
	}
	return nil
}

// GetPPPoESecrets returns all PPPoE secrets.
func (c *Client) GetPPPoESecrets() ([]PPPoESecret, error) {
	client, err := c.connect()
	if err != nil {
		return nil, err
	}
	defer client.Close()

	reply, err := client.Run("/ppp/secret/print")
	if err != nil {
		return nil, fmt.Errorf("get pppoe secrets: %w", err)
	}

	secrets := make([]PPPoESecret, 0, len(reply.Re))
	for _, re := range reply.Re {
		secrets = append(secrets, PPPoESecret{
			Name:     re.Map["name"],
			Password: re.Map["password"],
			Profile:  re.Map["profile"],
			Disabled: re.Map["disabled"] == "true",
			Comment:  re.Map["comment"],
		})
	}
	return secrets, nil
}
