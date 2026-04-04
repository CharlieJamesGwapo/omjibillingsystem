package model

import (
	"time"

	"github.com/google/uuid"
)

type ActivityLog struct {
	ID         uuid.UUID              `json:"id"`
	UserID     uuid.UUID              `json:"user_id"`
	Action     string                 `json:"action"`
	TargetType string                 `json:"target_type"`
	TargetID   uuid.UUID              `json:"target_id"`
	Details    map[string]interface{} `json:"details"`
	IPAddress  string                 `json:"ip_address"`
	CreatedAt  time.Time              `json:"created_at"`

	// Joined field
	UserName string `json:"user_name,omitempty"`
}
