package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"

	"github.com/henryu/time-tracker/backend/internal/email"
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

	// Run schema migrations
	migrations := []string{
		`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id)`,
		`UPDATE time_entries te SET project_id = t.project_id FROM tasks t WHERE te.task_id = t.id AND te.project_id IS NULL`,
		`ALTER TABLE time_entries ALTER COLUMN task_id DROP NOT NULL`,
	}
	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			log.Fatalf("migration failed: %v", err)
		}
	}
	log.Println("migrations applied")

	// Repositories
	userRepo := repository.NewUserRepository(db)
	inviteRepo := repository.NewInviteRepository(db)
	memberRepo := repository.NewMemberRepository(db)
	projectRepo := repository.NewProjectRepository(db)
	taskRepo := repository.NewTaskRepository(db)
	timeEntryRepo := repository.NewTimeEntryRepository(db)

	// Services
	authSvc := service.NewAuthService(userRepo)
	inviteSvc := service.NewInviteService(inviteRepo, memberRepo, userRepo)
	memberSvc := service.NewMemberService(memberRepo)
	userSvc := service.NewUserService(userRepo)
	projectSvc := service.NewProjectService(projectRepo, taskRepo)
	timeEntrySvc := service.NewTimeEntryService(timeEntryRepo)

	// Handlers
	emailClient := email.New()
	authHandler := handler.NewAuthHandler(authSvc)
	inviteHandler := handler.NewInviteHandler(inviteSvc, emailClient)
	memberHandler := handler.NewMemberHandler(memberSvc)
	userHandler := handler.NewUserHandler(userSvc)
	projectHandler := handler.NewProjectHandler(projectSvc)
	timeEntryHandler := handler.NewTimeEntryHandler(timeEntrySvc)

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

		// Projects & tasks (all authenticated users can read)
		r.Get("/api/projects", projectHandler.List)
		r.Get("/api/projects/{id}", projectHandler.Get)

		// Dashboard & reports
		r.Get("/api/dashboard", timeEntryHandler.Dashboard)
		r.Get("/api/reports", timeEntryHandler.Report)

		// Time entries
		r.Get("/api/time-entries", timeEntryHandler.List)
		r.Get("/api/time-entries/active", timeEntryHandler.GetActive)
		r.Post("/api/time-entries", timeEntryHandler.Start)
		r.Post("/api/time-entries/manual", timeEntryHandler.CreateManual)
		r.Post("/api/time-entries/{id}/stop", timeEntryHandler.Stop)
		r.Patch("/api/time-entries/{id}", timeEntryHandler.Update)
		r.Delete("/api/time-entries/{id}", timeEntryHandler.Delete)

		// Admin-only routes
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireAdmin)
			r.Post("/api/invites", inviteHandler.Create)
			r.Patch("/api/team/members/{id}/role", memberHandler.UpdateRole)
			r.Delete("/api/team/members/{id}", memberHandler.Remove)
			r.Post("/api/projects", projectHandler.Create)
			r.Patch("/api/projects/{id}", projectHandler.Update)
			r.Delete("/api/projects/{id}", projectHandler.Archive)
			r.Post("/api/projects/{id}/tasks", projectHandler.CreateTask)
			r.Patch("/api/tasks/{id}", projectHandler.UpdateTask)
			r.Delete("/api/tasks/{id}", projectHandler.ArchiveTask)
		})
	})

	log.Printf("Go API listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
