package middleware

import (
	"net/http"
	"sync"
	"time"
)

type rateLimiter struct {
	mu      sync.Mutex
	clients map[string][]time.Time
	limit   int
	window  time.Duration
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		clients: make(map[string][]time.Time),
		limit:   limit,
		window:  window,
	}
	go rl.cleanup()
	return rl
}

// allow returns true if the given key is within the rate limit.
func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	// Filter out old timestamps
	times := rl.clients[key]
	valid := times[:0]
	for _, t := range times {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= rl.limit {
		rl.clients[key] = valid
		return false
	}

	rl.clients[key] = append(valid, now)
	return true
}

// cleanup periodically removes stale entries from the map.
func (rl *rateLimiter) cleanup() {
	ticker := time.NewTicker(rl.window)
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-rl.window)
		for key, times := range rl.clients {
			valid := times[:0]
			for _, t := range times {
				if t.After(cutoff) {
					valid = append(valid, t)
				}
			}
			if len(valid) == 0 {
				delete(rl.clients, key)
			} else {
				rl.clients[key] = valid
			}
		}
		rl.mu.Unlock()
	}
}

// RateLimit returns an HTTP middleware that limits requests by IP address.
func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	rl := newRateLimiter(limit, window)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			// Strip port if present
			for i := len(ip) - 1; i >= 0; i-- {
				if ip[i] == ':' {
					ip = ip[:i]
					break
				}
			}

			if !rl.allow(ip) {
				http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
