package model

import (
	"time"

	"github.com/google/uuid"
)

type OTP struct {
	ID        uuid.UUID `json:"id"`
	Phone     string    `json:"phone"`
	Code      string    `json:"-"`
	ExpiresAt time.Time `json:"expires_at"`
	Verified  bool      `json:"verified"`
	CreatedAt time.Time `json:"created_at"`
}

type OTPRequest struct {
	Phone string `json:"phone"`
}

type OTPVerifyRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}
