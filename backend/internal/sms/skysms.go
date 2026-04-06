package sms

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// SkySMSProvider sends real SMS messages via the SkySMS API (skysms.skyio.site).
type SkySMSProvider struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

// NewSkySMSProvider creates a new SkySMS provider.
// apiKey is your SkySMS API key.
// baseURL is optional — defaults to "https://skysms.skyio.site/api" if empty.
func NewSkySMSProvider(apiKey, baseURL string) *SkySMSProvider {
	if baseURL == "" {
		baseURL = "https://skysms.skyio.site/api"
	}
	return &SkySMSProvider{
		apiKey:  apiKey,
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type skySMSRequest struct {
	APIKey  string `json:"api_key"`
	To      string `json:"to"`
	Message string `json:"message"`
}

type skySMSResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error"`
}

func (s *SkySMSProvider) send(phone, message string) error {
	payload := skySMSRequest{
		APIKey:  s.apiKey,
		To:      phone,
		Message: message,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.baseURL+"/send", bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("send sms request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("skysms api error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var result skySMSResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		// Some APIs return plain text on success — treat 2xx as success regardless
		log.Printf("[SkySMS] Sent to %s (response: %s)", phone, string(respBody))
		return nil
	}

	if !result.Success && result.Error != "" {
		return fmt.Errorf("skysms error: %s", result.Error)
	}

	log.Printf("[SkySMS] Sent to %s: %s", phone, result.Message)
	return nil
}

func (s *SkySMSProvider) SendOTP(phone string, code string) error {
	message := fmt.Sprintf("Your OMJI verification code is: %s. Valid for 10 minutes. Do not share this code.", code)
	log.Printf("[SkySMS] Sending OTP to %s", phone)
	return s.send(phone, message)
}

func (s *SkySMSProvider) SendReminder(phone string, message string) error {
	log.Printf("[SkySMS] Sending reminder to %s", phone)
	return s.send(phone, message)
}
