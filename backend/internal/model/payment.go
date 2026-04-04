package model

import (
	"time"

	"github.com/google/uuid"
)

type PaymentMethod string
type PaymentStatus string

const (
	MethodGCash PaymentMethod = "gcash"
	MethodMaya  PaymentMethod = "maya"
	MethodBank  PaymentMethod = "bank"
	MethodCash  PaymentMethod = "cash"

	PaymentPending  PaymentStatus = "pending"
	PaymentApproved PaymentStatus = "approved"
	PaymentRejected PaymentStatus = "rejected"
)

type Payment struct {
	ID                 uuid.UUID     `json:"id"`
	UserID             uuid.UUID     `json:"user_id"`
	SubscriptionID     uuid.UUID     `json:"subscription_id"`
	Amount             float64       `json:"amount"`
	Method             PaymentMethod `json:"method"`
	ReferenceNumber    *string       `json:"reference_number"`
	ProofImageURL      *string       `json:"proof_image_url"`
	Status             PaymentStatus `json:"status"`
	ApprovedBy         *uuid.UUID    `json:"approved_by"`
	BillingPeriodStart time.Time     `json:"billing_period_start"`
	BillingPeriodEnd   time.Time     `json:"billing_period_end"`
	Notes              *string       `json:"notes"`
	CreatedAt          time.Time     `json:"created_at"`
	UpdatedAt          time.Time     `json:"updated_at"`

	// Joined fields
	UserName    string  `json:"user_name,omitempty"`
	UserPhone   string  `json:"user_phone,omitempty"`
	ApproverName *string `json:"approver_name,omitempty"`
}

type CreatePaymentRequest struct {
	UserID             uuid.UUID     `json:"user_id"`
	SubscriptionID     uuid.UUID     `json:"subscription_id"`
	Amount             float64       `json:"amount"`
	Method             PaymentMethod `json:"method"`
	ReferenceNumber    *string       `json:"reference_number"`
	ProofImageURL      *string       `json:"proof_image_url"`
	BillingPeriodStart time.Time     `json:"billing_period_start"`
	BillingPeriodEnd   time.Time     `json:"billing_period_end"`
}

type ApproveRejectRequest struct {
	ApprovedBy uuid.UUID `json:"approved_by"`
	Notes      *string   `json:"notes"`
}
