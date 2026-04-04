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
