package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/mikrotik"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
)

// SubscriptionService handles business logic for customer subscriptions.
type SubscriptionService struct {
	subRepo  *repository.SubscriptionRepo
	planRepo *repository.PlanRepo
	mtClient *mikrotik.Client
}

// NewSubscriptionService creates a new SubscriptionService.
func NewSubscriptionService(
	subRepo *repository.SubscriptionRepo,
	planRepo *repository.PlanRepo,
	mtClient *mikrotik.Client,
) *SubscriptionService {
	return &SubscriptionService{
		subRepo:  subRepo,
		planRepo: planRepo,
		mtClient: mtClient,
	}
}

// Create creates a new subscription. BillingDay is capped at 28, nextDueDate is set to
// next month on that day, and grace period defaults to 2 days. If an IP is provided and
// the MikroTik client is available, a bandwidth queue is created.
func (s *SubscriptionService) Create(ctx context.Context, req *model.CreateSubscriptionRequest) (*model.Subscription, error) {
	// Cap billing day at 28
	if req.BillingDay > 28 {
		req.BillingDay = 28
	}
	if req.BillingDay < 1 {
		req.BillingDay = 1
	}

	// Default grace period
	if req.GraceDays == nil {
		defaultGrace := 2
		req.GraceDays = &defaultGrace
	}

	// Calculate nextDueDate: next month on billing day
	now := time.Now()
	nextDue := time.Date(now.Year(), now.Month()+1, req.BillingDay, 0, 0, 0, 0, time.UTC)
	// If that day is today (edge case), still push to next month
	_ = nextDue // repo recalculates this, but keep consistent logic

	sub, err := s.subRepo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("create subscription: %w", err)
	}

	// Create MikroTik queue if IP provided and client is available
	if req.IPAddress != nil && *req.IPAddress != "" && s.mtClient != nil {
		plan, err := s.planRepo.GetByID(ctx, req.PlanID)
		if err == nil {
			speed := s.mtClient.SpeedString(plan.SpeedMbps)
			queueName := fmt.Sprintf("sub-%s", sub.ID.String())
			queueID, err := s.mtClient.CreateQueue(queueName, *req.IPAddress, speed, speed)
			if err == nil && queueID != "" {
				_ = s.subRepo.UpdateMikroTikQueueID(ctx, sub.ID, &queueID)
				sub.MikroTikQueueID = &queueID
			}
		}
	}

	return sub, nil
}

// GetByID retrieves a subscription by its UUID.
func (s *SubscriptionService) GetByID(ctx context.Context, id uuid.UUID) (*model.Subscription, error) {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get subscription: %w", err)
	}
	return sub, nil
}

// GetByUserID retrieves all subscriptions for a given user.
func (s *SubscriptionService) GetByUserID(ctx context.Context, userID uuid.UUID) ([]*model.Subscription, error) {
	subs, err := s.subRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get subscriptions by user: %w", err)
	}
	return subs, nil
}

// List returns all subscriptions.
func (s *SubscriptionService) List(ctx context.Context) ([]*model.Subscription, error) {
	subs, err := s.subRepo.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("list subscriptions: %w", err)
	}
	return subs, nil
}

// Update updates a subscription's mutable fields.
func (s *SubscriptionService) Update(ctx context.Context, id uuid.UUID, req *model.UpdateSubscriptionRequest) (*model.Subscription, error) {
	sub, err := s.subRepo.Update(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("update subscription: %w", err)
	}
	return sub, nil
}

// Disconnect disables the MikroTik queue and marks the subscription as suspended.
func (s *SubscriptionService) Disconnect(ctx context.Context, id uuid.UUID) error {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}

	if s.mtClient != nil && sub.MikroTikQueueID != nil && *sub.MikroTikQueueID != "" {
		if err := s.mtClient.DisableQueue(*sub.MikroTikQueueID); err != nil {
			return fmt.Errorf("disable mikrotik queue: %w", err)
		}
	}

	if err := s.subRepo.UpdateStatus(ctx, id, model.SubStatusSuspended); err != nil {
		return fmt.Errorf("update subscription status: %w", err)
	}
	return nil
}

// Reconnect enables the MikroTik queue and marks the subscription as active.
func (s *SubscriptionService) Reconnect(ctx context.Context, id uuid.UUID) error {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}

	if s.mtClient != nil && sub.MikroTikQueueID != nil && *sub.MikroTikQueueID != "" {
		if err := s.mtClient.EnableQueue(*sub.MikroTikQueueID); err != nil {
			return fmt.Errorf("enable mikrotik queue: %w", err)
		}
	}

	if err := s.subRepo.UpdateStatus(ctx, id, model.SubStatusActive); err != nil {
		return fmt.Errorf("update subscription status: %w", err)
	}
	return nil
}

// GetOverdue returns subscriptions that are past their grace period and not yet suspended.
func (s *SubscriptionService) GetOverdue(ctx context.Context) ([]*model.Subscription, error) {
	subs, err := s.subRepo.GetOverdue(ctx)
	if err != nil {
		return nil, fmt.Errorf("get overdue subscriptions: %w", err)
	}
	return subs, nil
}

// GetDueSoon returns active subscriptions due within the given number of days.
func (s *SubscriptionService) GetDueSoon(ctx context.Context, days int) ([]*model.Subscription, error) {
	subs, err := s.subRepo.GetDueSoon(ctx, days)
	if err != nil {
		return nil, fmt.Errorf("get due-soon subscriptions: %w", err)
	}
	return subs, nil
}
