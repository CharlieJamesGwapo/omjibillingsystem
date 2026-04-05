package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
	"github.com/jdns/billingsystem/internal/sms"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrOTPRateLimited     = errors.New("too many OTP requests, please try again later")
	ErrOTPInvalid         = errors.New("invalid or expired OTP")
	ErrUserNotFound       = errors.New("user not found")
	ErrCustomerMustUseOTP = errors.New("customers must authenticate via OTP")
	ErrInvalidToken       = errors.New("invalid token")
)

const (
	otpRateLimit   = 5
	otpWindow      = time.Hour
	otpExpiry      = 10 * time.Minute
	accessExpiry   = 15 * time.Minute
	refreshExpiry  = 7 * 24 * time.Hour
)

type Claims struct {
	UserID uuid.UUID      `json:"user_id"`
	Role   model.UserRole `json:"role"`
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type AuthService struct {
	userRepo      *repository.UserRepo
	otpRepo       *repository.OTPRepo
	smsProvider   sms.Provider
	jwtSecret     []byte
	refreshSecret []byte
}

func NewAuthService(
	userRepo *repository.UserRepo,
	otpRepo *repository.OTPRepo,
	smsProvider sms.Provider,
	jwtSecret string,
	refreshSecret string,
) *AuthService {
	return &AuthService{
		userRepo:      userRepo,
		otpRepo:       otpRepo,
		smsProvider:   smsProvider,
		jwtSecret:     []byte(jwtSecret),
		refreshSecret: []byte(refreshSecret),
	}
}

// RequestOTP generates and sends an OTP to the given phone number.
func (s *AuthService) RequestOTP(ctx context.Context, phone string) error {
	since := time.Now().Add(-otpWindow)
	count, err := s.otpRepo.CountRecent(ctx, phone, since)
	if err != nil {
		return fmt.Errorf("check otp rate limit: %w", err)
	}
	if count >= otpRateLimit {
		return ErrOTPRateLimited
	}

	code, err := s.generateOTP()
	if err != nil {
		return fmt.Errorf("generate otp: %w", err)
	}

	expiresAt := time.Now().Add(otpExpiry)
	if _, err := s.otpRepo.Create(ctx, phone, code, expiresAt); err != nil {
		return fmt.Errorf("save otp: %w", err)
	}

	if err := s.smsProvider.SendOTP(phone, code); err != nil {
		return fmt.Errorf("send otp: %w", err)
	}
	return nil
}

// VerifyOTP verifies an OTP and returns a token pair for the associated user.
func (s *AuthService) VerifyOTP(ctx context.Context, phone, code string) (*TokenPair, *model.User, error) {
	verified, err := s.otpRepo.Verify(ctx, phone, code)
	if err != nil {
		return nil, nil, fmt.Errorf("verify otp: %w", err)
	}
	if !verified {
		return nil, nil, ErrOTPInvalid
	}

	user, err := s.userRepo.GetByPhone(ctx, phone)
	if err != nil {
		return nil, nil, ErrUserNotFound
	}

	tokens, err := s.generateTokenPair(user.ID, user.Role)
	if err != nil {
		return nil, nil, fmt.Errorf("generate tokens: %w", err)
	}
	return tokens, user, nil
}

// Login authenticates users via password.
func (s *AuthService) Login(ctx context.Context, phone, password string) (*TokenPair, *model.User, error) {
	user, err := s.userRepo.GetByPhone(ctx, phone)
	if err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	if user.PasswordHash == nil {
		return nil, nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	tokens, err := s.generateTokenPair(user.ID, user.Role)
	if err != nil {
		return nil, nil, fmt.Errorf("generate tokens: %w", err)
	}
	return tokens, user, nil
}

// RefreshToken parses a refresh token and returns a new token pair.
func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(refreshToken, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.refreshSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	tokens, err := s.generateTokenPair(claims.UserID, claims.Role)
	if err != nil {
		return nil, fmt.Errorf("generate tokens: %w", err)
	}
	return tokens, nil
}

// ValidateToken parses an access token and returns its claims.
func (s *AuthService) ValidateToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

// HashPassword hashes a plaintext password using bcrypt.
func (s *AuthService) HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

// generateTokenPair creates an access + refresh JWT pair.
func (s *AuthService) generateTokenPair(userID uuid.UUID, role model.UserRole) (*TokenPair, error) {
	now := time.Now()
	accessExp := now.Add(accessExpiry)

	accessClaims := &Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExp),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).SignedString(s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	refreshClaims := &Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(refreshExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString(s.refreshSecret)
	if err != nil {
		return nil, fmt.Errorf("sign refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    accessExp,
	}, nil
}

// generateOTP creates a cryptographically random 6-digit OTP code.
func (s *AuthService) generateOTP() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}
