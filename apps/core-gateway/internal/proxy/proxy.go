package proxy

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"

	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/hub"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

// NewLivePreviewHandler creates an HTTP/WebSocket reverse proxy handler mounted at:
// /preview/<project_id>/<node_id>/<port>[/optional/subpath...]
// It tunnels every request directly over a Yamux STREAM_TYPE_PORT_FORWARD stream to 127.0.0.1:<port> on the remote Axon node.
func NewLivePreviewHandler(h *hub.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		trimmed := strings.TrimPrefix(r.URL.Path, "/preview/")
		parts := strings.SplitN(trimmed, "/", 4)
		if len(parts) < 3 {
			http.Error(w, "Invalid Live-Preview path. Expected /preview/<project_id>/<node_id>/<port>[/path]", http.StatusBadRequest)
			return
		}

		projectID := parts[0]
		nodeID := parts[1]
		portStr := parts[2]
		subPath := "/"
		if len(parts) == 4 && parts[3] != "" {
			subPath = "/" + parts[3]
		}

		portNum, err := strconv.ParseUint(portStr, 10, 32)
		if err != nil || portNum == 0 || portNum > 65535 {
			http.Error(w, fmt.Sprintf("Invalid target port %q", portStr), http.StatusBadRequest)
			return
		}

		targetURL, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", portNum))

		rp := &httputil.ReverseProxy{
			Director: func(req *http.Request) {
				req.URL.Scheme = targetURL.Scheme
				req.URL.Host = targetURL.Host
				req.URL.Path = subPath
				req.Host = targetURL.Host
				req.Header.Set("X-Synapse-Project", projectID)
				req.Header.Set("X-Synapse-Node", nodeID)
				req.Header.Set("X-Forwarded-Prefix", fmt.Sprintf("/preview/%s/%s/%d", projectID, nodeID, portNum))
			},
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					stream, _, err := h.OpenStream(nodeID, tunnelv1.StreamHeader{
						StreamType: tunnelv1.StreamTypePortForward,
						ProjectID:  projectID,
						TargetPort: uint32(portNum),
					})
					return stream, err
				},
			},
			ModifyResponse: func(resp *http.Response) error {
				// Allow embedding inside the authenticated Core WebUI Live-Preview iframe
				resp.Header.Del("X-Frame-Options")
				resp.Header.Set("Access-Control-Allow-Origin", "*")
				return nil
			},
			ErrorHandler: func(rw http.ResponseWriter, req *http.Request, proxyErr error) {
				rw.Header().Set("Content-Type", "text/html; charset=utf-8")
				rw.WriteHeader(http.StatusBadGateway)
				_, _ = fmt.Fprintf(rw, `<!DOCTYPE html>
<html>
<head><style>body{background:#090a0f;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.card{border:1px solid #334155;background:#0f172a;padding:24px;border-radius:12px;max-width:520px}h2{color:#f87171;margin-top:0}code{color:#34d399;background:#1e293b;padding:2px 6px;border-radius:4px}</style></head>
<body><div class="card">
<h2>Synapse Live-Preview Tunnel Unavailable</h2>
<p>Could not reach <code>127.0.0.1:%d</code> on Axon Node <code>%s</code> (Project <code>%s</code>).</p>
<p style="font-size:13px;color:#94a3b8">Details: %v</p>
</div></body></html>`, portNum, nodeID, projectID, proxyErr)
			},
		}

		rp.ServeHTTP(w, r)
	}
}
