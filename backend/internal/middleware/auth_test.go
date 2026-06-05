package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/henryu/time-tracker/backend/internal/middleware"
)

func makeToken(secret, id, email, role, teamID string, exp time.Duration) string {
	claims := middleware.Claims{
		ID:     id,
		Email:  email,
		Role:   role,
		TeamID: teamID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(exp)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	tok, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	return tok
}

func TestAuth_MissingHeader(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")
	h := middleware.Auth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestAuth_InvalidToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")
	h := middleware.Auth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer not-a-valid-token")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestAuth_ExpiredToken(t *testing.T) {
	secret := "test-secret"
	os.Setenv("JWT_SECRET", secret)
	tok := makeToken(secret, "u1", "u@test.com", "MEMBER", "t1", -time.Hour)

	h := middleware.Auth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestAuth_ValidToken_ClaimsInContext(t *testing.T) {
	secret := "test-secret"
	os.Setenv("JWT_SECRET", secret)
	tok := makeToken(secret, "user-abc", "test@example.com", "ADMIN", "team-xyz", time.Hour)

	var got *middleware.Claims
	h := middleware.Auth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got, _ = middleware.GetClaims(r)
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if got == nil {
		t.Fatal("expected claims in context, got nil")
	}
	if got.ID != "user-abc" || got.Role != "ADMIN" || got.TeamID != "team-xyz" {
		t.Errorf("unexpected claims: %+v", got)
	}
}

func TestRequireAdmin_DeniesMembers(t *testing.T) {
	secret := "test-secret"
	os.Setenv("JWT_SECRET", secret)
	tok := makeToken(secret, "u1", "u@test.com", "MEMBER", "t1", time.Hour)

	h := middleware.Auth(middleware.RequireAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", rr.Code)
	}
}

func TestRequireAdmin_AllowsAdmins(t *testing.T) {
	secret := "test-secret"
	os.Setenv("JWT_SECRET", secret)
	tok := makeToken(secret, "u1", "u@test.com", "ADMIN", "t1", time.Hour)

	h := middleware.Auth(middleware.RequireAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
}
