package cron

import (
	"fmt"
	"log"
	"time"

	"github.com/jdns/billingsystem/internal/service"
	"github.com/jdns/billingsystem/internal/sms"
)

// Scheduler runs periodic background jobs for overdue checks and SMS reminders.
type Scheduler struct {
	subService  *service.SubscriptionService
	smsProvider sms.Provider
	stop        chan struct{}
}

// NewScheduler creates a new Scheduler.
func NewScheduler(subService *service.SubscriptionService, smsProvider sms.Provider) *Scheduler {
	return &Scheduler{
		subService:  subService,
		smsProvider: smsProvider,
		stop:        make(chan struct{}),
	}
}

// Start launches background goroutines for overdue and reminder checks.
func (s *Scheduler) Start() {
	log.Println("[CRON] Starting scheduler")
	go s.runOverdueCheck()
	go s.runReminderCheck()
}

// Stop signals all background goroutines to halt.
func (s *Scheduler) Stop() {
	log.Println("[CRON] Stopping scheduler")
	close(s.stop)
}

// runOverdueCheck runs immediately then every hour. Disconnects overdue subscriptions
// and sends an SMS notification to each affected customer.
func (s *Scheduler) runOverdueCheck() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	// Run immediately on startup
	s.checkOverdue()

	for {
		select {
		case <-ticker.C:
			s.checkOverdue()
		case <-s.stop:
			return
		}
	}
}

// runReminderCheck waits until 8 AM daily, then sends SMS reminders for subscriptions
// due within the next 2 days.
func (s *Scheduler) runReminderCheck() {
	for {
		now := time.Now()
		// Calculate time until next 8 AM
		next8AM := time.Date(now.Year(), now.Month(), now.Day(), 8, 0, 0, 0, now.Location())
		if now.After(next8AM) {
			next8AM = next8AM.Add(24 * time.Hour)
		}
		delay := next8AM.Sub(now)

		select {
		case <-time.After(delay):
			s.sendReminders()
		case <-s.stop:
			return
		}
	}
}

// checkOverdue finds overdue subscriptions, disconnects each, and sends an SMS.
func (s *Scheduler) checkOverdue() {
	log.Println("[CRON] Running overdue check")
	ctx := newBackground()

	subs, err := s.subService.GetOverdue(ctx)
	if err != nil {
		log.Printf("[CRON] Failed to get overdue subscriptions: %v", err)
		return
	}

	for _, sub := range subs {
		if err := s.subService.MarkOverdue(ctx, sub.ID); err != nil {
			log.Printf("[CRON] Failed to mark subscription %s overdue: %v", sub.ID, err)
			continue
		}

		msg := fmt.Sprintf(
			"Hi %s, your internet connection has been suspended due to non-payment. Please settle your bill of PHP %.2f to reconnect.",
			sub.UserName,
			sub.PlanPrice,
		)
		if err := s.smsProvider.SendReminder(sub.UserPhone, msg); err != nil {
			log.Printf("[CRON] Failed to send disconnection SMS to %s: %v", sub.UserPhone, err)
		}
	}

	log.Printf("[CRON] Overdue check complete: processed %d subscriptions", len(subs))
}

// sendReminders finds subscriptions due within 2 days and sends SMS reminders.
func (s *Scheduler) sendReminders() {
	log.Println("[CRON] Running reminder check")
	ctx := newBackground()

	subs, err := s.subService.GetDueSoon(ctx, 2)
	if err != nil {
		log.Printf("[CRON] Failed to get due-soon subscriptions: %v", err)
		return
	}

	sent := 0
	for _, sub := range subs {
		msg := fmt.Sprintf(
			"Hi %s, your internet bill of PHP %.2f is due on %s. Please pay on time to avoid disconnection.",
			sub.UserName,
			sub.PlanPrice,
			sub.NextDueDate.Format("January 2, 2006"),
		)
		if err := s.smsProvider.SendReminder(sub.UserPhone, msg); err != nil {
			log.Printf("[CRON] Failed to send reminder SMS to %s: %v", sub.UserPhone, err)
			continue
		}
		sent++
	}

	log.Printf("[CRON] Reminder check complete: sent %d reminders", sent)
}
