package cron

import "context"

// newBackground returns a new background context for use in scheduled jobs.
func newBackground() context.Context {
	return context.Background()
}
