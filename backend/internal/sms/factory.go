package sms

import "log"

// NewProviderFromSettings returns the appropriate SMS provider based on the provider name string.
// Falls back to MockProvider if the provider is unknown or apiKey is empty.
func NewProviderFromSettings(provider, apiKey, baseURL string) Provider {
	switch provider {
	case "skysms":
		if apiKey == "" {
			log.Println("[SMS] Provider is skysms but API key is empty — using mock")
			return NewMockProvider()
		}
		return NewSkySMSProvider(apiKey, baseURL)
	default:
		return NewMockProvider()
	}
}
