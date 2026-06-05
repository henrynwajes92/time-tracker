//go:build integration

package handler_test

import (
	"net/http"
	"testing"
)

func TestRegister_CreatesTeamAndAdmin(t *testing.T) {
	r, _ := setupRouter(t)

	email := uniqueEmail("admin")
	rr := do(t, r, http.MethodPost, "/api/auth/register", map[string]string{
		"name": "Test Admin", "email": email, "password": "password123",
	}, "")

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rr.Code, rr.Body.String())
	}

	var body map[string]any
	unmarshal(t, rr, &body)

	if body["role"] != "ADMIN" {
		t.Errorf("expected role ADMIN, got %v", body["role"])
	}
	if body["accessToken"] == nil || body["accessToken"] == "" {
		t.Error("expected accessToken in response")
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	r, _ := setupRouter(t)
	email := uniqueEmail("dup")

	do(t, r, http.MethodPost, "/api/auth/register", map[string]string{
		"name": "User", "email": email, "password": "pass123",
	}, "")

	rr := do(t, r, http.MethodPost, "/api/auth/register", map[string]string{
		"name": "User2", "email": email, "password": "pass456",
	}, "")

	if rr.Code != http.StatusConflict {
		t.Errorf("expected 409, got %d", rr.Code)
	}
}

func TestVerify_WrongPassword(t *testing.T) {
	r, _ := setupRouter(t)
	email := uniqueEmail("verify")

	do(t, r, http.MethodPost, "/api/auth/register", map[string]string{
		"name": "User", "email": email, "password": "correctpass",
	}, "")

	rr := do(t, r, http.MethodPost, "/api/auth/verify", map[string]string{
		"email": email, "password": "wrongpass",
	}, "")

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestVerify_ReturnsAccessToken(t *testing.T) {
	r, _ := setupRouter(t)
	email := uniqueEmail("token")

	do(t, r, http.MethodPost, "/api/auth/register", map[string]string{
		"name": "User", "email": email, "password": "mypassword",
	}, "")

	rr := do(t, r, http.MethodPost, "/api/auth/verify", map[string]string{
		"email": email, "password": "mypassword",
	}, "")

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var body map[string]any
	unmarshal(t, rr, &body)

	if body["accessToken"] == "" || body["accessToken"] == nil {
		t.Error("expected accessToken in verify response")
	}
}
