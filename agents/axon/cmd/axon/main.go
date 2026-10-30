package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
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
	version = "v0.7.0"
	commit  = "HEAD"
)

func enableDebugLogging(enable bool) {
	if !enable && !tunnel.DebugEnabled {
		return
	}
	tunnel.DebugEnabled = true
	log.SetFlags(log.LstdFlags | log.Lmicroseconds | log.Lshortfile)
	debugLogPath := filepath.Join(os.TempDir(), "axon-debug.log")
	if f, err := os.OpenFile(debugLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644); err == nil {
		log.SetOutput(io.MultiWriter(os.Stderr, f))
		log.Printf("[axon:DEBUG] Verbose Debug Mode ENABLED (mirroring logs to %s)", debugLogPath)
	} else {
		log.Printf("[axon:DEBUG] Verbose Debug Mode ENABLED (stderr)")
	}
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	filteredArgs := make([]string, 0, len(os.Args))
	for i, arg := range os.Args {
		if i > 0 && (arg == "--debug" || arg == "-d") {
			enableDebugLogging(true)
			continue
		}
		filteredArgs = append(filteredArgs, arg)
	}
	if len(filteredArgs) < 2 {
		printUsage()
		os.Exit(1)
	}

	subcmd := filteredArgs[1]
	switch subcmd {
	case "join":
		runJoin(filteredArgs[2:])
	case "add-core", "join-multi", "add":
		runAddCore(filteredArgs[2:])
	case "remove-core", "rm-core":
		runRemoveCore(filteredArgs[2:])
	case "switch", "rebind", "connect":
		runSwitchCore(filteredArgs[2:])
	case "profiles", "list-cores", "cores":
		runProfiles(filteredArgs[2:])
	case "run":
		runDaemon(filteredArgs[2:])
	case "status":
		runStatus(filteredArgs[2:])
	case "debug", "doctor", "diag":
		runDebugDoctor(filteredArgs[2:])
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

	profCert := filepath.Join(profDir, "node.crt")
	profKey := filepath.Join(profDir, "node.key")
	profCA := filepath.Join(profDir, "ca.crt")

	if certBytes, err := os.ReadFile(cfg.CertFile); err == nil {
		_ = os.WriteFile(profCert, certBytes, 0o600)
	}
	if keyBytes, err := os.ReadFile(cfg.KeyFile); err == nil {
		_ = os.WriteFile(profKey, keyBytes, 0o600)
	}
	if caBytes, err := os.ReadFile(cfg.CACertFile); err == nil {
		_ = os.WriteFile(profCA, caBytes, 0o600)
	}

	profCfg := *cfg
	profCfg.CertFile = profCert
	profCfg.KeyFile = profKey
	profCfg.CACertFile = profCA
	profCfg.Cores = nil
	cfgBytes, _ := json.MarshalIndent(&profCfg, "", "  ")
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

	if existing, err := tunnel.LoadIdentity(baseConfigDir); err == nil && existing != nil {
		cfg.MultiCore = existing.MultiCore || len(existing.Cores) > 0
		cfg.Cores = existing.Cores
		if cfg.MultiCore && existing.CoreGateway != "" && existing.CoreGateway != cfg.CoreGateway {
			prevSlug := sanitizeProfileSlug(existing.CoreHTTP)
			saveNamedProfile(baseConfigDir, prevSlug, existing)
			prevProfDir := filepath.Join(baseConfigDir, "profiles", prevSlug)
			alreadyInCores := false
			for _, c := range cfg.Cores {
				if c.CoreGateway == existing.CoreGateway {
					alreadyInCores = true
					break
				}
			}
			if !alreadyInCores {
				cfg.Cores = append(cfg.Cores, tunnel.CoreTarget{
					Name:        prevSlug,
					NodeID:      existing.NodeID,
					CoreGateway: existing.CoreGateway,
					CoreHTTP:    existing.CoreHTTP,
					Tier:        existing.Tier,
					CertFile:    filepath.Join(prevProfDir, "node.crt"),
					KeyFile:     filepath.Join(prevProfDir, "node.key"),
					CACertFile:  filepath.Join(prevProfDir, "ca.crt"),
					Enabled:     true,
				})
			}
		}
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
	gatewayOverride := fsFlags.String("gateway", "", "Optional explicit Core mTLS tunnel host:port override (e.g. 127.0.0.1:9443)")
	tokenFlag := fsFlags.String("token", "", "One-time join token (can also be passed as positional arg)")
	nodeID := fsFlags.String("node-id", "", "Explicit node identifier (defaults to hostname)")
	tierStr := fsFlags.String("tier", string(tunnelv1.Tier2WorkspaceJail), "Autonomy tier (TIER_1_UNLEASHED, TIER_2_WORKSPACE_JAIL, TIER_3_SUPERVISED)")
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Directory to persist mTLS identity")
	workspaceRoot := fsFlags.String("workspace-root", "/opt/axon/workspaces", "Workspace root directory for TIER_2_WORKSPACE_JAIL")
	profileName := fsFlags.String("profile", "", "Optional profile alias to save this Core identity under")
	addMulti := fsFlags.Bool("add", false, "Add this Core as a simultaneous Multi-Core connection without overwriting the existing primary Core")
	autoRun := fsFlags.Bool("run", false, "Immediately start the tunnel daemon after bootstrapping")
	debugFlag := fsFlags.Bool("debug", false, "Enable verbose debug logging")
	_ = fsFlags.Parse(args)
	enableDebugLogging(*debugFlag)

	token := strings.TrimSpace(*tokenFlag)
	remaining := fsFlags.Args()
	if token == "" && len(remaining) >= 1 {
		token = remaining[0]
	}
	if token == "" {
		log.Fatalf("Usage: axon join --core <http://core-ip:8081> [--token <token>] [--add] [--gateway <host:port>] [<one-time-token>]")
	}

	if *addMulti {
		prof := *profileName
		if prof == "" {
			prof = sanitizeProfileSlug(*coreURL)
		}
		cfg, target, err := tunnel.AddSecondaryCore(*configDir, prof, *coreURL, token, *nodeID, tunnelv1.AutonomyTier(*tierStr), *workspaceRoot, *gatewayOverride)
		if err != nil {
			log.Fatalf("[axon join --add] failed: %v", err)
		}
		fmt.Printf("Successfully added simultaneous Core %q -> %s (node=%s, tier=%s, active_cores=%d)\n",
			target.Name, target.CoreGateway, target.NodeID, target.Tier, len(cfg.ActiveCoreTargets()))
		if *autoRun {
			startAgentLoop(cfg)
		}
		return
	}

	var existingCores []tunnel.CoreTarget
	var existingMulti bool
	if oldCfg, err := tunnel.LoadIdentity(*configDir); err == nil && oldCfg != nil {
		existingCores = oldCfg.Cores
		existingMulti = oldCfg.MultiCore || len(oldCfg.Cores) > 0
		if oldCfg.CoreGateway != "" {
			prevSlug := sanitizeProfileSlug(oldCfg.CoreHTTP)
			saveNamedProfile(*configDir, prevSlug, oldCfg)
			prevProfDir := filepath.Join(*configDir, "profiles", prevSlug)
			alreadyInCores := false
			for _, c := range existingCores {
				if c.CoreGateway == oldCfg.CoreGateway {
					alreadyInCores = true
					break
				}
			}
			if !alreadyInCores {
				existingCores = append(existingCores, tunnel.CoreTarget{
					Name:        prevSlug,
					NodeID:      oldCfg.NodeID,
					CoreGateway: oldCfg.CoreGateway,
					CoreHTTP:    oldCfg.CoreHTTP,
					Tier:        oldCfg.Tier,
					CertFile:    filepath.Join(prevProfDir, "node.crt"),
					KeyFile:     filepath.Join(prevProfDir, "node.key"),
					CACertFile:  filepath.Join(prevProfDir, "ca.crt"),
					Enabled:     true,
				})
			}
		}
	}

	cfg, err := tunnel.BootstrapCSRWithOptions(*configDir, *coreURL, token, *nodeID, tunnelv1.AutonomyTier(*tierStr), *workspaceRoot, *gatewayOverride, true)
	if err != nil {
		log.Fatalf("[axon join] failed: %v", err)
	}
	if len(existingCores) > 0 {
		cfg.MultiCore = existingMulti
		cfg.Cores = existingCores
		b, _ := json.MarshalIndent(cfg, "", "  ")
		_ = os.WriteFile(filepath.Join(*configDir, "config.json"), b, 0o600)
	}

	saveNamedProfile(*configDir, *profileName, cfg)

	fmt.Printf("Successfully bootstrapped mTLS identity for node %q (tier=%s)\n", cfg.NodeID, cfg.Tier)
	fmt.Printf("Identity stored in %s (Core Tunnel: %s)\n", *configDir, cfg.CoreGateway)

	if *autoRun {
		startAgentLoop(cfg)
	}
}

func runDaemon(args []string) {
	fsFlags := flag.NewFlagSet("run", flag.ExitOnError)
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Directory containing config.json and mTLS certificates")
	coreOverride := fsFlags.String("core", "", "Optional Core HTTP URL to auto-bootstrap before running if --token is also provided")
	gatewayOverride := fsFlags.String("gateway", "", "Optional explicit Core mTLS tunnel host:port override")
	tokenOverride := fsFlags.String("token", "", "Optional one-time join token to bind to a new Core on startup")
	tierOverride := fsFlags.String("tier", string(tunnelv1.Tier2WorkspaceJail), "Autonomy tier when bootstrapping via --token")
	nodeIDOverride := fsFlags.String("node-id", "", "Node ID when bootstrapping via --token")
	workspaceRoot := fsFlags.String("workspace-root", "/opt/axon/workspaces", "Workspace root directory")
	debugFlag := fsFlags.Bool("debug", false, "Enable verbose debug logging")
	_ = fsFlags.Parse(args)
	enableDebugLogging(*debugFlag)

	if strings.TrimSpace(*tokenOverride) != "" {
		targetCore := strings.TrimSpace(*coreOverride)
		if targetCore == "" {
			targetCore = "http://127.0.0.1:8081"
		}
		cfg, err := tunnel.BootstrapCSRWithOptions(*configDir, targetCore, strings.TrimSpace(*tokenOverride), *nodeIDOverride, tunnelv1.AutonomyTier(*tierOverride), *workspaceRoot, *gatewayOverride, true)
		if err != nil {
			log.Fatalf("[axon run] inline bootstrap with %s failed: %v", targetCore, err)
		}
		saveNamedProfile(*configDir, "", cfg)
		startAgentLoop(cfg)
		return
	}

	cfg, err := tunnel.LoadIdentity(*configDir)
	if err != nil {
		log.Fatalf("[axon run] failed to load identity from %s: %v (run 'axon join <token>' or 'axon add-core --core <url> --token <token>' first)", *configDir, err)
	}
	if cfg.Debug {
		enableDebugLogging(true)
	}

	startAgentLoop(cfg)
}

func startAgentLoop(cfg *tunnel.IdentityConfig) {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	agent := tunnel.NewAgent(cfg)
	targets := cfg.ActiveCoreTargets()
	log.Printf("[axon] starting agent %q (active_cores=%d, primary=%s, tier=%s, pid=%d, debug=%v)",
		cfg.NodeID, len(targets), cfg.CoreGateway, cfg.Tier, os.Getpid(), tunnel.DebugEnabled)
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
	var activeTargets []tunnel.CoreTarget

	if cfg, err := tunnel.LoadIdentity(*configDir); err == nil {
		nodeID = cfg.NodeID
		tier = cfg.Tier
		coreEndpoint = cfg.CoreGateway
		coreHTTP = cfg.CoreHTTP
		activeTargets = cfg.ActiveCoreTargets()
	}

	col := health.NewCollector(nodeID, tier)
	snap := col.Collect(nil, nil)

	report := map[string]any{
		"agent":        fmt.Sprintf("axon %s (%s)", version, commit),
		"pid":          os.Getpid(),
		"debug_mode":   tunnel.DebugEnabled,
		"core_http":    coreHTTP,
		"core_gateway": coreEndpoint,
		"multi_core":   len(activeTargets) > 1,
		"active_cores": activeTargets,
		"config_dir":   *configDir,
		"telemetry":    snap,
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(report)
}

func runDebugDoctor(args []string) {
	fsFlags := flag.NewFlagSet("debug", flag.ExitOnError)
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Directory containing config.json")
	enablePersist := fsFlags.Bool("enable", false, "Persist debug=true in config.json")
	disablePersist := fsFlags.Bool("disable", false, "Persist debug=false in config.json")
	_ = fsFlags.Parse(args)

	enableDebugLogging(true)

	if *enablePersist || *disablePersist {
		if cfg, err := tunnel.LoadIdentity(*configDir); err == nil {
			cfg.Debug = *enablePersist && !*disablePersist
			b, _ := json.MarshalIndent(cfg, "", "  ")
			_ = os.WriteFile(filepath.Join(*configDir, "config.json"), b, 0o600)
			fmt.Printf("[axon debug] Updated persistent debug=%v in %s/config.json\n", cfg.Debug, *configDir)
		}
	}

	rep := tunnel.RunDiagnostics(*configDir)
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(rep)
}

func printUsage() {
	fmt.Println(`Synapse Axon Agent ("The Muscle")
Usage:
  axon join [--debug] [flags] <token>                     Bootstrap mTLS certificate via one-time CSR token
  axon add-core --core <url> --token <token> [--gateway]  Attach an additional Core simultaneously (Multi-Core Dual/N-Way Homing)
  axon remove-core --profile <name>                       Detach a secondary Core from simultaneous Multi-Core list
  axon switch [--debug] --core <url> --token <token>      Rebind primary Core to a different Core server & token
  axon switch --profile <name>                            Switch primary Core to a previously saved profile
  axon profiles                                           List all active simultaneous Cores & saved profiles
  axon run [--debug] [--core <url> --token <token>]       Start outbound mTLS + Yamux reverse tunnel(s)
  axon debug [--config-dir <dir>] [--enable|--disable]    Run mTLS/HTTP/FS diagnostic doctor across all configured Cores
  axon status [flags]                                     Print local hardware telemetry and Multi-Core enrollment status
  axon version                                            Print agent version`)
}
