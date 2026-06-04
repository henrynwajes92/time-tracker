run:
	go run ./cmd/server

build:
	go build -o bin/server ./cmd/server

test:
	go test ./...

lint:
	golangci-lint run

db-up:
	goose -dir ../migrations postgres "$(DATABASE_URL)" up

db-down:
	goose -dir ../migrations postgres "$(DATABASE_URL)" down

db-status:
	goose -dir ../migrations postgres "$(DATABASE_URL)" status
