package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/tunnel"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func runAddCore(args []string) {
	fsFlags := flag.NewFlagSet("add-core", flag.ExitOnError)
	coreURL := fsFlags.String("core", "", "Additional Synapse Core Gateway HTTP URL (e.g. http://127.0.0.1:9081)")
	gatewayOverride := fsFlags.String("gateway", "", "Optional explicit mTLS tunnel host:port for this Core (e.g. 127.0.0.1:9443)")
	tokenFlag := fsFlags.String("token", "", "One-time join token from the additional Core")
	profileName := fsFlags.String("profile", "", "Profile name for this additional Core (defaults to host-port slug)")
	nodeID := fsFlags.String("node-id", "", "Node identifier on the additional Core (defaults to existing node_id)")
	tierStr := fsFlags.String("tier", "", "Autonomy tier on the additional Core (defaults to existing tier)")
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Directory containing config.json and mTLS certificates")
	workspaceRoot := fsFlags.String("workspace-root", "/opt/axon/workspaces", "Workspace root directory")
	restartDaemon := fsFlags.Bool("restart", true, "Automatically restart systemd axon.service to activate simultaneous tunnel")
	_ = fsFlags.Bool("multi", true, "Alias flag when delegated from 'axon switch --multi'")
	debugFlag := fsFlags.Bool("debug", false, "Enable verbose debug logging")
	_ = fsFlags.Parse(args)
	enableDebugLogging(*debugFlag)

	remaining := fsFlags.Args()
	token := strings.TrimSpace(*tokenFlag)
	targetCore := strings.TrimSpace(*coreURL)

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

	if token == "" && *profileName != "" && targetCore == "" {
		profDir := filepath.Join(*configDir, "profiles", *profileName)
		rawProf, err := os.ReadFile(filepath.Join(profDir, "config.json"))
		if err != nil {
			log.Fatalf("[axon add-core] saved profile %q not found in %s: %v", *profileName, profDir, err)
		}
		var pCfg tunnel.IdentityConfig
		if err := json.Unmarshal(rawProf, &pCfg); err != nil {
			log.Fatalf("[axon add-core] invalid profile config: %v", err)
		}
		baseCfg, err := tunnel.LoadIdentity(*configDir)
		if err != nil {
			log.Fatalf("[axon add-core] load base config: %v", err)
		}
		target := tunnel.CoreTarget{
			Name:        *profileName,
			NodeID:      pCfg.NodeID,
			CoreGateway: pCfg.CoreGateway,
			CoreHTTP:    pCfg.CoreHTTP,
			Tier:        pCfg.Tier,
			CertFile:    filepath.Join(profDir, "node.crt"),
			KeyFile:     filepath.Join(profDir, "node.key"),
			CACertFile:  filepath.Join(profDir, "ca.crt"),
			Enabled:     true,
		}
		if *gatewayOverride != "" {
			target.CoreGateway = *gatewayOverride
		}
		baseCfg.MultiCore = true
		updated := false
		for i := range baseCfg.Cores {
			if baseCfg.Cores[i].Name == target.Name || baseCfg.Cores[i].CoreGateway == target.CoreGateway {
				baseCfg.Cores[i] = target
				updated = true
				break
			}
		}
		if !updated {
			baseCfg.Cores = append(baseCfg.Cores, target)
		}
		b, _ := json.MarshalIndent(baseCfg, "", "  ")
		_ = os.WriteFile(filepath.Join(*configDir, "config.json"), b, 0o600)
		fmt.Printf("[axon add-core] ✔ Attached saved profile %q (%s) for simultaneous Multi-Core operation (total active cores: %d)\n",
			target.Name, target.CoreGateway, len(baseCfg.ActiveCoreTargets()))
	} else {
		if targetCore == "" || token == "" {
			log.Fatalf("Usage:\n  axon add-core --core http://<CORE_HOST>:<PORT> --token <JOIN_TOKEN> [--gateway <HOST:PORT>] [--profile <name>]\n  axon add-core --profile <saved-profile-name>")
		}
		prof := strings.TrimSpace(*profileName)
		if prof == "" {
			prof = sanitizeProfileSlug(targetCore)
		}
		fmt.Printf("[axon add-core] Bootstrapping simultaneous Core connection to %s (profile=%s)...\n", targetCore, prof)
		cfg, target, err := tunnel.AddSecondaryCore(*configDir, prof, targetCore, token, *nodeID, tunnelv1.AutonomyTier(*tierStr), *workspaceRoot, *gatewayOverride)
		if err != nil {
			log.Fatalf("[axon add-core] failed: %v", err)
		}
		fmt.Printf("[axon add-core] ✔ Enrolled simultaneous Core %q -> %s (node=%s, tier=%s)\n",
			target.Name, target.CoreGateway, target.NodeID, target.Tier)
		fmt.Printf("[axon add-core] ✔ Multi-Core active targets (%d):\n", len(cfg.ActiveCoreTargets()))
		for _, t := range cfg.ActiveCoreTargets() {
			fmt.Printf("  • %-20s -> Tunnel: %-20s | HTTP: %-26s | Node: %s (%s)\n",
				t.Name, t.CoreGateway, t.CoreHTTP, t.NodeID, t.Tier)
		}
	}

	if *restartDaemon && runtime.GOOS == "linux" {
		if _, err := os.Stat("/run/systemd/system"); err == nil {
			unitName := "axon.service"
			if strings.Contains(*configDir, "axon-db") {
				unitName = "axon-db.service"
			}
			if err := exec.Command("systemctl", "restart", unitName).Run(); err == nil {
				fmt.Printf("[axon add-core] ✔ Restarted systemd %s — Muscle is now connected to all configured Cores simultaneously.\n", unitName)
				return
			}
		}
	}
}

func runRemoveCore(args []string) {
	fsFlags := flag.NewFlagSet("remove-core", flag.ExitOnError)
	profileName := fsFlags.String("profile", "", "Profile name or Core gateway host:port to detach")
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Directory containing config.json")
	restartDaemon := fsFlags.Bool("restart", true, "Automatically restart systemd axon.service")
	_ = fsFlags.Parse(args)

	targetKey := strings.TrimSpace(*profileName)
	if targetKey == "" && len(fsFlags.Args()) > 0 {
		targetKey = fsFlags.Args()[0]
	}
	if targetKey == "" {
		log.Fatalf("Usage: axon remove-core --profile <name-or-host:port>")
	}

	cfg, err := tunnel.LoadIdentity(*configDir)
	if err != nil {
		log.Fatalf("[axon remove-core] load config: %v", err)
	}
	filtered := make([]tunnel.CoreTarget, 0, len(cfg.Cores))
	removed := false
	for _, c := range cfg.Cores {
		if c.Name == targetKey || c.CoreGateway == targetKey || c.CoreHTTP == targetKey {
			removed = true
			continue
		}
		filtered = append(filtered, c)
	}
	if !removed {
		log.Fatalf("[axon remove-core] no secondary Core matching %q found in %s/config.json", targetKey, *configDir)
	}
	cfg.Cores = filtered
	cfg.MultiCore = len(cfg.Cores) > 0
	b, _ := json.MarshalIndent(cfg, "", "  ")
	_ = os.WriteFile(filepath.Join(*configDir, "config.json"), b, 0o600)
	fmt.Printf("[axon remove-core] ✔ Detached secondary Core %q (remaining active cores: %d)\n", targetKey, len(cfg.ActiveCoreTargets()))

	if *restartDaemon && runtime.GOOS == "linux" {
		if _, err := os.Stat("/run/systemd/system"); err == nil {
			_ = exec.Command("systemctl", "restart", "axon.service").Run()
		}
	}
}

func runSwitchCore(args []string) {
	fsFlags := flag.NewFlagSet("switch", flag.ExitOnError)
	coreURL := fsFlags.String("core", "", "New Synapse Core Gateway HTTP URL (e.g. http://10.0.0.5:8081)")
	gatewayOverride := fsFlags.String("gateway", "", "Optional explicit Core mTLS tunnel host:port override")
	tokenFlag := fsFlags.String("token", "", "One-time join token from the target Core")
	profileName := fsFlags.String("profile", "", "Profile name to save or activate")
	nodeID := fsFlags.String("node-id", "", "Explicit node identifier (defaults to existing node ID or hostname)")
	tierStr := fsFlags.String("tier", string(tunnelv1.Tier2WorkspaceJail), "Autonomy tier (TIER_1_UNLEASHED, TIER_2_WORKSPACE_JAIL, TIER_3_SUPERVISED)")
	configDir := fsFlags.String("config-dir", defaultConfigDir, "Directory containing config.json and mTLS certificates")
	workspaceRoot := fsFlags.String("workspace-root", "/opt/axon/workspaces", "Workspace root directory")
	addMulti := fsFlags.Bool("multi", false, "Keep existing Core connected and add this Core simultaneously (alias for 'axon add-core')")
	restartDaemon := fsFlags.Bool("restart", true, "Automatically restart systemd axon.service if active")
	runForeground := fsFlags.Bool("run", false, "Immediately run the tunnel in foreground after switching")
	debugFlag := fsFlags.Bool("debug", false, "Enable verbose debug logging")
	_ = fsFlags.Parse(args)
	enableDebugLogging(*debugFlag)

	if *addMulti {
		runAddCore(args)
		return
	}

	remaining := fsFlags.Args()
	token := strings.TrimSpace(*tokenFlag)
	targetCore := strings.TrimSpace(*coreURL)

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

	var existingCores []tunnel.CoreTarget
	var existingMulti bool
	if existingCfg, err := tunnel.LoadIdentity(*configDir); err == nil {
		if *nodeID == "" {
			*nodeID = existingCfg.NodeID
		}
		if *workspaceRoot == "/opt/axon/workspaces" && existingCfg.WorkspaceRoot != "" {
			*workspaceRoot = existingCfg.WorkspaceRoot
		}
		existingCores = existingCfg.Cores
		existingMulti = existingCfg.MultiCore
		saveNamedProfile(*configDir, sanitizeProfileSlug(existingCfg.CoreHTTP), existingCfg)
	}

	var newCfg *tunnel.IdentityConfig
	var err error

	if token == "" && *profileName != "" && targetCore == "" {
		newCfg, err = activateSavedProfile(*configDir, *profileName)
		if err != nil {
			log.Fatalf("[axon switch] failed to activate profile %q: %v", *profileName, err)
		}
		fmt.Printf("[axon switch] ✔ Activated saved Core profile %q -> %s (node=%s, tier=%s)\n",
			*profileName, newCfg.CoreGateway, newCfg.NodeID, newCfg.Tier)
	} else {
		if targetCore == "" {
			targetCore = "http://127.0.0.1:8081"
		}
		if token == "" {
			log.Fatalf("Usage:\n  axon switch --core http://<NEW_CORE_IP>:8081 --token <NEW_JOIN_TOKEN> [--tier TIER_2_WORKSPACE_JAIL]\n  axon add-core --core http://<SECOND_CORE_IP>:8081 --token <JOIN_TOKEN> [--gateway <HOST:PORT>]\n  axon switch --profile <saved-profile-name>")
		}

		fmt.Printf("[axon switch] Enrolling Muscle node with new Core (%s)...\n", targetCore)
		newCfg, err = tunnel.BootstrapCSRWithOptions(*configDir, targetCore, token, *nodeID, tunnelv1.AutonomyTier(*tierStr), *workspaceRoot, *gatewayOverride, true)
		if err != nil {
			log.Fatalf("[axon switch] failed to bind to new Core %s: %v", targetCore, err)
		}
		if len(existingCores) > 0 {
			newCfg.MultiCore = existingMulti
			newCfg.Cores = existingCores
			b, _ := json.MarshalIndent(newCfg, "", "  ")
			_ = os.WriteFile(filepath.Join(*configDir, "config.json"), b, 0o600)
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

	if cur, err := tunnel.LoadIdentity(*configDir); err == nil {
		targets := cur.ActiveCoreTargets()
		fmt.Printf("Multi-Core Simultaneous Mode: %v (%d active Core tunnel(s))\n", len(targets) > 1 || cur.MultiCore, len(targets))
		for idx, t := range targets {
			fmt.Printf("  [%d] %-20s -> Tunnel: %-20s | HTTP: %-26s | Node: %s (%s)\n",
				idx+1, t.Name, t.CoreGateway, t.CoreHTTP, t.NodeID, t.Tier)
		}
		fmt.Println()
	} else {
		fmt.Printf("Active Core Binding: none (%v)\n\n", err)
	}

	profRoot := filepath.Join(*configDir, "profiles")
	entries, err := os.ReadDir(profRoot)
	if err != nil || len(entries) == 0 {
		fmt.Printf("No saved Core profiles in %s.\n", profRoot)
		return
	}
	fmt.Println("Saved Core Profiles (attach simultaneously via 'axon add-core --profile <name>' or switch via 'axon switch --profile <name>'):")
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
