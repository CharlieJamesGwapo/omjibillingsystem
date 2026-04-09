package service

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/mikrotik"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
)

// SubscriptionService handles business logic for customer subscriptions.
type SubscriptionService struct {
	subRepo   *repository.SubscriptionRepo
	planRepo  *repository.PlanRepo
	mtManager *mikrotik.Manager
	agentHub  *mikrotik.AgentHub
}

// NewSubscriptionService creates a new SubscriptionService.
func NewSubscriptionService(
	subRepo *repository.SubscriptionRepo,
	planRepo *repository.PlanRepo,
	mtManager *mikrotik.Manager,
	agentHub *mikrotik.AgentHub,
) *SubscriptionService {
	return &SubscriptionService{
		subRepo:   subRepo,
		planRepo:  planRepo,
		mtManager: mtManager,
		agentHub:  agentHub,
	}
}

// getMTExecutor returns the best available MikroTik executor.
// Prefers agent hub if connected, falls back to direct client, returns nil if neither available.
func (s *SubscriptionService) getMTExecutor() mikrotik.MikroTikExecutor {
	if s.agentHub != nil && s.agentHub.IsConnected() {
		return s.agentHub
	}
	if c := s.mtManager.Get(); c != nil {
		return c
	}
	return nil
}

// planProfile returns the MikroTik profile name for a plan.
// Uses MikroTikProfile if set, falls back to plan Name.
func planProfile(plan *model.Plan) string {
	if plan.MikroTikProfile != nil && *plan.MikroTikProfile != "" {
		return *plan.MikroTikProfile
	}
	return plan.Name
}

// Create creates a new subscription. BillingDay is capped at 28, nextDueDate is set to
// next month on that day, and grace period defaults to 2 days. If an IP is provided and
// the MikroTik client is available, a bandwidth queue is created.
func (s *SubscriptionService) Create(ctx context.Context, req *model.CreateSubscriptionRequest) (*model.Subscription, error) {
	if req.BillingDay > 28 {
		req.BillingDay = 28
	}
	if req.BillingDay < 1 {
		req.BillingDay = 1
	}
	if req.GraceDays == nil {
		defaultGrace := 2
		req.GraceDays = &defaultGrace
	}

	sub, err := s.subRepo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("create subscription: %w", err)
	}

	mt := s.getMTExecutor()
	if mt != nil {
		plan, planErr := s.planRepo.GetByID(ctx, req.PlanID)
		if planErr == nil {
			// Provision PPPoE secret
			if req.PPPoEUsername != nil && *req.PPPoEUsername != "" {
				password := ""
				if req.PPPoEPassword != nil {
					password = *req.PPPoEPassword
				}
				profile := planProfile(plan)
				if err := mt.AddPPPoESecret(*req.PPPoEUsername, password, profile); err != nil {
					log.Printf("[MikroTik] AddPPPoESecret failed for %s: %v", *req.PPPoEUsername, err)
				}
			}

			// Create Simple Queue (IP-based, existing behavior)
			if req.IPAddress != nil && *req.IPAddress != "" {
				speed := fmt.Sprintf("%dM", plan.SpeedMbps)
				queueName := fmt.Sprintf("sub-%s", sub.ID.String())
				queueID, err := mt.CreateQueue(queueName, *req.IPAddress, speed, speed)
				if err == nil && queueID != "" {
					_ = s.subRepo.UpdateMikroTikQueueID(ctx, sub.ID, &queueID)
					sub.MikroTikQueueID = &queueID
				}
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

	if mt := s.getMTExecutor(); mt != nil {
		if sub.PPPoEUsername != nil && *sub.PPPoEUsername != "" {
			if err := mt.DisablePPPoEUser(*sub.PPPoEUsername); err != nil {
				log.Printf("[MikroTik] DisablePPPoEUser %s: %v", *sub.PPPoEUsername, err)
			}
		}
		if sub.MikroTikQueueID != nil && *sub.MikroTikQueueID != "" {
			if err := mt.DisableQueue(*sub.MikroTikQueueID); err != nil {
				log.Printf("[MikroTik] DisableQueue %s: %v", *sub.MikroTikQueueID, err)
			}
		}
	}

	return s.subRepo.UpdateStatus(ctx, id, model.SubStatusSuspended)
}

// Reconnect enables the MikroTik queue and marks the subscription as active.
func (s *SubscriptionService) Reconnect(ctx context.Context, id uuid.UUID) error {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}

	if mt := s.getMTExecutor(); mt != nil {
		if sub.PPPoEUsername != nil && *sub.PPPoEUsername != "" {
			if err := mt.EnablePPPoEUser(*sub.PPPoEUsername); err != nil {
				log.Printf("[MikroTik] EnablePPPoEUser %s: %v", *sub.PPPoEUsername, err)
			}
			plan, planErr := s.planRepo.GetByID(ctx, sub.PlanID)
			if planErr == nil {
				if err := mt.SetPPPoEProfile(*sub.PPPoEUsername, planProfile(plan)); err != nil {
					log.Printf("[MikroTik] SetPPPoEProfile %s: %v", *sub.PPPoEUsername, err)
				}
			}
		}
		if sub.MikroTikQueueID != nil && *sub.MikroTikQueueID != "" {
			if err := mt.EnableQueue(*sub.MikroTikQueueID); err != nil {
				log.Printf("[MikroTik] EnableQueue %s: %v", *sub.MikroTikQueueID, err)
			}
		}
	}

	return s.subRepo.UpdateStatus(ctx, id, model.SubStatusActive)
}

// MarkOverdue sets a subscription to overdue status and changes PPPoE profile to "unpaid".
// Use this for automated overdue processing (cron). The "unpaid" profile in MikroTik
// prevents new dial attempts and logs errors, without fully disabling the secret.
func (s *SubscriptionService) MarkOverdue(ctx context.Context, id uuid.UUID) error {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}

	if mt := s.getMTExecutor(); mt != nil {
		if sub.PPPoEUsername != nil && *sub.PPPoEUsername != "" {
			if err := mt.SetPPPoEProfile(*sub.PPPoEUsername, "unpaid"); err != nil {
				log.Printf("[MikroTik] SetPPPoEProfile unpaid %s: %v", *sub.PPPoEUsername, err)
			}
		}
	}

	return s.subRepo.UpdateStatus(ctx, id, model.SubStatusOverdue)
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
