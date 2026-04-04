package sms

// Provider defines the interface for sending SMS messages.
type Provider interface {
	SendOTP(phone string, code string) error
	SendReminder(phone string, message string) error
}
