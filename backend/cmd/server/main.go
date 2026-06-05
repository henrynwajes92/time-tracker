package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"

	"github.com/henryu/time-tracker/backend/internal/handler"
	appMiddleware "github.com/henryu/time-tracker/backend/internal/middleware"
	"github.com/henryu/time-tracker/backend/internal/repository"
	"github.com/henryu/time-tracker/backend/internal/service"
)

func main() {
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	db, err := repository.Connect()
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	// Repositories
	userRepo := repository.NewUserRepository(db)
	inviteRepo := repository.NewInviteRepository(db)
	memberRepo := repository.NewMemberRepository(db)

	// Services
	authSvc := service.NewAuthService(userRepo)
	inviteSvc := service.NewInviteService(inviteRepo, memberRepo, userRepo)
	memberSvc := service.NewMemberService(memberRepo)
	userSvc := service.NewUserService(userRepo)

	// Handlers
	authHandler := handler.NewAuthHandler(authSvc)
	inviteHandler := handler.NewInviteHandler(inviteSvc)
	memberHandler := handler.NewMemberHandler(memberSvc)
	userHandler := handler.NewUserHandler(userSvc)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(appMiddleware.CORS)

	r.Get("/health", handler.Health)

	// Public auth routes
	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/verify", authHandler.Verify)
		r.Post("/register", authHandler.Register)
	})

	// Public invite routes
	r.Get("/api/invites/{token}", inviteHandler.Get)
	r.Post("/api/invites/{token}/accept", inviteHandler.Accept)

	// Protected routes (JWT required)
	r.Group(func(r chi.Router) {
		r.Use(appMiddleware.Auth)

		// User profile
		r.Patch("/api/users/me", userHandler.UpdateProfile)
		r.Patch("/api/users/me/password", userHandler.ChangePassword)

		// Team members
		r.Get("/api/team/members", memberHandler.List)

		// Admin-only routes
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireAdmin)
			r.Post("/api/invites", inviteHandler.Create)
			r.Patch("/api/team/members/{id}/role", memberHandler.UpdateRole)
			r.Delete("/api/team/members/{id}", memberHandler.Remove)
		})
	})

	log.Printf("Go API listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
