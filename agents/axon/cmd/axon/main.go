package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"

	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/health"
	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/tunnel"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

const defaultConfigDir = "/etc/axon"

var (
	version = "v0.3.0"
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
	case "switch", "rebind", "connect":
		runSwitchCore(os.Args[2:])
	case "profiles", "list-cores":
		runProfiles(os.Args[2:])
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

func sanitizeProfileSlug(raw string) string {
	u, err := url.Parse(raw)
	host := raw
	if err == nil && u.Host != "" {
		host = u.Host
	}
	cleaned := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			return r
		}
		return '-'
	}, host)
	cleaned = strings.Trim(cleaned, "-")
	if cleaned == "" {
		return "default-core"
	}
	return strings.ToLower(cleaned)
}

func saveNamedProfile(baseConfigDir string, profileName string, cfg *tunnel.IdentityConfig) {
	if profileName == "" {
		profileName = sanitizeProfileSlug(cfg.CoreHTTP)
	}
	profDir := filepath.Join(baseConfigDir, "profiles", profileName)
	_ = os.MkdirAll(profDir, 0o700)

	// Copy cert, key, ca, and config.json into profile directory so user can switch back anytime
	if certBytes, err := os.ReadFile(cfg.CertFile); err == nil {
		_ = os.WriteFile(filepath.Join(profDir, "node.crt"), certBytes, 0o600)
	}
	if keyBytes, err := os.ReadFile(cfg.KeyFile); err == nil {
		_ = os.WriteFile(filepath.Join(profDir, "node.key"), keyBytes, 0o600)
	}
	if caBytes, err := os.ReadFile(cfg.CACertFile); err == nil {
		_ = os.WriteFile(filepath.Join(profDir, "ca.crt"), caBytes, 0o600)
	}
	cfgBytes, _ := json.MarshalIndent(cfg, "", "  ")
	_ = os.WriteFile(filepath.Join(profDir, "config.json"), cfgBytes, 0o600)
}

func activateSavedProfile(baseConfigDir string, profileName string) (*tunnel.IdentityConfig, error) {
	profDir := filepath.Join(baseConfigDir, "profiles", profileName)
	rawCfg, err := os.ReadFile(filepath.Join(profDir, "config.json"))
	if err != nil {
		return nil, fmt.Errorf("saved Core profile %q not found in %s", profileName, profDir)
	}
	var cfg tunnel.IdentityConfig
	if err := json.Unmarshal(rawCfg, &cfg); err != nil {
		return nil, err
	}

	_ = os.MkdirAll(baseConfigDir, 0o700)
	certPath := filepath.Join(baseConfigDir, "node.crt")
	keyPath := filepath.Join(baseConfigDir, "node.key")
	caPath := filepath.Join(baseConfigDir, "ca.crt")

	if b, err := os.ReadFile(filepath.Join(profDir, "node.crt")); err == nil {
		_ = os.WriteFile(certPath, b, 0o600)
	}
	if b, err := os.ReadFile(filepath.Join(profDir, "node.key")); err == nil {
		_ = os.WriteFile(keyPath, b, 0o600)
	}
	if b, err := os.ReadFile(filepath.Join(profDir, "ca.crt")); err == nil {
		_ = os.WriteFile(caPath, b, 0o600)
	}

	cfg.CertFile = certPath
	cfg.KeyFile = keyPath
	cfg.CACertFile = caPath
	updatedBytes, _ := json.MarshalIndent(&cfg, "", "  ")
	if err := os.WriteFile(filepath.Join(baseConfigDir, "config.json"), updatedBytes, 0o600); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func runJoin(args []string) {
	fsFlags := flag.NewFlagSet("join", flag.ExitOnError)
	coreURL := fsFlags.String("core", "http://127.0.0.1:8081", "Synapse Core Gateway HTTP bootstrap endpoint")
	tokenFlag := fsFlags.String("token", "", "One-time join token (can also be passed as positional arg)")
	nodeID := fsFlags.String("node-id", "", "Explicit node identifier (defaults to hostname)")
	tierStr := fsFlags.String("tier", string(tunnelv1.Tier2WorkspaceJail), "Autonomy tier (TIER_1_UNLEASHED, TIER_2_WORKSPACE_JAIL, TIER_3_SUPERVISED)")
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Directory to persist mTLS identity")
	workspaceRoot := fsFlags.String("workspace-root", "/opt/axon/workspaces", "Workspace root directory for TIER_2_WORKSPACE_JAIL")
	profileName := fsFlags.String("profile", "", "Optional profile alias to save this Core identity under")
	autoRun := fsFlags.Bool("run", false, "Immediately start the tunnel daemon after bootstrapping")
	_ = fsFlags.Parse(args)

	token := strings.TrimSpace(*tokenFlag)
	remaining := fsFlags.Args()
	if token == "" && len(remaining) >= 1 {
		token = remaining[0]
	}
	if token == "" {
		log.Fatalf("Usage: axon join --core <http://core-ip:8081> [--token <token>] [flags] [<one-time-token>]")
	}

	cfg, err := tunnel.BootstrapCSR(*configDir, *coreURL, token, *nodeID, tunnelv1.AutonomyTier(*tierStr), *workspaceRoot)
	if err != nil {
		log.Fatalf("[axon join] failed: %v", err)
	}

	saveNamedProfile(*configDir, *profileName, cfg)

	fmt.Printf("Successfully bootstrapped mTLS identity for node %q (tier=%s)\n", cfg.NodeID, cfg.Tier)
	fmt.Printf("Identity stored in %s (Core Tunnel: %s)\n", *configDir, cfg.CoreGateway)

	if *autoRun {
		startAgentLoop(cfg)
	}
}

// runSwitchCore allows the user to rebind an existing Muscle node to a different Core server & token
// directly from the CLI (`axon switch --core http://<NEW_CORE>:8081 --token <NEW_TOKEN>`) or activate a saved profile.
func runSwitchCore(args []string) {
	fsFlags := flag.NewFlagSet("switch", flag.ExitOnError)
	coreURL := fsFlags.String("core", "", "New Synapse Core Gateway HTTP URL (e.g. http://10.0.0.5:8081)")
	tokenFlag := fsFlags.String("token", "", "One-time join token from the target Core")
	profileName := fsFlags.String("profile", "", "Profile name to save or activate")
	nodeID := fsFlags.String("node-id", "", "Explicit node identifier (defaults to existing node ID or hostname)")
	tierStr := fsFlags.String("tier", string(tunnelv1.Tier2WorkspaceJail), "Autonomy tier (TIER_1_UNLEASHED, TIER_2_WORKSPACE_JAIL, TIER_3_SUPERVISED)")
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Directory containing config.json and mTLS certificates")
	workspaceRoot := fsFlags.String("workspace-root", "/opt/axon/workspaces", "Workspace root directory")
	restartDaemon := fsFlags.Bool("restart", true, "Automatically restart systemd axon.service if active")
	runForeground := fsFlags.Bool("run", false, "Immediately run the tunnel in foreground after switching")
	_ = fsFlags.Parse(args)

	remaining := fsFlags.Args()
	token := strings.TrimSpace(*tokenFlag)
	targetCore := strings.TrimSpace(*coreURL)

	// Support positional syntax: `axon switch <CORE_URL> <TOKEN> [TIER]` or `axon switch <TOKEN>`
	for _, arg := range remaining {
		if strings.HasPrefix(arg, "http://") || strings.HasPrefix(arg, "https://") {
			if targetCore == "" {
				targetCore = arg
			}
		} else if arg == string(tunnelv1.Tier1Unleashed) || arg == string(tunnelv1.Tier2WorkspaceJail) || arg == string(tunnelv1.Tier3Supervised) {
			*tierStr = arg
		} else if token == "" {
			token = arg
		}
	}

	// Preserve existing NodeID / WorkspaceRoot if already enrolled previously
	if existingCfg, err := tunnel.LoadIdentity(*configDir); err == nil {
		if *nodeID == "" {
			*nodeID = existingCfg.NodeID
		}
		if *workspaceRoot == "/opt/axon/workspaces" && existingCfg.WorkspaceRoot != "" {
			*workspaceRoot = existingCfg.WorkspaceRoot
		}
		// Save previous identity into profiles before overwriting
		saveNamedProfile(*configDir, sanitizeProfileSlug(existingCfg.CoreHTTP), existingCfg)
	}

	var newCfg *tunnel.IdentityConfig
	var err error

	// Case 1: Switching to an already saved profile without needing a new token (`axon switch --profile prod-core`)
	if token == "" && *profileName != "" && targetCore == "" {
		newCfg, err = activateSavedProfile(*configDir, *profileName)
		if err != nil {
			log.Fatalf("[axon switch] failed to activate profile %q: %v", *profileName, err)
		}
		fmt.Printf("[axon switch] ✔ Activated saved Core profile %q -> %s (node=%s, tier=%s)\n",
			*profileName, newCfg.CoreGateway, newCfg.NodeID, newCfg.Tier)
	} else {
		// Case 2: Bootstrap fresh mTLS identity with the new Core & new Join Token
		if targetCore == "" {
			targetCore = "http://127.0.0.1:8081"
		}
		if token == "" {
			log.Fatalf("Usage:\n  axon switch --core http://<NEW_CORE_IP>:8081 --token <NEW_JOIN_TOKEN> [--tier TIER_2_WORKSPACE_JAIL]\n  axon switch http://<NEW_CORE_IP>:8081 <NEW_JOIN_TOKEN>\n  axon switch --profile <saved-profile-name>")
		}

		fmt.Printf("[axon switch] Enrolling Muscle node with new Core (%s)...\n", targetCore)
		newCfg, err = tunnel.BootstrapCSR(*configDir, targetCore, token, *nodeID, tunnelv1.AutonomyTier(*tierStr), *workspaceRoot)
		if err != nil {
			log.Fatalf("[axon switch] failed to bind to new Core %s: %v", targetCore, err)
		}
		saveNamedProfile(*configDir, *profileName, newCfg)
		fmt.Printf("[axon switch] ✔ Successfully bound Muscle %q to new Core %s (tier=%s)\n",
			newCfg.NodeID, newCfg.CoreGateway, newCfg.Tier)
	}

	if *runForeground {
		startAgentLoop(newCfg)
		return
	}

	if *restartDaemon && runtime.GOOS == "linux" {
		if _, err := os.Stat("/run/systemd/system"); err == nil {
			if err := exec.Command("systemctl", "restart", "axon.service").Run(); err == nil {
				fmt.Println("[axon switch] ✔ Restarted systemd axon.service — mTLS tunnel now connected to new Core.")
				return
			}
		}
	}
	fmt.Printf("[axon switch] Run 'axon run --config-dir %s' to start the tunnel to %s.\n", *configDir, newCfg.CoreGateway)
}

func runProfiles(args []string) {
	fsFlags := flag.NewFlagSet("profiles", flag.ExitOnError)
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Base configuration directory")
	_ = fsFlags.Parse(args)

	activeCore := "none"
	if cur, err := tunnel.LoadIdentity(*configDir); err == nil {
		activeCore = fmt.Sprintf("%s (%s, node=%s, tier=%s)", cur.CoreHTTP, cur.CoreGateway, cur.NodeID, cur.Tier)
	}
	fmt.Printf("Active Core Binding: %s\n\n", activeCore)

	profRoot := filepath.Join(*configDir, "profiles")
	entries, err := os.ReadDir(profRoot)
	if err != nil || len(entries) == 0 {
		fmt.Printf("No saved Core profiles in %s.\n", profRoot)
		return
	}
	fmt.Println("Saved Core Profiles (switch anytime via 'axon switch --profile <name>'):")
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(profRoot, e.Name(), "config.json"))
		if err != nil {
			continue
		}
		var cfg tunnel.IdentityConfig
		if json.Unmarshal(raw, &cfg) == nil {
			fmt.Printf("  • %-22s -> Core: %-26s | Tunnel: %-18s | Node: %s (%s)\n",
				e.Name(), cfg.CoreHTTP, cfg.CoreGateway, cfg.NodeID, cfg.Tier)
		}
	}
}

func runDaemon(args []string) {
	fsFlags := flag.NewFlagSet("run", flag.ExitOnError)
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Directory containing config.json and mTLS certificates")
	coreOverride := fsFlags.String("core", "", "Optional Core HTTP URL to auto-bootstrap before running if --token is also provided")
	tokenOverride := fsFlags.String("token", "", "Optional one-time join token to bind to a new Core on startup")
	tierOverride := fsFlags.String("tier", string(tunnelv1.Tier2WorkspaceJail), "Autonomy tier when bootstrapping via --token")
	nodeIDOverride := fsFlags.String("node-id", "", "Node ID when bootstrapping via --token")
	workspaceRoot := fsFlags.String("workspace-root", "/opt/axon/workspaces", "Workspace root directory")
	_ = fsFlags.Parse(args)

	// Allow one-shot `axon run --core http://<NEW_CORE>:8081 --token <NEW_TOKEN>` directly from the shell!
	if strings.TrimSpace(*tokenOverride) != "" {
		targetCore := strings.TrimSpace(*coreOverride)
		if targetCore == "" {
			targetCore = "http://127.0.0.1:8081"
		}
		cfg, err := tunnel.BootstrapCSR(*configDir, targetCore, strings.TrimSpace(*tokenOverride), *nodeIDOverride, tunnelv1.AutonomyTier(*tierOverride), *workspaceRoot)
		if err != nil {
			log.Fatalf("[axon run] inline bootstrap with %s failed: %v", targetCore, err)
		}
		saveNamedProfile(*configDir, "", cfg)
		startAgentLoop(cfg)
		return
	}

	cfg, err := tunnel.LoadIdentity(*configDir)
	if err != nil {
		log.Fatalf("[axon run] failed to load identity from %s: %v (run 'axon join <token>' or 'axon switch --core <url> --token <token>' first)", *configDir, err)
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
	coreHTTP := "not-configured"

	if cfg, err := tunnel.LoadIdentity(*configDir); err == nil {
		nodeID = cfg.NodeID
		tier = cfg.Tier
		coreEndpoint = cfg.CoreGateway
		coreHTTP = cfg.CoreHTTP
	}

	col := health.NewCollector(nodeID, tier)
	snap := col.Collect(nil)

	report := map[string]any{
		"agent":         fmt.Sprintf("axon %s (%s)", version, commit),
		"pid":           os.Getpid(),
		"core_http":     coreHTTP,
		"core_gateway":  coreEndpoint,
		"config_dir":    *configDir,
		"telemetry":     snap,
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(report)
}

func printUsage() {
	fmt.Println(`Synapse Axon Agent ("The Muscle")
Usage:
  axon join [flags] <token>                  Bootstrap mTLS certificate via one-time CSR token
  axon switch --core <url> --token <token>   Rebind this Muscle to a different Core server & token
  axon switch --profile <name>               Switch back to a previously saved Core profile
  axon profiles                              List active & saved Core server profiles
  axon run [--core <url> --token <token>]    Start outbound mTLS + Yamux reverse tunnel (with optional inline rebind)
  axon status [flags]                        Print local hardware telemetry and mTLS enrollment status
  axon version                               Print agent version`)
}
