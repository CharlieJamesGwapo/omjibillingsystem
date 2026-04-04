package model

import (
	"time"

	"github.com/google/uuid"
)

type UserRole string
type UserStatus string

const (
	RoleAdmin      UserRole = "admin"
	RoleTechnician UserRole = "technician"
	RoleCustomer   UserRole = "customer"

	StatusActive   UserStatus = "active"
	StatusInactive UserStatus = "inactive"
)

type User struct {
	ID           uuid.UUID  `json:"id"`
	Phone        string     `json:"phone"`
	FullName     string     `json:"full_name"`
	Email        *string    `json:"email"`
	Address      *string    `json:"address"`
	Role         UserRole   `json:"role"`
	PasswordHash *string    `json:"-"`
	Status       UserStatus `json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type CreateUserRequest struct {
	Phone    string     `json:"phone"`
	FullName string     `json:"full_name"`
	Email    *string    `json:"email"`
	Address  *string    `json:"address"`
	Role     UserRole   `json:"role"`
	Password *string    `json:"password"`
	Status   UserStatus `json:"status"`
}

type UpdateUserRequest struct {
	FullName *string    `json:"full_name"`
	Email    *string    `json:"email"`
	Address  *string    `json:"address"`
	Role     *UserRole  `json:"role"`
	Password *string    `json:"password"`
	Status   *UserStatus `json:"status"`
}
