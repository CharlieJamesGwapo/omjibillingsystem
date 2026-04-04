package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
)

var (
	ErrPaymentNotPending    = errors.New("payment is not in pending status")
	ErrSubscriptionNotFound = errors.New("subscription not found")
)

// PaymentService handles business logic for payments.
type PaymentService struct {
	paymentRepo *repository.PaymentRepo
	subRepo     *repository.SubscriptionRepo
	subService  *SubscriptionService
}

// NewPaymentService creates a new PaymentService.
func NewPaymentService(
	paymentRepo *repository.PaymentRepo,
	subRepo *repository.SubscriptionRepo,
	subService *SubscriptionService,
) *PaymentService {
	return &PaymentService{
		paymentRepo: paymentRepo,
		subRepo:     subRepo,
		subService:  subService,
	}
}

// Create creates a new pending payment for the user's subscription.
// The billing period spans from today to next month same day.
func (s *PaymentService) Create(ctx context.Context, req *model.CreatePaymentRequest) (*model.Payment, error) {
	// Get the subscription to determine billing period
	sub, err := s.subRepo.GetByID(ctx, req.SubscriptionID)
	if err != nil {
		return nil, ErrSubscriptionNotFound
	}

	// Set billing period: from today until next due date
	now := time.Now()
	req.BillingPeriodStart = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	req.BillingPeriodEnd = sub.NextDueDate

	payment, err := s.paymentRepo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("create payment: %w", err)
	}
	return payment, nil
}

// Approve approves a pending payment, advances the subscription due date,
// and auto-reconnects the customer if they were suspended.
func (s *PaymentService) Approve(ctx context.Context, id uuid.UUID, req *model.ApproveRejectRequest) (*model.Payment, error) {
	payment, err := s.paymentRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get payment: %w", err)
	}

	if payment.Status != model.PaymentPending {
		return nil, ErrPaymentNotPending
	}

	payment, err = s.paymentRepo.Approve(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("approve payment: %w", err)
	}

	// Advance the subscription's due date by one month
	if err := s.subRepo.AdvanceDueDate(ctx, payment.SubscriptionID); err != nil {
		return nil, fmt.Errorf("advance due date: %w", err)
	}

	// Auto-reconnect if subscription was suspended
	sub, err := s.subRepo.GetByID(ctx, payment.SubscriptionID)
	if err == nil && sub.Status == model.SubStatusSuspended {
		_ = s.subService.Reconnect(ctx, sub.ID)
	}

	return payment, nil
}

// Reject rejects a pending payment with optional notes.
func (s *PaymentService) Reject(ctx context.Context, id uuid.UUID, req *model.ApproveRejectRequest) (*model.Payment, error) {
	payment, err := s.paymentRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get payment: %w", err)
	}

	if payment.Status != model.PaymentPending {
		return nil, ErrPaymentNotPending
	}

	payment, err = s.paymentRepo.Reject(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("reject payment: %w", err)
	}
	return payment, nil
}

// List returns payments, optionally filtered by status.
func (s *PaymentService) List(ctx context.Context, status *model.PaymentStatus) ([]*model.Payment, error) {
	if status != nil {
		payments, err := s.paymentRepo.ListByStatus(ctx, *status)
		if err != nil {
			return nil, fmt.Errorf("list payments by status: %w", err)
		}
		return payments, nil
	}

	// List all statuses by combining all
	var all []*model.Payment
	for _, st := range []model.PaymentStatus{model.PaymentPending, model.PaymentApproved, model.PaymentRejected} {
		payments, err := s.paymentRepo.ListByStatus(ctx, st)
		if err != nil {
			return nil, fmt.Errorf("list payments: %w", err)
		}
		all = append(all, payments...)
	}
	return all, nil
}

// ListByUser returns all payments for a given user.
func (s *PaymentService) ListByUser(ctx context.Context, userID uuid.UUID) ([]*model.Payment, error) {
	payments, err := s.paymentRepo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list payments by user: %w", err)
	}
	return payments, nil
}

// GetByID retrieves a single payment by its UUID.
func (s *PaymentService) GetByID(ctx context.Context, id uuid.UUID) (*model.Payment, error) {
	payment, err := s.paymentRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get payment: %w", err)
	}
	return payment, nil
}
