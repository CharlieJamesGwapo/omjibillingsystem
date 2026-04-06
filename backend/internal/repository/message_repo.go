package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Message represents a sent or pending SMS message.
type Message struct {
	ID             uuid.UUID  `json:"id"`
	SenderID       *uuid.UUID `json:"sender_id"`
	RecipientID    *uuid.UUID `json:"recipient_id"`
	RecipientPhone string     `json:"recipient_phone"`
	RecipientName  string     `json:"recipient_name"`
	Type           string     `json:"type"`
	Subject        string     `json:"subject"`
	Body           string     `json:"body"`
	Status         string     `json:"status"`
	ErrorMessage   *string    `json:"error_message"`
	BatchID        *uuid.UUID `json:"batch_id"`
	CreatedAt      time.Time  `json:"created_at"`
	SentAt         *time.Time `json:"sent_at"`
}

// MessageTemplate represents a reusable SMS message template.
type MessageTemplate struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Subject   string    `json:"subject"`
	Body      string    `json:"body"`
	Type      string    `json:"type"`
	Variables string    `json:"variables"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// MessageRepo handles database operations for messages and message templates.
type MessageRepo struct {
	db *pgxpool.Pool
}

// NewMessageRepo creates a new MessageRepo.
func NewMessageRepo(db *pgxpool.Pool) *MessageRepo {
	return &MessageRepo{db: db}
}

// Create inserts a single message and returns it with the generated ID.
func (r *MessageRepo) Create(ctx context.Context, msg *Message) (*Message, error) {
	err := r.db.QueryRow(ctx, `
		INSERT INTO messages (sender_id, recipient_id, recipient_phone, recipient_name, type, subject, body, status, error_message, batch_id, sent_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at`,
		msg.SenderID, msg.RecipientID, msg.RecipientPhone, msg.RecipientName,
		msg.Type, msg.Subject, msg.Body, msg.Status, msg.ErrorMessage, msg.BatchID, msg.SentAt,
	).Scan(&msg.ID, &msg.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create message: %w", err)
	}
	return msg, nil
}

// CreateBatch inserts multiple messages in a single transaction.
func (r *MessageRepo) CreateBatch(ctx context.Context, messages []*Message) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, msg := range messages {
		err := tx.QueryRow(ctx, `
			INSERT INTO messages (sender_id, recipient_id, recipient_phone, recipient_name, type, subject, body, status, error_message, batch_id, sent_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			RETURNING id, created_at`,
			msg.SenderID, msg.RecipientID, msg.RecipientPhone, msg.RecipientName,
			msg.Type, msg.Subject, msg.Body, msg.Status, msg.ErrorMessage, msg.BatchID, msg.SentAt,
		).Scan(&msg.ID, &msg.CreatedAt)
		if err != nil {
			return fmt.Errorf("create message in batch: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// UpdateStatus updates a message's status, error message, and sets sent_at if status is "sent".
func (r *MessageRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status string, errorMsg *string) error {
	var sentAt *time.Time
	if status == "sent" {
		now := time.Now()
		sentAt = &now
	}

	_, err := r.db.Exec(ctx, `
		UPDATE messages SET status = $1, error_message = $2, sent_at = $3
		WHERE id = $4`, status, errorMsg, sentAt, id)
	if err != nil {
		return fmt.Errorf("update message status: %w", err)
	}
	return nil
}

// List returns paginated messages ordered by created_at DESC, along with the total count.
func (r *MessageRepo) List(ctx context.Context, limit, offset int) ([]*Message, int, error) {
	var total int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM messages`).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count messages: %w", err)
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, sender_id, recipient_id, recipient_phone, recipient_name,
		       type, subject, body, status, error_message, batch_id, created_at, sent_at
		FROM messages
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list messages: %w", err)
	}
	defer rows.Close()

	var messages []*Message
	for rows.Next() {
		m := &Message{}
		if err := rows.Scan(
			&m.ID, &m.SenderID, &m.RecipientID, &m.RecipientPhone, &m.RecipientName,
			&m.Type, &m.Subject, &m.Body, &m.Status, &m.ErrorMessage, &m.BatchID, &m.CreatedAt, &m.SentAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan message: %w", err)
		}
		messages = append(messages, m)
	}
	return messages, total, rows.Err()
}

// ListByBatch returns all messages belonging to a specific batch.
func (r *MessageRepo) ListByBatch(ctx context.Context, batchID uuid.UUID) ([]*Message, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, sender_id, recipient_id, recipient_phone, recipient_name,
		       type, subject, body, status, error_message, batch_id, created_at, sent_at
		FROM messages
		WHERE batch_id = $1
		ORDER BY created_at DESC`, batchID)
	if err != nil {
		return nil, fmt.Errorf("list messages by batch: %w", err)
	}
	defer rows.Close()

	var messages []*Message
	for rows.Next() {
		m := &Message{}
		if err := rows.Scan(
			&m.ID, &m.SenderID, &m.RecipientID, &m.RecipientPhone, &m.RecipientName,
			&m.Type, &m.Subject, &m.Body, &m.Status, &m.ErrorMessage, &m.BatchID, &m.CreatedAt, &m.SentAt,
		); err != nil {
			return nil, fmt.Errorf("scan message: %w", err)
		}
		messages = append(messages, m)
	}
	return messages, rows.Err()
}

// GetTemplates returns all message templates.
func (r *MessageRepo) GetTemplates(ctx context.Context) ([]*MessageTemplate, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, subject, body, type, variables, created_at, updated_at
		FROM message_templates
		ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("get templates: %w", err)
	}
	defer rows.Close()

	var templates []*MessageTemplate
	for rows.Next() {
		t := &MessageTemplate{}
		if err := rows.Scan(&t.ID, &t.Name, &t.Subject, &t.Body, &t.Type, &t.Variables, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan template: %w", err)
		}
		templates = append(templates, t)
	}
	return templates, rows.Err()
}

// GetTemplate returns a single message template by name.
func (r *MessageRepo) GetTemplate(ctx context.Context, name string) (*MessageTemplate, error) {
	t := &MessageTemplate{}
	err := r.db.QueryRow(ctx, `
		SELECT id, name, subject, body, type, variables, created_at, updated_at
		FROM message_templates
		WHERE name = $1`, name).
		Scan(&t.ID, &t.Name, &t.Subject, &t.Body, &t.Type, &t.Variables, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get template %q: %w", name, err)
	}
	return t, nil
}

// UpdateTemplate updates a template's subject and body.
func (r *MessageRepo) UpdateTemplate(ctx context.Context, id uuid.UUID, subject, body string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE message_templates SET subject = $1, body = $2, updated_at = NOW()
		WHERE id = $3`, subject, body, id)
	if err != nil {
		return fmt.Errorf("update template: %w", err)
	}
	return nil
}
