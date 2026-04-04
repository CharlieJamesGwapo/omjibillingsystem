package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
)

// UserService handles business logic for user management.
type UserService struct {
	userRepo    *repository.UserRepo
	authService *AuthService
}

// NewUserService creates a new UserService.
func NewUserService(userRepo *repository.UserRepo, authService *AuthService) *UserService {
	return &UserService{
		userRepo:    userRepo,
		authService: authService,
	}
}

// Create creates a new user, hashing the password for non-customer roles if provided.
func (s *UserService) Create(ctx context.Context, req *model.CreateUserRequest) (*model.User, error) {
	var passwordHash *string

	if req.Role != model.RoleCustomer && req.Password != nil && *req.Password != "" {
		hash, err := s.authService.HashPassword(*req.Password)
		if err != nil {
			return nil, fmt.Errorf("hash password: %w", err)
		}
		passwordHash = &hash
	}

	user, err := s.userRepo.Create(ctx, req, passwordHash)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return user, nil
}

// GetByID retrieves a user by their UUID.
func (s *UserService) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	user, err := s.userRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	return user, nil
}

// List returns all users, optionally filtered by role.
func (s *UserService) List(ctx context.Context, role *model.UserRole) ([]*model.User, error) {
	users, err := s.userRepo.List(ctx, role)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	return users, nil
}

// Update updates a user's profile. Hashes a new password if provided and the user is not a customer.
func (s *UserService) Update(ctx context.Context, id uuid.UUID, req *model.UpdateUserRequest) (*model.User, error) {
	var passwordHash *string

	if req.Password != nil && *req.Password != "" {
		// Determine effective role
		targetRole := model.RoleCustomer
		existing, err := s.userRepo.GetByID(ctx, id)
		if err == nil {
			targetRole = existing.Role
		}
		if req.Role != nil {
			targetRole = *req.Role
		}

		if targetRole != model.RoleCustomer {
			hash, err := s.authService.HashPassword(*req.Password)
			if err != nil {
				return nil, fmt.Errorf("hash password: %w", err)
			}
			passwordHash = &hash
		}
	}

	user, err := s.userRepo.Update(ctx, id, req, passwordHash)
	if err != nil {
		return nil, fmt.Errorf("update user: %w", err)
	}
	return user, nil
}

// Delete removes a user by their UUID.
func (s *UserService) Delete(ctx context.Context, id uuid.UUID) error {
	if err := s.userRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	return nil
}
