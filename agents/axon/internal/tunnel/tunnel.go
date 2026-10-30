package tunnel

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/fs"
	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/guard"
	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/health"
	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/pty"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/hashicorp/yamux"
)

// Agent orchestrates the outbound mTLS + Yamux reverse tunnel(s) and all 4 logical stream types.
type Agent struct {
	Config           *IdentityConfig
	FsEngine         *fs.Engine
	PtyMgr           *pty.Manager
	HealthCol        *health.Collector
	connectedMu      sync.RWMutex
	connectedTargets map[string]bool
}

// NewAgent initializes an Axon Agent with its Guardrail, PTY, FS, and Telemetry subsystems.
func NewAgent(cfg *IdentityConfig) *Agent {
	host, port, err := net.SplitHostPort(cfg.CoreGateway)
	if err != nil {
		host = cfg.CoreGateway
		port = "8443"
	}
	guardCfg := guard.NewDefaultConfig(host, port)
	return &Agent{
		Config:           cfg,
		FsEngine:         fs.NewEngine(cfg.WorkspaceRoot),
		PtyMgr:           pty.NewManager(cfg.WorkspaceRoot, guardCfg),
		HealthCol:        health.NewCollector(cfg.NodeID, cfg.Tier),
		connectedTargets: make(map[string]bool),
	}
}

func (a *Agent) setTargetConnected(gateway string, connected bool) {
	a.connectedMu.Lock()
	if a.connectedTargets == nil {
		a.connectedTargets = make(map[string]bool)
	}
	a.connectedTargets[gateway] = connected
	a.connectedMu.Unlock()
}

func (a *Agent) isTargetConnected(gateway string) bool {
	a.connectedMu.RLock()
	defer a.connectedMu.RUnlock()
	return a.connectedTargets[gateway]
}

// CoreTelemetrySummary returns the total number of configured active Core targets and a formatted summary slice of each Core's live tunnel state.
func (a *Agent) CoreTelemetrySummary() (int, []string) {
	if a == nil || a.Config == nil {
		return 1, nil
	}
	targets := a.Config.ActiveCoreTargets()
	if len(targets) == 0 {
		return 1, nil
	}
	summaries := make([]string, 0, len(targets))
	for _, t := range targets {
		state := "STANDBY"
		if a.isTargetConnected(t.CoreGateway) {
			state = "LIVE"
		}
		name := strings.TrimSpace(t.Name)
		if name == "" || name == "primary" {
			name = "primary"
			for _, c := range a.Config.Cores {
				if c.CoreGateway == t.CoreGateway && strings.TrimSpace(c.Name) != "" {
					name = c.Name
					break
				}
			}
		}
		summaries = append(summaries, fmt.Sprintf("%s (%s - %s)", name, t.CoreGateway, state))
	}
	return len(targets), summaries
}

// RunForever maintains simultaneous outbound mTLS Yamux connections to all active CoreTargets with automatic backoff reconnection.
func (a *Agent) RunForever(ctx context.Context) error {
	defer a.PtyMgr.CloseAll()

	targets := a.Config.ActiveCoreTargets()
	if len(targets) == 0 {
		return fmt.Errorf("no active Core targets configured")
	}

	if len(targets) == 1 {
		return a.runTargetForever(ctx, targets[0])
	}

	log.Printf("[axon] MULTI-CORE MODE ENABLED: maintaining %d simultaneous mTLS + Yamux tunnels for node %q", len(targets), a.Config.NodeID)
	var wg sync.WaitGroup
	for _, t := range targets {
		target := t
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[axon][%s] recovered panic in target runner: %v", target.Name, r)
				}
			}()
			_ = a.runTargetForever(ctx, target)
		}()
	}
	wg.Wait()
	return ctx.Err()
}

func (a *Agent) runTargetForever(ctx context.Context, target CoreTarget) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if err := a.connectAndServeTarget(ctx, target, a.HealthCol); err != nil {
			log.Printf("[axon][%s -> %s] tunnel disconnected (%v); reconnecting in 2s...", target.Name, target.CoreGateway, err)
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
}

func (a *Agent) connectAndServeTarget(ctx context.Context, target CoreTarget, healthCol *health.Collector) error {
	tlsCfg, err := a.buildTLSConfigForTarget(target)
	if err != nil {
		return fmt.Errorf("build mTLS config for %s (%s): %w", target.Name, target.CoreGateway, err)
	}

	debugLog("[%s] dialing CoreGateway mTLS endpoint %s...", target.Name, target.CoreGateway)
	dialer := &net.Dialer{Timeout: 8 * time.Second, KeepAlive: 10 * time.Second}
	rawConn, err := tls.DialWithDialer(dialer, "tcp", target.CoreGateway, tlsCfg)
	if err != nil {
		return fmt.Errorf("mTLS dial %s: %w", target.CoreGateway, err)
	}
	defer rawConn.Close()

	state := rawConn.ConnectionState()
	debugLog("[%s] mTLS 1.3 handshake complete with %s (cipher=%s, serverName=%s)",
		target.Name, target.CoreGateway, tls.CipherSuiteName(state.CipherSuite), state.ServerName)

	ymCfg := yamux.DefaultConfig()
	ymCfg.EnableKeepAlive = true
	ymCfg.KeepAliveInterval = 10 * time.Second
	ymCfg.ConnectionWriteTimeout = 10 * time.Second

	session, err := yamux.Server(rawConn, ymCfg)
	if err != nil {
		return fmt.Errorf("create yamux server session: %w", err)
	}
	defer session.Close()

	stopCh := make(chan struct{})
	defer close(stopCh)
	go func() {
		select {
		case <-ctx.Done():
			_ = session.Close()
		case <-stopCh:
		}
	}()

	log.Printf("[axon][%s] mTLS + Yamux Reverse Tunnel established with %s (node=%s, tier=%s, debug=%v)",
		target.Name, target.CoreGateway, target.NodeID, target.Tier, DebugEnabled)

	a.setTargetConnected(target.CoreGateway, true)
	defer a.setTargetConnected(target.CoreGateway, false)

	hbCtx, cancelHb := context.WithCancel(ctx)
	defer cancelHb()
	go a.telemetryLoopForTarget(hbCtx, session, target, healthCol)

	for {
		stream, err := session.AcceptStream()
		if err != nil {
			return fmt.Errorf("yamux accept stream: %w", err)
		}
		go a.handleStreamForTarget(stream, target)
	}
}

func (a *Agent) telemetryLoopForTarget(ctx context.Context, session *yamux.Session, target CoreTarget, healthCol *health.Collector) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[axon][%s] recovered panic in telemetry loop: %v", target.Name, r)
		}
	}()
	consecutiveFailures := 0
	for {
		if ctx.Err() != nil || session == nil || session.IsClosed() {
			return
		}
		start := time.Now()
		if err := a.runSingleTelemetryStream(ctx, session, target, healthCol); err != nil {
			if ctx.Err() != nil || session.IsClosed() {
				return
			}
			if time.Since(start) > 15*time.Second {
				consecutiveFailures = 1
			} else {
				consecutiveFailures++
			}
			if consecutiveFailures >= 2 {
				log.Printf("[axon][%s] telemetry stream failed %d times consecutively (%v); closing yamux session to trigger clean mTLS reconnect", target.Name, consecutiveFailures, err)
				_ = session.Close()
				return
			}
			debugLog("[%s] telemetry stream interrupted (%v); reopening in 2s...", target.Name, err)
		} else {
			consecutiveFailures = 0
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(2 * time.Second):
		}
	}
}

func (a *Agent) runSingleTelemetryStream(ctx context.Context, session *yamux.Session, target CoreTarget, healthCol *health.Collector) error {
	stream, err := session.OpenStream()
	if err != nil {
		log.Printf("[axon][%s] failed to open telemetry stream to %s: %v", target.Name, target.CoreGateway, err)
		return err
	}
	defer stream.Close()

	hdr := tunnelv1.StreamHeader{
		StreamType: tunnelv1.StreamTypeTelemetry,
	}
	_ = stream.SetWriteDeadline(time.Now().Add(10 * time.Second))
	if err := tunnelv1.WriteFrame(stream, hdr); err != nil {
		return err
	}
	_ = stream.SetWriteDeadline(time.Time{})
	debugLog("[%s] StreamTypeTelemetry opened to Core Gateway %s", target.Name, target.CoreGateway)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[axon][%s] recovered panic in health target listener: %v", target.Name, r)
			}
		}()
		for {
			var targets []tunnelv1.ServiceHealthTarget
			if err := tunnelv1.ReadFrame(stream, &targets); err != nil {
				return
			}
			debugLog("[%s] received %d ServiceHealthTarget(s) from Core Gateway %s", target.Name, len(targets), target.CoreGateway)
			healthCol.SetTargetsForSource(target.Name, targets)
		}
	}()

	sendBeat := func() error {
		hb := healthCol.CollectForNode(target.NodeID, target.Tier, a.PtyMgr.ActiveSessionIDs(), a.PtyMgr.ActiveSessionMeta())
		hb.ActiveCores, hb.ConnectedCores = a.CoreTelemetrySummary()
		debugLog("[%s -> %s] sending telemetry heartbeat: cpu=%.1f%% ram=%.1f%% disk=%.1f%% services=%d ptySessions=%d",
			target.Name, target.CoreGateway, hb.CPUPercent, hb.RAMPercent, hb.DiskPercent, len(hb.Services), len(hb.ActivePtySessions))
		_ = stream.SetWriteDeadline(time.Now().Add(10 * time.Second))
		err := tunnelv1.WriteFrame(stream, hb)
		_ = stream.SetWriteDeadline(time.Time{})
		return err
	}
	if err := sendBeat(); err != nil {
		return err
	}

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if err := sendBeat(); err != nil {
				return err
			}
		}
	}
}

func (a *Agent) handleStreamForTarget(stream net.Conn, target CoreTarget) {
	defer stream.Close()
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[axon][%s] recovered panic in stream handler: %v", target.Name, r)
		}
	}()

	_ = stream.SetReadDeadline(time.Now().Add(10 * time.Second))
	var hdr tunnelv1.StreamHeader
	if err := tunnelv1.ReadFrame(stream, &hdr); err != nil {
		return
	}
	_ = stream.SetReadDeadline(time.Time{})
	debugLog("[%s] accepted Yamux stream: type=%v project=%s session=%s targetPort=%d",
		target.Name, hdr.StreamType, hdr.ProjectID, hdr.SessionID, hdr.TargetPort)

	switch hdr.StreamType {
	case tunnelv1.StreamTypeRpcFs:
		a.handleFsStream(stream, target.Tier)
	case tunnelv1.StreamTypePty:
		a.handlePtyStream(stream, hdr, target.Tier)
	case tunnelv1.StreamTypePortForward:
		a.handlePortForwardStream(stream, hdr.TargetPort)
	default:
		log.Printf("[axon][%s] unknown stream type %v", target.Name, hdr.StreamType)
	}
}

// Stream Type 1: RPC Control & Atomic Filesystem Ops
func (a *Agent) handleFsStream(stream net.Conn, defaultTier tunnelv1.AutonomyTier) {
	_ = stream.SetDeadline(time.Now().Add(30 * time.Second))
	var req tunnelv1.FsRequest
	if err := tunnelv1.ReadFrame(stream, &req); err != nil {
		return
	}
	if req.Tier == "" || req.Tier == tunnelv1.AutonomyTierUnspecified {
		req.Tier = defaultTier
	}
	if req.Tier == "" || req.Tier == tunnelv1.AutonomyTierUnspecified {
		req.Tier = a.Config.Tier
	}
	start := time.Now()
	resp := a.FsEngine.Execute(req)
	debugLog("FS RPC op=%s path=%q tier=%s -> success=%v err=%q (%s)",
		req.Operation, req.Path, req.Tier, resp.Success, resp.Error, time.Since(start).Round(time.Microsecond))
	_ = tunnelv1.WriteFrame(stream, resp)
}

// Stream Type 2: Persistent Stateful PTY Sessions
func (a *Agent) handlePtyStream(stream net.Conn, hdr tunnelv1.StreamHeader, defaultTier tunnelv1.AutonomyTier) {
	effectiveTier := defaultTier
	if effectiveTier == "" || effectiveTier == tunnelv1.AutonomyTierUnspecified {
		effectiveTier = a.Config.Tier
	}

	if strings.HasPrefix(hdr.SessionID, "input:") {
		actualSessionID := strings.TrimPrefix(hdr.SessionID, "input:")
		sess, err := a.PtyMgr.GetOrCreateSession(actualSessionID, hdr.ProjectID, effectiveTier)
		if err != nil {
			return
		}
		_ = stream.SetReadDeadline(time.Now().Add(5 * time.Second))
		var inFrame tunnelv1.PtyLiveFrame
		if err := tunnelv1.ReadFrame(stream, &inFrame); err == nil {
			switch inFrame.Type {
			case "input":
				_ = sess.WriteInteractive(inFrame.Data)
			case "resize":
				_ = sess.Resize(inFrame.Cols, inFrame.Rows)
			}
		}
		return
	}

	if strings.HasPrefix(hdr.SessionID, "live:") {
		actualSessionID := strings.TrimPrefix(hdr.SessionID, "live:")
		debugLog("attaching live PTY stream for session=%s project=%s", actualSessionID, hdr.ProjectID)
		sess, err := a.PtyMgr.GetOrCreateSession(actualSessionID, hdr.ProjectID, effectiveTier)
		if err != nil {
			debugLog("failed to get/create live PTY session %s: %v", actualSessionID, err)
			return
		}
		liveCh, unsubscribe := sess.SubscribeLive()
		defer unsubscribe()

		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			for chunk := range liveCh {
				frame := tunnelv1.PtyLiveFrame{
					SessionID: sess.ID,
					Type:      "data",
					Data:      chunk,
				}
				_ = stream.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if err := tunnelv1.WriteFrame(stream, frame); err != nil {
					return
				}
				_ = stream.SetWriteDeadline(time.Time{})
			}
		}()

		for {
			var inFrame tunnelv1.PtyLiveFrame
			if err := tunnelv1.ReadFrame(stream, &inFrame); err != nil {
				break
			}
			switch inFrame.Type {
			case "input":
				_ = sess.WriteInteractive(inFrame.Data)
			case "resize":
				_ = sess.Resize(inFrame.Cols, inFrame.Rows)
			}
		}
		_ = stream.Close()
		wg.Wait()
		return
	}

	_ = stream.SetReadDeadline(time.Now().Add(15 * time.Second))
	var req tunnelv1.PtyExecRequest
	if err := tunnelv1.ReadFrame(stream, &req); err != nil {
		return
	}
	_ = stream.SetReadDeadline(time.Time{})
	if req.Tier == "" || req.Tier == tunnelv1.AutonomyTierUnspecified {
		req.Tier = effectiveTier
	}
	start := time.Now()
	debugLog("PTY EXEC start: session=%s cmd=%q timeoutMs=%d", req.SessionID, req.Command, req.WaitTimeoutMs)
	resp := a.PtyMgr.Execute(req)
	debugLog("PTY EXEC done: session=%s exitCode=%d cwd=%q blocked=%v (%s)",
		req.SessionID, resp.ExitCode, resp.Cwd, resp.BlockedByGuardrail, time.Since(start).Round(time.Millisecond))
	_ = stream.SetWriteDeadline(time.Now().Add(30 * time.Second))
	_ = tunnelv1.WriteFrame(stream, resp)
}

// Stream Type 3: Live TCP/HTTP Port-Forwarding
func (a *Agent) handlePortForwardStream(stream net.Conn, targetPort uint32) {
	if targetPort == 0 || targetPort > 65535 {
		return
	}
	localAddr := fmt.Sprintf("127.0.0.1:%d", targetPort)
	debugLog("PortForward dialing local loopback %s", localAddr)
	targetConn, err := net.DialTimeout("tcp", localAddr, 3*time.Second)
	if err != nil {
		debugLog("PortForward dial %s failed: %v", localAddr, err)
		return
	}
	defer targetConn.Close()

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		_, _ = io.Copy(targetConn, stream)
		if tcpConn, ok := targetConn.(*net.TCPConn); ok {
			_ = tcpConn.CloseWrite()
		}
	}()
	go func() {
		defer wg.Done()
		_, _ = io.Copy(stream, targetConn)
		_ = stream.Close()
	}()
	wg.Wait()
}

