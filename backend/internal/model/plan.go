package model

import (
	"time"

	"github.com/google/uuid"
)

type Plan struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	SpeedMbps   int       `json:"speed_mbps"`
	Price       float64   `json:"price"`
	Description *string   `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

type CreatePlanRequest struct {
	Name        string  `json:"name"`
	SpeedMbps   int     `json:"speed_mbps"`
	Price       float64 `json:"price"`
	Description *string `json:"description"`
	IsActive    bool    `json:"is_active"`
}

type UpdatePlanRequest struct {
	Name        *string  `json:"name"`
	SpeedMbps   *int     `json:"speed_mbps"`
	Price       *float64 `json:"price"`
	Description *string  `json:"description"`
	IsActive    *bool    `json:"is_active"`
}
