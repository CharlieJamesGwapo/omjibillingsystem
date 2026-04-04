package handler

import (
	"fmt"
	"net/http"

	"github.com/jdns/billingsystem/internal/service"
	"github.com/jdns/billingsystem/internal/sms"
)

// NotificationHandler handles SMS notification HTTP requests.
type NotificationHandler struct {
	subService  *service.SubscriptionService
	smsProvider sms.Provider
}

// NewNotificationHandler creates a new NotificationHandler.
func NewNotificationHandler(subService *service.SubscriptionService, smsProvider sms.Provider) *NotificationHandler {
	return &NotificationHandler{
		subService:  subService,
		smsProvider: smsProvider,
	}
}

// SendReminders sends SMS reminders to customers with subscriptions due within 2 days.
func (h *NotificationHandler) SendReminders(w http.ResponseWriter, r *http.Request) {
	subs, err := h.subService.GetDueSoon(r.Context(), 2)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get due-soon subscriptions")
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
		if err := h.smsProvider.SendReminder(sub.UserPhone, msg); err == nil {
			sent++
		}
	}

	writeJSON(w, http.StatusOK, map[string]int{"sent": sent})
}
