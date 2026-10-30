package tunnel

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/fs"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

// CoreTarget represents a Core Control Plane endpoint and mTLS identity that this Muscle connects to.
type CoreTarget struct {
	Name        string                `json:"name"`
	NodeID      string                `json:"node_id,omitempty"`
	CoreGateway string                `json:"core_gateway"` // host:port for mTLS yamux
	CoreHTTP    string                `json:"core_http"`    // http(s)://host:port for bootstrap
	Tier        tunnelv1.AutonomyTier `json:"tier,omitempty"`
	CertFile    string                `json:"cert_file"`
	KeyFile     string                `json:"key_file"`
	CACertFile  string                `json:"ca_cert_file"`
	Enabled     bool                  `json:"enabled"`
}

// IdentityConfig stores the persistent mTLS identity and Core Gateway endpoint(s) for this node.
// When MultiCore is true or Cores is non-empty, Axon maintains simultaneous mTLS + Yamux tunnels
// to the primary Core AND all enabled CoreTargets in Cores concurrently.
type IdentityConfig struct {
	NodeID        string                `json:"node_id"`
	CoreGateway   string                `json:"core_gateway"` // primary host:port for mTLS yamux
	CoreHTTP      string                `json:"core_http"`    // primary http(s)://host:port for bootstrap
	Tier          tunnelv1.AutonomyTier `json:"tier"`
	WorkspaceRoot string                `json:"workspace_root"`
	CertFile      string                `json:"cert_file"`
	KeyFile       string                `json:"key_file"`
	CACertFile    string                `json:"ca_cert_file"`
	Debug         bool                  `json:"debug,omitempty"`
	MultiCore     bool                  `json:"multi_core,omitempty"`
	Cores         []CoreTarget          `json:"cores,omitempty"`
}

// ActiveCoreTargets returns the deduplicated list of all enabled Core targets (Primary + Secondary Cores).
func (cfg *IdentityConfig) ActiveCoreTargets() []CoreTarget {
	if cfg == nil {
		return nil
	}
	seen := make(map[string]bool)
	out := make([]CoreTarget, 0, 1+len(cfg.Cores))

	if strings.TrimSpace(cfg.CoreGateway) != "" {
		primary := CoreTarget{
			Name:        "primary",
			NodeID:      cfg.NodeID,
			CoreGateway: cfg.CoreGateway,
			CoreHTTP:    cfg.CoreHTTP,
			Tier:        cfg.Tier,
			CertFile:    cfg.CertFile,
			KeyFile:     cfg.KeyFile,
			CACertFile:  cfg.CACertFile,
			Enabled:     true,
		}
		seen[primary.CoreGateway] = true
		for _, c := range cfg.Cores {
			if c.CoreGateway == primary.CoreGateway {
				if c.CertFile != "" {
					primary.CertFile = c.CertFile
				}
				if c.KeyFile != "" {
					primary.KeyFile = c.KeyFile
				}
				if c.CACertFile != "" {
					primary.CACertFile = c.CACertFile
				}
				break
			}
		}
		out = append(out, primary)
	}

	for _, c := range cfg.Cores {
		if !c.Enabled || strings.TrimSpace(c.CoreGateway) == "" {
			continue
		}
		if seen[c.CoreGateway] {
			continue
		}
		if strings.TrimSpace(c.NodeID) == "" {
			c.NodeID = cfg.NodeID
		}
		if c.Tier == "" || c.Tier == tunnelv1.AutonomyTierUnspecified {
			c.Tier = cfg.Tier
		}
		seen[c.CoreGateway] = true
		out = append(out, c)
	}
	return out
}

// DebugEnabled controls verbose trace logging across the Axon Muscle agent.
var DebugEnabled = os.Getenv("SYNAPSE_DEBUG") == "1" || strings.EqualFold(os.Getenv("SYNAPSE_DEBUG"), "true")

func debugLog(format string, v ...any) {
	if DebugEnabled {
		log.Printf("[axon:DEBUG] "+format, v...)
	}
}

// BootstrapCSR generates an ECDSA P-256 private key + X.509 CSR, exchanges a one-time join token
// with core-gateway for a signed mTLS certificate, and persists the identity to configDir.
func BootstrapCSR(configDir, coreHTTPURL, joinToken, nodeID string, tier tunnelv1.AutonomyTier, workspaceRoot string) (*IdentityConfig, error) {
	return BootstrapCSRWithOptions(configDir, coreHTTPURL, joinToken, nodeID, tier, workspaceRoot, "", true)
}

// BootstrapCSRWithOptions exchanges a one-time join token with core-gateway for a signed mTLS certificate,
// writes node.crt/node.key/ca.crt into targetDir, and optionally writes config.json and overrides the tunnel host:port.
func BootstrapCSRWithOptions(targetDir, coreHTTPURL, joinToken, nodeID string, tier tunnelv1.AutonomyTier, workspaceRoot, gatewayOverride string, writeConfig bool) (*IdentityConfig, error) {
	debugLog("BootstrapCSR starting: targetDir=%s coreHTTPURL=%s nodeID=%s tier=%s workspaceRoot=%s gatewayOverride=%s",
		targetDir, coreHTTPURL, nodeID, tier, workspaceRoot, gatewayOverride)

	if err := os.MkdirAll(targetDir, 0o700); err != nil {
		return nil, fmt.Errorf("create target dir %s: %w", targetDir, err)
	}

	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "axon-node"
	}
	if strings.TrimSpace(nodeID) == "" {
		nodeID = fmt.Sprintf("node-%s-%d", hostname, time.Now().Unix()%10000)
	}
	if tier == "" || tier == tunnelv1.AutonomyTierUnspecified {
		tier = tunnelv1.Tier2WorkspaceJail
	}
	if strings.TrimSpace(workspaceRoot) == "" {
		workspaceRoot = fs.DefaultWorkspaceRoot
	}

	privKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate ecdsa key: %w", err)
	}

	keyBytes, err := x509.MarshalECPrivateKey(privKey)
	if err != nil {
		return nil, fmt.Errorf("marshal private key: %w", err)
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyBytes})

	csrTemplate := &x509.CertificateRequest{
		Subject: pkix.Name{
			CommonName:   nodeID,
			Organization: []string{"Synapse Axon Node"},
		},
		DNSNames: []string{hostname, nodeID},
	}
	csrDER, err := x509.CreateCertificateRequest(rand.Reader, csrTemplate, privKey)
	if err != nil {
		return nil, fmt.Errorf("create CSR: %w", err)
	}
	csrPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csrDER})

	reqBody := tunnelv1.CSRBootstrapRequest{
		JoinToken: joinToken,
		NodeID:    nodeID,
		Hostname:  hostname,
		CSRPerm:   csrPEM,
		Tier:      tier,
	}
	rawReq, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	endpoint := strings.TrimRight(coreHTTPURL, "/") + "/api/v1/bootstrap/csr"
	debugLog("POST %s (CSR bytes=%d)", endpoint, len(csrPEM))

	httpCli := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}
	resp, err := httpCli.Post(endpoint, "application/json", bytes.NewReader(rawReq))
	if err != nil {
		return nil, fmt.Errorf("CSR bootstrap request to %s failed: %w", endpoint, err)
	}
	defer resp.Body.Close()

	var bootResp tunnelv1.CSRBootstrapResponse
	if err := json.NewDecoder(resp.Body).Decode(&bootResp); err != nil {
		return nil, fmt.Errorf("decode CSR bootstrap response: %w", err)
	}
	if !bootResp.Success {
		return nil, fmt.Errorf("CSR bootstrap rejected by Core Gateway: %s", bootResp.Error)
	}
	debugLog("CSR signed successfully: nodeID=%s tunnelPort=%d certBytes=%d",
		bootResp.NodeID, bootResp.TunnelPort, len(bootResp.CertPEM))

	certPath := filepath.Join(targetDir, "node.crt")
	keyPath := filepath.Join(targetDir, "node.key")
	caPath := filepath.Join(targetDir, "ca.crt")

	if err := os.WriteFile(certPath, bootResp.CertPEM, 0o600); err != nil {
		return nil, err
	}
	if err := os.WriteFile(keyPath, keyPEM, 0o600); err != nil {
		return nil, err
	}
	if err := os.WriteFile(caPath, bootResp.CACertPEM, 0o600); err != nil {
		return nil, err
	}

	hostPort := strings.TrimPrefix(strings.TrimPrefix(coreHTTPURL, "https://"), "http://")
	hostOnly := hostPort
	httpPort := 8081
	if h, pStr, splitErr := net.SplitHostPort(hostPort); splitErr == nil {
		hostOnly = h
		if parsedP, pErr := strconv.Atoi(pStr); pErr == nil && parsedP > 0 {
			httpPort = parsedP
		}
	}
	tunnelPort := bootResp.TunnelPort
	if tunnelPort == 0 {
		tunnelPort = 8443
	}

	resolvedGateway := fmt.Sprintf("%s:%d", hostOnly, tunnelPort)
	if strings.TrimSpace(gatewayOverride) != "" {
		resolvedGateway = strings.TrimSpace(gatewayOverride)
		if !strings.Contains(resolvedGateway, ":") {
			resolvedGateway = fmt.Sprintf("%s:%s", hostOnly, resolvedGateway)
		}
	} else if httpPort != 8081 && tunnelPort == 8443 {
		candidatePort := httpPort + (8443 - 8081)
		if candidatePort > 0 && candidatePort <= 65535 {
			candidateAddr := fmt.Sprintf("%s:%d", hostOnly, candidatePort)
			if c, dialErr := net.DialTimeout("tcp", candidateAddr, 500*time.Millisecond); dialErr == nil {
				_ = c.Close()
				resolvedGateway = candidateAddr
			}
		}
	}

	idCfg := &IdentityConfig{
		NodeID:        bootResp.NodeID,
		CoreGateway:   resolvedGateway,
		CoreHTTP:      coreHTTPURL,
		Tier:          tier,
		WorkspaceRoot: workspaceRoot,
		CertFile:      certPath,
		KeyFile:       keyPath,
		CACertFile:    caPath,
		Debug:         DebugEnabled,
	}

	if writeConfig {
		if err := writeConfigWithBackup(filepath.Join(targetDir, "config.json"), idCfg); err != nil {
			return nil, err
		}
	}

	return idCfg, nil
}

// AddSecondaryCore bootstraps a new Core identity inside `<baseConfigDir>/profiles/<profileName>/`
// WITHOUT overwriting the existing primary Core certificates in `<baseConfigDir>`, and registers the new
// Core in `config.json` (`multi_core: true`, `cores: [...]`) so Axon connects to all Cores simultaneously.
func AddSecondaryCore(baseConfigDir, profileName, coreHTTPURL, joinToken, nodeID string, tier tunnelv1.AutonomyTier, workspaceRoot, gatewayOverride string) (*IdentityConfig, *CoreTarget, error) {
	if strings.TrimSpace(profileName) == "" {
		profileName = fmt.Sprintf("core-%d", time.Now().Unix()%10000)
	}
	profDir := filepath.Join(baseConfigDir, "profiles", profileName)

	existingCfg, existingErr := LoadIdentity(baseConfigDir)
	if existingErr == nil && existingCfg != nil {
		if strings.TrimSpace(nodeID) == "" {
			nodeID = existingCfg.NodeID
		}
		if tier == "" || tier == tunnelv1.AutonomyTierUnspecified {
			tier = existingCfg.Tier
		}
		if strings.TrimSpace(workspaceRoot) == "" || workspaceRoot == fs.DefaultWorkspaceRoot {
			if existingCfg.WorkspaceRoot != "" {
				workspaceRoot = existingCfg.WorkspaceRoot
			}
		}
	}

	profCfg, err := BootstrapCSRWithOptions(profDir, coreHTTPURL, joinToken, nodeID, tier, workspaceRoot, gatewayOverride, true)
	if err != nil {
		return nil, nil, err
	}

	target := CoreTarget{
		Name:        profileName,
		NodeID:      profCfg.NodeID,
		CoreGateway: profCfg.CoreGateway,
		CoreHTTP:    profCfg.CoreHTTP,
		Tier:        profCfg.Tier,
		CertFile:    profCfg.CertFile,
		KeyFile:     profCfg.KeyFile,
		CACertFile:  profCfg.CACertFile,
		Enabled:     true,
	}

	if existingErr != nil || existingCfg == nil {
		baseCfg := *profCfg
		baseCfg.MultiCore = true
		baseCfg.Cores = []CoreTarget{target}
		if err := writeConfigWithBackup(filepath.Join(baseConfigDir, "config.json"), &baseCfg); err != nil {
			return nil, nil, err
		}
		return &baseCfg, &target, nil
	}

	existingCfg.MultiCore = true
	updated := false
	for i := range existingCfg.Cores {
		if existingCfg.Cores[i].Name == target.Name || existingCfg.Cores[i].CoreGateway == target.CoreGateway {
			existingCfg.Cores[i] = target
			updated = true
			break
		}
	}
	if !updated {
		existingCfg.Cores = append(existingCfg.Cores, target)
	}

	if err := writeConfigWithBackup(filepath.Join(baseConfigDir, "config.json"), existingCfg); err != nil {
		return nil, nil, err
	}

	return existingCfg, &target, nil
}

func writeConfigWithBackup(cfgPath string, cfg *IdentityConfig) error {
	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(cfgPath, b, 0o600); err != nil {
		return err
	}
	_ = os.WriteFile(cfgPath+".bak", b, 0o600)
	return nil
}

// LoadIdentity reads config.json (falling back to config.json.bak on corruption) and reconciles Multi-Core profile certificates.
func LoadIdentity(configDir string) (*IdentityConfig, error) {
	cfgPath := filepath.Join(configDir, "config.json")
	raw, err := os.ReadFile(cfgPath)
	var cfg IdentityConfig
	if err != nil || json.Unmarshal(raw, &cfg) != nil {
		bakRaw, bakErr := os.ReadFile(cfgPath + ".bak")
		if bakErr != nil {
			if err != nil {
				return nil, err
			}
			return nil, fmt.Errorf("invalid config.json and no valid backup in %s", configDir)
		}
		if unmarshalErr := json.Unmarshal(bakRaw, &cfg); unmarshalErr != nil {
			return nil, unmarshalErr
		}
		_ = os.WriteFile(cfgPath, bakRaw, 0o600)
	}
	if cfg.Debug {
		DebugEnabled = true
	}

	for i := range cfg.Cores {
		profDir := filepath.Join(configDir, "profiles", cfg.Cores[i].Name)
		pCert := filepath.Join(profDir, "node.crt")
		pKey := filepath.Join(profDir, "node.key")
		pCA := filepath.Join(profDir, "ca.crt")
		if fileExists(pCert) && fileExists(pKey) && fileExists(pCA) {
			cfg.Cores[i].CertFile = pCert
			cfg.Cores[i].KeyFile = pKey
			cfg.Cores[i].CACertFile = pCA
		}
	}

	if cfg.MultiCore {
		profilesRoot := filepath.Join(configDir, "profiles")
		if entries, err := os.ReadDir(profilesRoot); err == nil {
			for _, entry := range entries {
				if !entry.IsDir() {
					continue
				}
				profName := entry.Name()
				profDir := filepath.Join(profilesRoot, profName)
				pCfgPath := filepath.Join(profDir, "config.json")
				pCert := filepath.Join(profDir, "node.crt")
				pKey := filepath.Join(profDir, "node.key")
				pCA := filepath.Join(profDir, "ca.crt")
				if !fileExists(pCfgPath) || !fileExists(pCert) || !fileExists(pKey) || !fileExists(pCA) {
					continue
				}
				pRaw, err := os.ReadFile(pCfgPath)
				if err != nil {
					continue
				}
				var pCfg IdentityConfig
				if err := json.Unmarshal(pRaw, &pCfg); err != nil || strings.TrimSpace(pCfg.CoreGateway) == "" {
					continue
				}
				if !strings.HasPrefix(pCfg.CoreGateway, "127.0.0.1:") && !strings.HasPrefix(pCfg.CoreGateway, "localhost:") {
					continue
				}
				alreadyListed := false
				for _, existing := range cfg.Cores {
					if existing.CoreGateway == pCfg.CoreGateway || existing.Name == profName {
						alreadyListed = true
						break
					}
				}
				if !alreadyListed {
					nodeID := pCfg.NodeID
					if nodeID == "" {
						nodeID = cfg.NodeID
					}
					tier := pCfg.Tier
					if tier == "" {
						tier = cfg.Tier
					}
					cfg.Cores = append(cfg.Cores, CoreTarget{
						Name:        profName,
						NodeID:      nodeID,
						CoreGateway: pCfg.CoreGateway,
						CoreHTTP:    pCfg.CoreHTTP,
						Tier:        tier,
						CertFile:    pCert,
						KeyFile:     pKey,
						CACertFile:  pCA,
						Enabled:     true,
					})
				}
			}
		}
	}

	return &cfg, nil
}

func fileExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}
