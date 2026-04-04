package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
)

// PlanService handles business logic for internet plan management.
type PlanService struct {
	planRepo *repository.PlanRepo
}

// NewPlanService creates a new PlanService.
func NewPlanService(planRepo *repository.PlanRepo) *PlanService {
	return &PlanService{planRepo: planRepo}
}

// Create creates a new internet plan.
func (s *PlanService) Create(ctx context.Context, req *model.CreatePlanRequest) (*model.Plan, error) {
	plan, err := s.planRepo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("create plan: %w", err)
	}
	return plan, nil
}

// GetByID retrieves a plan by its UUID.
func (s *PlanService) GetByID(ctx context.Context, id uuid.UUID) (*model.Plan, error) {
	plan, err := s.planRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get plan: %w", err)
	}
	return plan, nil
}

// List returns all plans. If activeOnly is true, only active plans are returned.
func (s *PlanService) List(ctx context.Context, activeOnly bool) ([]*model.Plan, error) {
	plans, err := s.planRepo.List(ctx, activeOnly)
	if err != nil {
		return nil, fmt.Errorf("list plans: %w", err)
	}
	return plans, nil
}

// Update updates a plan's fields.
func (s *PlanService) Update(ctx context.Context, id uuid.UUID, req *model.UpdatePlanRequest) (*model.Plan, error) {
	plan, err := s.planRepo.Update(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("update plan: %w", err)
	}
	return plan, nil
}

// Delete removes a plan by its UUID.
func (s *PlanService) Delete(ctx context.Context, id uuid.UUID) error {
	if err := s.planRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("delete plan: %w", err)
	}
	return nil
}
