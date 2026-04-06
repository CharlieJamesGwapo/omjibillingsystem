package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DashboardStats struct {
	TotalCustomers  int     `json:"total_customers"`
	ActiveSubs      int     `json:"active"`
	OverdueSubs     int     `json:"overdue"`
	SuspendedSubs   int     `json:"suspended"`
	MonthlyIncome   float64 `json:"monthly_income"`
	ExpectedIncome  float64 `json:"expected_income"`
	PendingPayments int     `json:"pending_payments"`
}

type IncomeReport struct {
	Date   time.Time `json:"date"`
	Amount float64   `json:"amount"`
	Count  int       `json:"count"`
}

type DashboardRepo struct {
	db *pgxpool.Pool
}

func NewDashboardRepo(db *pgxpool.Pool) *DashboardRepo {
	return &DashboardRepo{db: db}
}

func (r *DashboardRepo) GetStats(ctx context.Context) (*DashboardStats, error) {
	stats := &DashboardStats{}

	// Total customers
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role = 'customer'`).Scan(&stats.TotalCustomers); err != nil {
		return nil, fmt.Errorf("get total customers: %w", err)
	}

	// Subscription counts by status
	rows, err := r.db.Query(ctx, `SELECT status, COUNT(*) FROM subscriptions GROUP BY status`)
	if err != nil {
		return nil, fmt.Errorf("get subscription stats: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, fmt.Errorf("scan subscription status: %w", err)
		}
		switch status {
		case "active":
			stats.ActiveSubs = count
		case "overdue":
			stats.OverdueSubs = count
		case "suspended":
			stats.SuspendedSubs = count
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Monthly income (approved payments this calendar month)
	if err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount), 0)
		FROM payments
		WHERE status = 'approved'
		  AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`).Scan(&stats.MonthlyIncome); err != nil {
		return nil, fmt.Errorf("get monthly income: %w", err)
	}

	// Expected income (sum of active/overdue subscription plan prices)
	if err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(p.price), 0)
		FROM subscriptions s
		JOIN plans p ON p.id = s.plan_id
		WHERE s.status IN ('active', 'overdue')`).Scan(&stats.ExpectedIncome); err != nil {
		return nil, fmt.Errorf("get expected income: %w", err)
	}

	// Pending payments count
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM payments WHERE status = 'pending'`).Scan(&stats.PendingPayments); err != nil {
		return nil, fmt.Errorf("get pending payments: %w", err)
	}

	return stats, nil
}

// IncomeChartEntry represents monthly income data for charting.
type IncomeChartEntry struct {
	Month  string  `json:"month"`
	Label  string  `json:"label"`
	Income float64 `json:"income"`
	Count  int     `json:"count"`
}

// GetIncomeChart returns monthly income aggregated over the last 12 months.
func (r *DashboardRepo) GetIncomeChart(ctx context.Context) ([]*IncomeChartEntry, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			TO_CHAR(created_at, 'YYYY-MM') as month,
			TO_CHAR(created_at, 'Mon YYYY') as label,
			COALESCE(SUM(amount), 0) as income,
			COUNT(*) as count
		FROM payments
		WHERE status = 'approved'
			AND created_at >= NOW() - INTERVAL '12 months'
		GROUP BY month, label
		ORDER BY month DESC`)
	if err != nil {
		return nil, fmt.Errorf("get income chart: %w", err)
	}
	defer rows.Close()

	var entries []*IncomeChartEntry
	for rows.Next() {
		e := &IncomeChartEntry{}
		if err := rows.Scan(&e.Month, &e.Label, &e.Income, &e.Count); err != nil {
			return nil, fmt.Errorf("scan income chart entry: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

func (r *DashboardRepo) GetIncomeReport(ctx context.Context) ([]*IncomeReport, error) {
	rows, err := r.db.Query(ctx, `
		SELECT DATE_TRUNC('day', created_at) AS day, SUM(amount), COUNT(*)
		FROM payments
		WHERE status = 'approved'
		GROUP BY day
		ORDER BY day DESC
		LIMIT 30`)
	if err != nil {
		return nil, fmt.Errorf("get income report: %w", err)
	}
	defer rows.Close()

	var reports []*IncomeReport
	for rows.Next() {
		ir := &IncomeReport{}
		if err := rows.Scan(&ir.Date, &ir.Amount, &ir.Count); err != nil {
			return nil, fmt.Errorf("scan income report: %w", err)
		}
		reports = append(reports, ir)
	}
	return reports, rows.Err()
}
