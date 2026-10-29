package proxy

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/hub"
)

func TestLivePreviewHandlerValidationAndErrorModes(t *testing.T) {
	h := hub.NewHub(t.TempDir())
	handler := NewLivePreviewHandler(h)

	// 1. Invalid path with too few segments
	reqShort := httptest.NewRequest(http.MethodGet, "/preview/only-two/segments", nil)
	recShort := httptest.NewRecorder()
	handler.ServeHTTP(recShort, reqShort)
	if recShort.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for short path, got %d", recShort.Code)
	}

	// 2. Invalid port number
	reqBadPort := httptest.NewRequest(http.MethodGet, "/preview/proj-1/node-1/99999/health", nil)
	recBadPort := httptest.NewRecorder()
	handler.ServeHTTP(recBadPort, reqBadPort)
	if recBadPort.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for invalid port, got %d", recBadPort.Code)
	}

	// 3. Offline node with JSON Accept header -> structured JSON 502 Bad Gateway
	reqJSON := httptest.NewRequest(http.MethodGet, "/preview/proj-1/offline-node/4050/api/status", nil)
	reqJSON.Header.Set("Accept", "application/json")
	recJSON := httptest.NewRecorder()
	handler.ServeHTTP(recJSON, reqJSON)
	if recJSON.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 Bad Gateway for offline node JSON request, got %d", recJSON.Code)
	}
	if !strings.Contains(recJSON.Header().Get("Content-Type"), "application/json") {
		t.Fatalf("expected application/json error response, got %q", recJSON.Header().Get("Content-Type"))
	}

	// 4. Offline node with HTML browser GET -> HTML 502 card
	reqHTML := httptest.NewRequest(http.MethodGet, "/preview/proj-1/offline-node/4050/", nil)
	reqHTML.Header.Set("Accept", "text/html")
	recHTML := httptest.NewRecorder()
	handler.ServeHTTP(recHTML, reqHTML)
	if recHTML.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 Bad Gateway for offline node HTML request, got %d", recHTML.Code)
	}
	if !strings.Contains(recHTML.Body.String(), "Synapse Live-Preview Tunnel Unavailable") {
		t.Fatalf("expected HTML fallback card in body")
	}
}
