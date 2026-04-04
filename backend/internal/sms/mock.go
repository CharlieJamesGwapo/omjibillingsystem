package sms

import "log"

// MockProvider is an SMS provider that logs messages to stdout instead of sending real SMS.
type MockProvider struct{}

func NewMockProvider() *MockProvider {
	return &MockProvider{}
}

func (m *MockProvider) SendOTP(phone string, code string) error {
	log.Printf("[SMS MOCK] SendOTP -> phone: %s, code: %s", phone, code)
	return nil
}

func (m *MockProvider) SendReminder(phone string, message string) error {
	log.Printf("[SMS MOCK] SendReminder -> phone: %s, message: %s", phone, message)
	return nil
}
