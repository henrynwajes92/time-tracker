//go:build integration

package handler_test

import (
	"net/http"
	"testing"
)

// registerAndGetToken is a helper that registers a new admin user and returns the access token + IDs.
func registerAndGetToken(t *testing.T, r http.Handler, email, password string) (accessToken, userID, teamID string) {
	t.Helper()
	rr := do(t, r, http.MethodPost, "/api/auth/register", map[string]string{
		"name": "Test User", "email": email, "password": password,
	}, "")
	if rr.Code != http.StatusCreated {
		t.Fatalf("register failed: %d %s", rr.Code, rr.Body.String())
	}
	var body map[string]any
	unmarshal(t, rr, &body)
	return body["accessToken"].(string), body["id"].(string), body["teamId"].(string)
}

func TestProjectCreate_AdminOnly(t *testing.T) {
	r, _ := setupRouter(t)

	adminToken, _, teamID := registerAndGetToken(t, r, uniqueEmail("admin"), "password")

	// Create a member token manually with the same teamID
	memberToken := makeTestToken("member-id", "member@test.com", "MEMBER", teamID)

	// Admin can create project
	rr := do(t, r, http.MethodPost, "/api/projects", map[string]string{
		"name": "Test Project",
	}, adminToken)
	if rr.Code != http.StatusCreated {
		t.Errorf("admin: expected 201, got %d: %s", rr.Code, rr.Body.String())
	}

	// Member gets 403
	rr = do(t, r, http.MethodPost, "/api/projects", map[string]string{
		"name": "Member Project",
	}, memberToken)
	if rr.Code != http.StatusForbidden {
		t.Errorf("member: expected 403, got %d", rr.Code)
	}
}

func TestProjectList_AllMembers(t *testing.T) {
	r, _ := setupRouter(t)

	_, _, teamID := registerAndGetToken(t, r, uniqueEmail("admin2"), "password")
	memberToken := makeTestToken("m-id", "m@test.com", "MEMBER", teamID)

	rr := do(t, r, http.MethodGet, "/api/projects", nil, memberToken)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
}

func TestProtectedRoute_NoToken(t *testing.T) {
	r, _ := setupRouter(t)

	endpoints := []struct{ method, path string }{
		{http.MethodGet, "/api/projects"},
		{http.MethodGet, "/api/time-entries"},
		{http.MethodGet, "/api/dashboard"},
		{http.MethodGet, "/api/team/members"},
	}

	for _, ep := range endpoints {
		rr := do(t, r, ep.method, ep.path, nil, "")
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("%s %s: expected 401, got %d", ep.method, ep.path, rr.Code)
		}
	}
}

func TestTimeEntry_StartStop(t *testing.T) {
	r, _ := setupRouter(t)

	adminToken, _, _ := registerAndGetToken(t, r, uniqueEmail("timer"), "password")

	// Create project
	rr := do(t, r, http.MethodPost, "/api/projects", map[string]string{"name": "P1"}, adminToken)
	if rr.Code != http.StatusCreated {
		t.Fatalf("project create: expected 201, got %d: %s", rr.Code, rr.Body.String())
	}
	var project map[string]any
	unmarshal(t, rr, &project)
	projectID := project["id"].(string)

	// Create task
	rr = do(t, r, http.MethodPost, "/api/projects/"+projectID+"/tasks", map[string]string{"name": "T1"}, adminToken)
	if rr.Code != http.StatusCreated {
		t.Fatalf("task create: expected 201, got %d: %s", rr.Code, rr.Body.String())
	}
	var task map[string]any
	unmarshal(t, rr, &task)
	taskID := task["id"].(string)

	// Start timer
	rr = do(t, r, http.MethodPost, "/api/time-entries", map[string]string{
		"taskId": taskID, "description": "working",
	}, adminToken)
	if rr.Code != http.StatusCreated {
		t.Fatalf("start timer: expected 201, got %d: %s", rr.Code, rr.Body.String())
	}
	var entry map[string]any
	unmarshal(t, rr, &entry)
	entryID := entry["id"].(string)

	// Active timer should be returned
	rr = do(t, r, http.MethodGet, "/api/time-entries/active", nil, adminToken)
	if rr.Code != http.StatusOK {
		t.Errorf("active: expected 200, got %d", rr.Code)
	}

	// Duplicate start should 409
	rr = do(t, r, http.MethodPost, "/api/time-entries", map[string]string{"taskId": taskID}, adminToken)
	if rr.Code != http.StatusConflict {
		t.Errorf("duplicate start: expected 409, got %d", rr.Code)
	}

	// Stop timer
	rr = do(t, r, http.MethodPost, "/api/time-entries/"+entryID+"/stop", nil, adminToken)
	if rr.Code != http.StatusOK {
		t.Fatalf("stop: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestTimeEntry_ManualValidation(t *testing.T) {
	r, _ := setupRouter(t)
	token, _, _ := registerAndGetToken(t, r, uniqueEmail("manual"), "password")

	// End before start
	rr := do(t, r, http.MethodPost, "/api/time-entries/manual", map[string]string{
		"taskId":    "fake-task",
		"startedAt": "2026-01-01T10:00:00Z",
		"endedAt":   "2026-01-01T09:00:00Z",
	}, token)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for end-before-start, got %d", rr.Code)
	}
}
