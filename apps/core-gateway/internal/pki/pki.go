package pki

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

// JoinTokenEntry represents a one-time CSR bootstrap token.
type JoinTokenEntry struct {
	Token     string                `json:"token"`
	ProjectID string                `json:"project_id"`
	Tier      tunnelv1.AutonomyTier `json:"tier"`
	ExpiresAt time.Time             `json:"expires_at"`
	Used      bool                  `json:"used"`
	UsedBy    string                `json:"used_by,omitempty"`
}

// Authority manages the Synapse Root CA, Server TLS certificate, and One-Time CSR Join Tokens.
type Authority struct {
	DataDir       string
	CACert        *x509.Certificate
	CAKey         *ecdsa.PrivateKey
	CACertPEM     []byte
	ServerCert    tls.Certificate
	ServerCertPEM []byte

	mu     sync.Mutex
	tokens map[string]*JoinTokenEntry
}

// NewAuthority loads or initializes the Root CA and Core Gateway server certificate inside dataDir.
func NewAuthority(dataDir string) (*Authority, error) {
	pkiDir := filepath.Join(dataDir, "pki")
	if err := os.MkdirAll(pkiDir, 0o700); err != nil {
		return nil, fmt.Errorf("create pki dir: %w", err)
	}

	caCertPath := filepath.Join(pkiDir, "ca.crt")
	caKeyPath := filepath.Join(pkiDir, "ca.key")

	var caCert *x509.Certificate
	var caKey *ecdsa.PrivateKey
	var caCertPEM []byte

	if certBytes, err := os.ReadFile(caCertPath); err == nil {
		if keyBytes, errKey := os.ReadFile(caKeyPath); errKey == nil {
			block, _ := pem.Decode(certBytes)
			kblock, _ := pem.Decode(keyBytes)
			if block != nil && kblock != nil {
				caCert, _ = x509.ParseCertificate(block.Bytes)
				caKey, _ = x509.ParseECPrivateKey(kblock.Bytes)
				caCertPEM = certBytes
			}
		}
	}

	if caCert == nil || caKey == nil {
		var err error
		caCert, caKey, caCertPEM, err = generateRootCA(caCertPath, caKeyPath)
		if err != nil {
			return nil, err
		}
	}

	srvCert, srvPEM, err := generateServerCert(caCert, caKey)
	if err != nil {
		return nil, err
	}

	return &Authority{
		DataDir:       dataDir,
		CACert:        caCert,
		CAKey:         caKey,
		CACertPEM:     caCertPEM,
		ServerCert:    srvCert,
		ServerCertPEM: srvPEM,
		tokens:        make(map[string]*JoinTokenEntry),
	}, nil
}

func generateRootCA(certPath, keyPath string) (*x509.Certificate, *ecdsa.PrivateKey, []byte, error) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, nil, err
	}
	serial, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName:   "Synapse Root CA",
			Organization: []string{"Synapse Control Plane"},
		},
		NotBefore:             time.Now().Add(-1 * time.Hour),
		NotAfter:              time.Now().Add(10 * 365 * 24 * time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &priv.PublicKey, priv)
	if err != nil {
		return nil, nil, nil, err
	}
	cert, err := x509.ParseCertificate(der)
	if err != nil {
		return nil, nil, nil, err
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyDER, _ := x509.MarshalECPrivateKey(priv)
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})

	_ = os.WriteFile(certPath, certPEM, 0o600)
	_ = os.WriteFile(keyPath, keyPEM, 0o600)
	return cert, priv, certPEM, nil
}

func generateServerCert(caCert *x509.Certificate, caKey *ecdsa.PrivateKey) (tls.Certificate, []byte, error) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, nil, err
	}
	serial, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName:   "synapse-core-gateway",
			Organization: []string{"Synapse Core Gateway"},
		},
		DNSNames:    []string{"synapse-core-gateway", "core-gateway", "localhost"},
		IPAddresses: []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")},
		NotBefore:   time.Now().Add(-1 * time.Hour),
		NotAfter:    time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:    x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, caCert, &priv.PublicKey, caKey)
	if err != nil {
		return tls.Certificate{}, nil, err
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyDER, _ := x509.MarshalECPrivateKey(priv)
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})

	tlsCert, err := tls.X509KeyPair(certPEM, keyPEM)
	return tlsCert, certPEM, err
}

// CreateJoinToken issues a cryptographically random one-time CSR join token.
func (a *Authority) CreateJoinToken(projectID string, tier tunnelv1.AutonomyTier, ttl time.Duration) *JoinTokenEntry {
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}
	if tier == "" || tier == tunnelv1.AutonomyTierUnspecified {
		tier = tunnelv1.Tier2WorkspaceJail
	}
	raw := make([]byte, 16)
	_, _ = rand.Read(raw)
	tok := "syn_join_" + hex.EncodeToString(raw)

	entry := &JoinTokenEntry{
		Token:     tok,
		ProjectID: projectID,
		Tier:      tier,
		ExpiresAt: time.Now().Add(ttl),
	}

	a.mu.Lock()
	a.tokens[tok] = entry
	a.mu.Unlock()
	return entry
}

// ListTokens returns all issued tokens.
func (a *Authority) ListTokens() []*JoinTokenEntry {
	a.mu.Lock()
	defer a.mu.Unlock()
	out := make([]*JoinTokenEntry, 0, len(a.tokens))
	for _, t := range a.tokens {
		out = append(out, t)
	}
	return out
}

// SignNodeCSR validates the one-time join token and signs the Axon node's X.509 CSR.
func (a *Authority) SignNodeCSR(req tunnelv1.CSRBootstrapRequest) (certPEM []byte, assignedTier tunnelv1.AutonomyTier, projectID string, err error) {
	a.mu.Lock()
	entry, ok := a.tokens[req.JoinToken]
	if !ok {
		a.mu.Unlock()
		return nil, "", "", fmt.Errorf("invalid or unknown join token")
	}
	if entry.Used {
		a.mu.Unlock()
		return nil, "", "", fmt.Errorf("join token has already been consumed by node %q", entry.UsedBy)
	}
	if time.Now().After(entry.ExpiresAt) {
		a.mu.Unlock()
		return nil, "", "", fmt.Errorf("join token expired at %s", entry.ExpiresAt.Format(time.RFC3339))
	}
	entry.Used = true
	entry.UsedBy = req.NodeID
	assignedTier = entry.Tier
	if req.Tier != "" && req.Tier != tunnelv1.AutonomyTierUnspecified {
		assignedTier = req.Tier
	}
	projectID = entry.ProjectID
	a.mu.Unlock()

	block, _ := pem.Decode(req.CSRPerm)
	if block == nil {
		return nil, "", "", fmt.Errorf("invalid CSR PEM payload")
	}
	csr, err := x509.ParseCertificateRequest(block.Bytes)
	if err != nil {
		return nil, "", "", fmt.Errorf("parse CSR: %w", err)
	}
	if err := csr.CheckSignature(); err != nil {
		return nil, "", "", fmt.Errorf("CSR signature verification failed: %w", err)
	}

	serial, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	var localities []string
	if projectID != "" {
		localities = []string{projectID}
	}
	clientTmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName:         req.NodeID,
			Organization:       []string{"Synapse Muscle Node"},
			OrganizationalUnit: []string{string(assignedTier)},
			Locality:           localities,
		},
		DNSNames:    csr.DNSNames,
		NotBefore:   time.Now().Add(-5 * time.Minute),
		NotAfter:    time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:    x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}

	der, err := x509.CreateCertificate(rand.Reader, clientTmpl, a.CACert, csr.PublicKey, a.CAKey)
	if err != nil {
		return nil, "", "", fmt.Errorf("sign client certificate: %w", err)
	}

	certPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	return certPEM, assignedTier, projectID, nil
}

// ServerTLSConfig returns the strict mTLS configuration requiring a valid client certificate signed by the Synapse Root CA.
func (a *Authority) ServerTLSConfig() *tls.Config {
	pool := x509.NewCertPool()
	pool.AppendCertsFromPEM(a.CACertPEM)
	return &tls.Config{
		Certificates: []tls.Certificate{a.ServerCert},
		ClientCAs:    pool,
		ClientAuth:   tls.RequireAndVerifyClientCert,
		MinVersion:   tls.VersionTLS13,
	}
}
