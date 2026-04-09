package model

import (
	"time"

	"github.com/google/uuid"
)

type Plan struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	SpeedMbps       int       `json:"speed_mbps"`
	Price           float64   `json:"price"`
	Description     *string   `json:"description"`
	IsActive        bool      `json:"is_active"`
	MikroTikProfile *string   `json:"mikrotik_profile"`
	CreatedAt       time.Time `json:"created_at"`
}

type CreatePlanRequest struct {
	Name            string  `json:"name"`
	SpeedMbps       int     `json:"speed_mbps"`
	Price           float64 `json:"price"`
	Description     *string `json:"description"`
	IsActive        bool    `json:"is_active"`
	MikroTikProfile *string `json:"mikrotik_profile"`
}

type UpdatePlanRequest struct {
	Name            *string  `json:"name"`
	SpeedMbps       *int     `json:"speed_mbps"`
	Price           *float64 `json:"price"`
	Description     *string  `json:"description"`
	IsActive        *bool    `json:"is_active"`
	MikroTikProfile *string  `json:"mikrotik_profile"`
}
