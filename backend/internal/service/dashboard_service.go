package service

import (
	"context"
	"fmt"

	"github.com/jdns/billingsystem/internal/repository"
)

// DashboardService handles business logic for dashboard statistics and reports.
type DashboardService struct {
	dashRepo *repository.DashboardRepo
	logRepo  *repository.ActivityLogRepo
}

// NewDashboardService creates a new DashboardService.
func NewDashboardService(dashRepo *repository.DashboardRepo, logRepo *repository.ActivityLogRepo) *DashboardService {
	return &DashboardService{
		dashRepo: dashRepo,
		logRepo:  logRepo,
	}
}

// GetStats returns aggregated dashboard statistics.
func (s *DashboardService) GetStats(ctx context.Context) (*repository.DashboardStats, error) {
	stats, err := s.dashRepo.GetStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("get dashboard stats: %w", err)
	}
	return stats, nil
}

// GetIncomeReport returns daily income totals for approved payments.
func (s *DashboardService) GetIncomeReport(ctx context.Context) ([]*repository.IncomeReport, error) {
	report, err := s.dashRepo.GetIncomeReport(ctx)
	if err != nil {
		return nil, fmt.Errorf("get income report: %w", err)
	}
	return report, nil
}
