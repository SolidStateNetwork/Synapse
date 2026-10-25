package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
	"syscall"

	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/health"
	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/tunnel"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

const defaultConfigDir = "/etc/axon"

var (
	version = "v0.1.0"
	commit  = "HEAD"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	subcmd := os.Args[1]
	switch subcmd {
	case "join":
		runJoin(os.Args[2:])
	case "run":
		runDaemon(os.Args[2:])
	case "status":
		runStatus(os.Args[2:])
	case "version", "--version", "-v":
		fmt.Printf("axon %s (%s) [%s/%s] — Synapse Muscle Single-Binary Agent\n", version, commit, runtime.GOOS, runtime.GOARCH)
	default:
		printUsage()
		os.Exit(1)
	}
}

func runJoin(args []string) {
	fsFlags := flag.NewFlagSet("join", flag.ExitOnError)
	coreURL := fsFlags.String("core", "http://127.0.0.1:8081", "Synapse Core Gateway HTTP bootstrap endpoint")
	nodeID := fsFlags.String("node-id", "", "Explicit node identifier (defaults to hostname)")
	tierStr := fsFlags.String("tier", string(tunnelv1.Tier2WorkspaceJail), "Autonomy tier (TIER_1_UNLEASHED, TIER_2_WORKSPACE_JAIL, TIER_3_SUPERVISED)")
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Directory to persist mTLS identity")
	workspaceRoot := fsFlags.String("workspace-root", "/opt/axon/workspaces", "Workspace root directory for TIER_2_WORKSPACE_JAIL")
	autoRun := fsFlags.Bool("run", false, "Immediately start the tunnel daemon after bootstrapping")
	_ = fsFlags.Parse(args)

	remaining := fsFlags.Args()
	if len(remaining) < 1 {
		log.Fatalf("Usage: axon join [flags] <one-time-token>")
	}
	token := remaining[0]

	cfg, err := tunnel.BootstrapCSR(*configDir, *coreURL, token, *nodeID, tunnelv1.AutonomyTier(*tierStr), *workspaceRoot)
	if err != nil {
		log.Fatalf("[axon join] failed: %v", err)
	}

	fmt.Printf("Successfully bootstrapped mTLS identity for node %q (tier=%s)\n", cfg.NodeID, cfg.Tier)
	fmt.Printf("Identity stored in %s (Core Tunnel: %s)\n", *configDir, cfg.CoreGateway)

	if *autoRun {
		startAgentLoop(cfg)
	}
}

func runDaemon(args []string) {
	fsFlags := flag.NewFlagSet("run", flag.ExitOnError)
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Directory containing config.json and mTLS certificates")
	_ = fsFlags.Parse(args)

	cfg, err := tunnel.LoadIdentity(*configDir)
	if err != nil {
		log.Fatalf("[axon run] failed to load identity from %s: %v (run 'axon join <token>' first)", *configDir, err)
	}

	startAgentLoop(cfg)
}

func startAgentLoop(cfg *tunnel.IdentityConfig) {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	agent := tunnel.NewAgent(cfg)
	log.Printf("[axon] starting agent %q -> %s (tier=%s, pid=%d)", cfg.NodeID, cfg.CoreGateway, cfg.Tier, os.Getpid())
	if err := agent.RunForever(ctx); err != nil && err != context.Canceled {
		log.Fatalf("[axon] fatal error: %v", err)
	}
}

func runStatus(args []string) {
	fsFlags := flag.NewFlagSet("status", flag.ExitOnError)
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Directory containing config.json")
	_ = fsFlags.Parse(args)

	nodeID := "unregistered-local-node"
	tier := tunnelv1.Tier2WorkspaceJail
	coreEndpoint := "not-configured"

	if cfg, err := tunnel.LoadIdentity(*configDir); err == nil {
		nodeID = cfg.NodeID
		tier = cfg.Tier
		coreEndpoint = cfg.CoreGateway
	}

	col := health.NewCollector(nodeID, tier)
	snap := col.Collect(nil)

	report := map[string]any{
		"agent":         fmt.Sprintf("axon %s (%s)", version, commit),
		"pid":           os.Getpid(),
		"core_gateway":  coreEndpoint,
		"telemetry":     snap,
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(report)
}

func printUsage() {
	fmt.Println(`Synapse Axon Agent ("The Muscle")
Usage:
  axon join [flags] <token>   Bootstrap mTLS certificate via one-time CSR token
  axon run [flags]            Establish outbound mTLS + Yamux reverse tunnel to Core Gateway
  axon status [flags]         Print local hardware telemetry and mTLS enrollment status
  axon version                Print agent version`)
}
