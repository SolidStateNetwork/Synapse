package pki

import (
	"crypto/x509"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// RevokedCertEntry records a revoked client certificate serial or node ID in CRL.json.
type RevokedCertEntry struct {
	SerialHex string    `json:"serial_hex,omitempty"`
	NodeID    string    `json:"node_id"`
	Reason    string    `json:"reason"`
	RevokedAt time.Time `json:"revoked_at"`
}

// crlDocument is the persistent JSON structure stored in CRL.json.
type crlDocument struct {
	UpdatedAt time.Time           `json:"updated_at"`
	Entries   []*RevokedCertEntry `json:"entries"`
}

func (a *Authority) crlFilePaths() []string {
	return []string{
		filepath.Join(a.DataDir, "pki", "CRL.json"),
		filepath.Join(a.DataDir, "CRL.json"),
	}
}

func (a *Authority) loadCRL() {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.revokedSerials == nil {
		a.revokedSerials = make(map[string]*RevokedCertEntry)
	}
	if a.revokedNodes == nil {
		a.revokedNodes = make(map[string]*RevokedCertEntry)
	}

	for _, p := range a.crlFilePaths() {
		raw, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		var doc crlDocument
		if err := json.Unmarshal(raw, &doc); err != nil {
			continue
		}
		for _, entry := range doc.Entries {
			if entry == nil {
				continue
			}
			if s := strings.ToLower(strings.TrimSpace(entry.SerialHex)); s != "" {
				a.revokedSerials[s] = entry
			}
			if n := strings.TrimSpace(entry.NodeID); n != "" {
				a.revokedNodes[n] = entry
			}
		}
		return
	}
}

func (a *Authority) saveCRLLocked() error {
	seen := make(map[string]bool)
	entries := make([]*RevokedCertEntry, 0, len(a.revokedSerials)+len(a.revokedNodes))
	for _, e := range a.revokedSerials {
		key := e.SerialHex + "|" + e.NodeID
		if !seen[key] {
			seen[key] = true
			entries = append(entries, e)
		}
	}
	for _, e := range a.revokedNodes {
		key := e.SerialHex + "|" + e.NodeID
		if !seen[key] {
			seen[key] = true
			entries = append(entries, e)
		}
	}

	doc := crlDocument{
		UpdatedAt: time.Now().UTC(),
		Entries:   entries,
	}
	payload, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal CRL: %w", err)
	}
	for _, p := range a.crlFilePaths() {
		if err := os.WriteFile(p, payload, 0o600); err != nil {
			return fmt.Errorf("write CRL %s: %w", p, err)
		}
	}
	return nil
}

// RevokeCertSerial revokes a specific certificate serial number (and optional node ID) and persists CRL.json.
func (a *Authority) RevokeCertSerial(serialHex, nodeID, reason string) (*RevokedCertEntry, error) {
	serialClean := strings.ToLower(strings.TrimSpace(serialHex))
	nodeClean := strings.TrimSpace(nodeID)
	if serialClean == "" && nodeClean == "" {
		return nil, fmt.Errorf("either serial_hex or node_id is required for revocation")
	}
	if strings.TrimSpace(reason) == "" {
		reason = "administrative_revocation"
	}

	entry := &RevokedCertEntry{
		SerialHex: serialClean,
		NodeID:    nodeClean,
		Reason:    reason,
		RevokedAt: time.Now().UTC(),
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	if serialClean != "" {
		a.revokedSerials[serialClean] = entry
	}
	if nodeClean != "" {
		a.revokedNodes[nodeClean] = entry
	}
	if err := a.saveCRLLocked(); err != nil {
		return nil, err
	}
	return entry, nil
}

// RevokeNode revokes all certificates associated with nodeID and persists CRL.json.
func (a *Authority) RevokeNode(nodeID, reason string) (*RevokedCertEntry, error) {
	return a.RevokeCertSerial("", nodeID, reason)
}

// IsCertRevoked checks whether a certificate's serial number or CommonName (NodeID) is on the CRL.
func (a *Authority) IsCertRevoked(cert *x509.Certificate) bool {
	if cert == nil {
		return true
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if cert.SerialNumber != nil {
		serialHex := strings.ToLower(cert.SerialNumber.Text(16))
		if _, revoked := a.revokedSerials[serialHex]; revoked {
			return true
		}
	}
	if cn := strings.TrimSpace(cert.Subject.CommonName); cn != "" {
		if _, revoked := a.revokedNodes[cn]; revoked {
			return true
		}
	}
	return false
}

// IsNodeRevoked checks whether a given nodeID is on the CRL.
func (a *Authority) IsNodeRevoked(nodeID string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	_, revoked := a.revokedNodes[strings.TrimSpace(nodeID)]
	return revoked
}

// ListRevokedCerts returns all currently active CRL entries.
func (a *Authority) ListRevokedCerts() []*RevokedCertEntry {
	a.mu.Lock()
	defer a.mu.Unlock()
	seen := make(map[string]bool)
	out := make([]*RevokedCertEntry, 0, len(a.revokedSerials)+len(a.revokedNodes))
	for _, e := range a.revokedSerials {
		key := e.SerialHex + "|" + e.NodeID
		if !seen[key] {
			seen[key] = true
			out = append(out, e)
		}
	}
	for _, e := range a.revokedNodes {
		key := e.SerialHex + "|" + e.NodeID
		if !seen[key] {
			seen[key] = true
			out = append(out, e)
		}
	}
	return out
}
