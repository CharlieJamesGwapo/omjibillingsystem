package model

import (
	"time"

	"github.com/google/uuid"
)

type SubscriptionStatus string

const (
	SubStatusActive    SubscriptionStatus = "active"
	SubStatusOverdue   SubscriptionStatus = "overdue"
	SubStatusSuspended SubscriptionStatus = "suspended"
)

type Subscription struct {
	ID              uuid.UUID          `json:"id"`
	UserID          uuid.UUID          `json:"user_id"`
	PlanID          uuid.UUID          `json:"plan_id"`
	IPAddress       *string            `json:"ip_address"`
	MACAddress      *string            `json:"mac_address"`
	BillingDay      int                `json:"billing_day"`
	NextDueDate     time.Time          `json:"next_due_date"`
	GraceDays       int                `json:"grace_days"`
	Status          SubscriptionStatus `json:"status"`
	MikroTikQueueID *string            `json:"mikrotik_queue_id"`
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`

	// Joined fields
	UserName   string  `json:"user_name,omitempty"`
	UserPhone  string  `json:"user_phone,omitempty"`
	PlanName   string  `json:"plan_name,omitempty"`
	PlanSpeed  int     `json:"plan_speed,omitempty"`
	PlanPrice  float64 `json:"plan_price,omitempty"`
}

type CreateSubscriptionRequest struct {
	UserID      uuid.UUID `json:"user_id"`
	PlanID      uuid.UUID `json:"plan_id"`
	IPAddress   *string   `json:"ip_address"`
	MACAddress  *string   `json:"mac_address"`
	BillingDay  int       `json:"billing_day"`
	GraceDays   *int      `json:"grace_days"`
}

type UpdateSubscriptionRequest struct {
	PlanID      *uuid.UUID          `json:"plan_id"`
	IPAddress   *string             `json:"ip_address"`
	MACAddress  *string             `json:"mac_address"`
	BillingDay  *int                `json:"billing_day"`
	GraceDays   *int                `json:"grace_days"`
	Status      *SubscriptionStatus `json:"status"`
}
