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

	userRepo := repository.NewUserRepository(db)
	authSvc := service.NewAuthService(userRepo)
	authHandler := handler.NewAuthHandler(authSvc)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(appMiddleware.CORS)

	r.Get("/health", handler.Health)

	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/verify", authHandler.Verify)
		r.Post("/register", authHandler.Register)
	})

	// Protected routes (JWT required)
	r.Group(func(r chi.Router) {
		r.Use(appMiddleware.Auth)
		// Feature routes added as tasks progress
	})

	log.Printf("Go API listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
