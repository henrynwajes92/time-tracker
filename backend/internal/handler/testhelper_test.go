//go:build integration

package handler_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/henryu/time-tracker/backend/internal/handler"
	appMW "github.com/henryu/time-tracker/backend/internal/middleware"
	"github.com/henryu/time-tracker/backend/internal/repository"
	"github.com/henryu/time-tracker/backend/internal/service"
)

const testSecret = "integration-test-secret"

func setupRouter(t *testing.T) (*chi.Mux, *repository.UserRepository) {
	t.Helper()
	os.Setenv("JWT_SECRET", testSecret)

	db, err := repository.Connect()
	if err != nil {
		t.Fatalf("db connect: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	inviteRepo := repository.NewInviteRepository(db)
	memberRepo := repository.NewMemberRepository(db)
	projectRepo := repository.NewProjectRepository(db)
	taskRepo := repository.NewTaskRepository(db)
	timeRepo := repository.NewTimeEntryRepository(db)

	authSvc := service.NewAuthService(userRepo)
	inviteSvc := service.NewInviteService(inviteRepo, memberRepo, userRepo)
	memberSvc := service.NewMemberService(memberRepo)
	userSvc := service.NewUserService(userRepo)
	projectSvc := service.NewProjectService(projectRepo, taskRepo)
	timeEntrySvc := service.NewTimeEntryService(timeRepo)

	authH := handler.NewAuthHandler(authSvc)
	inviteH := handler.NewInviteHandler(inviteSvc)
	memberH := handler.NewMemberHandler(memberSvc)
	userH := handler.NewUserHandler(userSvc)
	projectH := handler.NewProjectHandler(projectSvc)
	timeH := handler.NewTimeEntryHandler(timeEntrySvc)

	r := chi.NewRouter()
	r.Use(appMW.CORS)

	r.Post("/api/auth/register", authH.Register)
	r.Post("/api/auth/verify", authH.Verify)
	r.Get("/api/invites/{token}", inviteH.Get)
	r.Post("/api/invites/{token}/accept", inviteH.Accept)

	r.Group(func(r chi.Router) {
		r.Use(appMW.Auth)
		r.Get("/api/dashboard", timeH.Dashboard)
		r.Get("/api/time-entries", timeH.List)
		r.Get("/api/time-entries/active", timeH.GetActive)
		r.Post("/api/time-entries", timeH.Start)
		r.Post("/api/time-entries/manual", timeH.CreateManual)
		r.Post("/api/time-entries/{id}/stop", timeH.Stop)
		r.Delete("/api/time-entries/{id}", timeH.Delete)
		r.Get("/api/projects", projectH.List)
		r.Get("/api/projects/{id}", projectH.Get)
		r.Get("/api/team/members", memberH.List)
		r.Patch("/api/users/me", userH.UpdateProfile)
		r.Patch("/api/users/me/password", userH.ChangePassword)
		r.Get("/api/reports", timeH.Report)

		r.Group(func(r chi.Router) {
			r.Use(appMW.RequireAdmin)
			r.Post("/api/invites", inviteH.Create)
			r.Patch("/api/team/members/{id}/role", memberH.UpdateRole)
			r.Delete("/api/team/members/{id}", memberH.Remove)
			r.Post("/api/projects", projectH.Create)
			r.Patch("/api/projects/{id}", projectH.Update)
			r.Delete("/api/projects/{id}", projectH.Archive)
			r.Post("/api/projects/{id}/tasks", projectH.CreateTask)
			r.Patch("/api/tasks/{id}", projectH.UpdateTask)
			r.Delete("/api/tasks/{id}", projectH.ArchiveTask)
		})
	})

	return r, userRepo
}

func makeTestToken(id, email, role, teamID string) string {
	claims := appMW.Claims{
		ID: id, Email: email, Role: role, TeamID: teamID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	tok, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
	return tok
}

func do(t *testing.T, router http.Handler, method, path string, body any, token string) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	return rr
}

func unmarshal(t *testing.T, rr *httptest.ResponseRecorder, v any) {
	t.Helper()
	if err := json.NewDecoder(rr.Body).Decode(v); err != nil {
		t.Fatalf("unmarshal: %v (body: %s)", err, rr.Body.String())
	}
}

// uniqueEmail generates a unique email for each test run
func uniqueEmail(prefix string) string {
	return fmt.Sprintf("%s-%d@test.com", prefix, time.Now().UnixNano())
}
