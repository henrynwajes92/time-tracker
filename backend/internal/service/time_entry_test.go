package service_test

import (
	"context"
	"testing"

	"github.com/henryu/time-tracker/backend/internal/service"
)

// nilTimeEntryRepo satisfies enough of TimeEntryService's repo usage for validation tests.
// Validation errors are returned before the repo is ever called.
func newTestTimeEntryService() *service.TimeEntryService {
	return service.NewTimeEntryService(nil)
}

func TestCreateManual_InvalidStartFormat(t *testing.T) {
	svc := newTestTimeEntryService()
	_, err := svc.CreateManual(context.Background(), "u1", "t1", "", "not-a-date", "2026-01-01T10:00:00Z")
	if err == nil {
		t.Error("expected error for invalid startedAt, got nil")
	}
}

func TestCreateManual_InvalidEndFormat(t *testing.T) {
	svc := newTestTimeEntryService()
	_, err := svc.CreateManual(context.Background(), "u1", "t1", "", "2026-01-01T09:00:00Z", "not-a-date")
	if err == nil {
		t.Error("expected error for invalid endedAt, got nil")
	}
}

func TestCreateManual_EndBeforeStart(t *testing.T) {
	svc := newTestTimeEntryService()
	_, err := svc.CreateManual(context.Background(), "u1", "t1", "",
		"2026-01-01T10:00:00Z",
		"2026-01-01T09:00:00Z", // end before start
	)
	if err == nil {
		t.Error("expected error when endedAt is before startedAt, got nil")
	}
}

func TestCreateManual_EqualStartEnd(t *testing.T) {
	svc := newTestTimeEntryService()
	_, err := svc.CreateManual(context.Background(), "u1", "t1", "",
		"2026-01-01T10:00:00Z",
		"2026-01-01T10:00:00Z", // equal — not "after"
	)
	if err == nil {
		t.Error("expected error when endedAt equals startedAt, got nil")
	}
}

func TestMemberService_InvalidRole(t *testing.T) {
	svc := service.NewMemberService(nil)
	err := svc.UpdateRole(context.Background(), "u1", "t1", "SUPERADMIN")
	if err == nil {
		t.Error("expected error for invalid role")
	}
}
