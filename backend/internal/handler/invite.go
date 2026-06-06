package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/henryu/time-tracker/backend/internal/email"
	"github.com/henryu/time-tracker/backend/internal/middleware"
	"github.com/henryu/time-tracker/backend/internal/service"
)

type InviteHandler struct {
	svc         *service.InviteService
	emailClient *email.Client
}

func NewInviteHandler(svc *service.InviteService, emailClient *email.Client) *InviteHandler {
	return &InviteHandler{svc: svc, emailClient: emailClient}
}

// POST /api/invites — admin creates an invite and emails the link
func (h *InviteHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)

	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email is required"})
		return
	}

	inv, err := h.svc.CreateInvite(r.Context(), req.Email, claims.TeamID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create invite"})
		return
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "https://time-tracker-lmi9.vercel.app"
	}
	inviteURL := appURL + "/invite/" + inv.Token

	// Send email — non-fatal if it fails
	emailSent := false
	if h.emailClient.Enabled() {
		if emailErr := h.emailClient.SendInvite(req.Email, inviteURL); emailErr != nil {
			log.Printf("invite email to %s failed: %v", req.Email, emailErr)
		} else {
			emailSent = true
		}
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"token":     inv.Token,
		"inviteUrl": inviteURL,
		"email":     inv.Email,
		"emailSent": emailSent,
	})
}

// GET /api/invites/:token — validate an invite token (public)
func (h *InviteHandler) Get(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")

	inv, err := h.svc.GetInvite(r.Context(), token)
	if errors.Is(err, service.ErrInviteNotFound) || errors.Is(err, sql.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "invite not found or expired"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not fetch invite"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"email": inv.Email,
	})
}

// POST /api/invites/:token/accept — accept an invite and create account
func (h *InviteHandler) Accept(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")

	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	user, err := h.svc.AcceptInvite(r.Context(), token, req.Name, req.Email, req.Password)
	if errors.Is(err, service.ErrInviteNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "invite not found or expired"})
		return
	}
	if errors.Is(err, service.ErrInviteEmailMismatch) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email does not match invite"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not accept invite"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":     user.ID,
		"name":   user.Name,
		"email":  user.Email,
		"role":   user.Role,
		"teamId": user.TeamID,
	})
}
