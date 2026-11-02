package fs

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

const (
	DefaultWorkspaceRoot = "/opt/axon/workspaces"
	MaxReadFileBytes     = 12 * 1024 * 1024 // 12 MiB safety cap (under 16 MiB MaxFramePayloadSize)
)

// Engine executes atomic file operations while enforcing node autonomy tiers.
type Engine struct {
	WorkspaceRoot string
}

// NewEngine creates an atomic filesystem operation engine.
func NewEngine(workspaceRoot string) *Engine {
	if strings.TrimSpace(workspaceRoot) == "" {
		workspaceRoot = DefaultWorkspaceRoot
	}
	return &Engine{WorkspaceRoot: workspaceRoot}
}

func isWithinJail(evalJail string, candidate string) bool {
	cleanJail := filepath.Clean(evalJail)
	cleanCand := filepath.Clean(candidate)
	return cleanCand == cleanJail || strings.HasPrefix(cleanCand, cleanJail+string(filepath.Separator))
}

func verifyAncestorAndBrokenSymlinks(evalJail string, candidate string) error {
	// Walk from candidate up to jail root, checking broken symlinks via Lstat/Readlink
	// and evaluating the longest existing ancestor on disk via EvalSymlinks.
	cur := filepath.Clean(candidate)
	var suffixParts []string
	evaluatedAncestor := false

	for {
		if info, lerr := os.Lstat(cur); lerr == nil {
			if info.Mode()&os.ModeSymlink != 0 {
				if linkDest, rerr := os.Readlink(cur); rerr == nil {
					resolvedDest := linkDest
					if !filepath.IsAbs(resolvedDest) {
						resolvedDest = filepath.Join(filepath.Dir(cur), resolvedDest)
					}
					resolvedDest = filepath.Clean(resolvedDest)
					if evalDest, eerr := filepath.EvalSymlinks(resolvedDest); eerr == nil {
						resolvedDest = evalDest
					}
					if !isWithinJail(evalJail, resolvedDest) {
						return fmt.Errorf("Autonomy Tier Violation (TIER_2_WORKSPACE_JAIL): symlink %q -> %q escapes project jail %q", cur, resolvedDest, evalJail)
					}
				}
			}
			if !evaluatedAncestor {
				if evalAnc, err := filepath.EvalSymlinks(cur); err == nil {
					evaluatedAncestor = true
					if !isWithinJail(evalJail, evalAnc) {
						return fmt.Errorf("Autonomy Tier Violation (TIER_2_WORKSPACE_JAIL): symlink ancestor %q escapes project jail %q", evalAnc, evalJail)
					}
					recombined := evalAnc
					for i := len(suffixParts) - 1; i >= 0; i-- {
						recombined = filepath.Join(recombined, suffixParts[i])
					}
					if !isWithinJail(evalJail, recombined) {
						return fmt.Errorf("Autonomy Tier Violation (TIER_2_WORKSPACE_JAIL): resolved path %q escapes project jail %q", recombined, evalJail)
					}
				}
			}
		}

		parent := filepath.Dir(cur)
		if parent == cur || cur == evalJail {
			break
		}
		suffixParts = append(suffixParts, filepath.Base(cur))
		cur = parent
	}
	return nil
}

// ResolvePath validates and resolves a target path according to the project ID and AutonomyTier.
// When Tier2WorkspaceJail is active, paths outside /opt/axon/workspaces/<project_id> are rejected.
func (e *Engine) ResolvePath(projectID string, tier tunnelv1.AutonomyTier, targetPath string) (string, error) {
	safeProject := filepath.Base(strings.TrimSpace(projectID))
	if safeProject == "" || safeProject == "." || safeProject == "/" {
		safeProject = "default"
	}
	jailDir := filepath.Clean(filepath.Join(e.WorkspaceRoot, safeProject))

	if tier == tunnelv1.Tier2WorkspaceJail {
		_ = os.MkdirAll(jailDir, 0o755)
		var candidate string
		if filepath.IsAbs(targetPath) {
			candidate = filepath.Clean(targetPath)
		} else {
			candidate = filepath.Clean(filepath.Join(jailDir, targetPath))
		}

		if !isWithinJail(jailDir, candidate) {
			return "", fmt.Errorf("Autonomy Tier Violation (TIER_2_WORKSPACE_JAIL): path %q escapes project jail %q", targetPath, jailDir)
		}

		evalJail := jailDir
		if resolvedJail, errJail := filepath.EvalSymlinks(jailDir); errJail == nil {
			evalJail = resolvedJail
		}
		if err := verifyAncestorAndBrokenSymlinks(evalJail, candidate); err != nil {
			return "", err
		}

		return candidate, nil
	}

	// TIER_1_UNLEASHED or TIER_3_SUPERVISED (already approved at Core Interceptor)
	if !filepath.IsAbs(targetPath) {
		_ = os.MkdirAll(jailDir, 0o755)
		return filepath.Clean(filepath.Join(jailDir, targetPath)), nil
	}
	return filepath.Clean(targetPath), nil
}

// Execute runs an atomic filesystem request and returns an FsResponse.
func (e *Engine) Execute(req tunnelv1.FsRequest) tunnelv1.FsResponse {
	resolved, err := e.ResolvePath(req.ProjectID, req.Tier, req.Path)
	if err != nil {
		return tunnelv1.FsResponse{
			RequestID: req.RequestID,
			Success:   false,
			Error:     err.Error(),
		}
	}

	switch req.Operation {
	case tunnelv1.FsOpReadFile:
		info, statErr := os.Stat(resolved)
		if statErr != nil {
			return failResp(req.RequestID, statErr)
		}
		if info.IsDir() {
			return failResp(req.RequestID, fmt.Errorf("cannot read directory %q as a file; use list_dir instead", resolved))
		}
		if info.Size() > MaxReadFileBytes {
			return failResp(req.RequestID, fmt.Errorf("file %q size (%d bytes) exceeds maximum allowed read size (%d bytes)", resolved, info.Size(), MaxReadFileBytes))
		}
		data, err := os.ReadFile(resolved)
		if err != nil {
			return failResp(req.RequestID, err)
		}
		return tunnelv1.FsResponse{
			RequestID: req.RequestID,
			Success:   true,
			Content:   data,
		}

	case tunnelv1.FsOpWriteFile:
		perm := parseOctalFileMode(req.FileMode, 0o644)
		if err := atomicWriteFile(resolved, req.Content, perm, strings.TrimSpace(req.FileMode) != ""); err != nil {
			return failResp(req.RequestID, err)
		}
		return tunnelv1.FsResponse{
			RequestID: req.RequestID,
			Success:   true,
		}

	case tunnelv1.FsOpApplyUnifiedDiff:
		updated, err := applyUnifiedDiffToFile(resolved, req.Diff, req.FileMode)
		if err != nil {
			return failResp(req.RequestID, err)
		}
		return tunnelv1.FsResponse{
			RequestID: req.RequestID,
			Success:   true,
			Content:   updated,
		}

	case tunnelv1.FsOpListDir:
		dirEntries, err := os.ReadDir(resolved)
		if err != nil {
			return failResp(req.RequestID, err)
		}
		entries := make([]tunnelv1.FsEntry, 0, len(dirEntries))
		for _, de := range dirEntries {
			info, infoErr := de.Info()
			var size int64
			var modTime int64
			modeStr := de.Type().String()
			if infoErr == nil {
				size = info.Size()
				modTime = info.ModTime().Unix()
				modeStr = info.Mode().String()
			}
			entries = append(entries, tunnelv1.FsEntry{
				Name:    de.Name(),
				Path:    filepath.Join(resolved, de.Name()),
				IsDir:   de.IsDir(),
				Size:    size,
				ModTime: modTime,
				Mode:    modeStr,
			})
		}
		return tunnelv1.FsResponse{
			RequestID: req.RequestID,
			Success:   true,
			Entries:   entries,
		}

	case tunnelv1.FsOpStat:
		info, err := os.Stat(resolved)
		if err != nil {
			return failResp(req.RequestID, err)
		}
		return tunnelv1.FsResponse{
			RequestID: req.RequestID,
			Success:   true,
			Entries: []tunnelv1.FsEntry{
				{
					Name:    info.Name(),
					Path:    resolved,
					IsDir:   info.IsDir(),
					Size:    info.Size(),
					ModTime: info.ModTime().Unix(),
					Mode:    info.Mode().String(),
				},
			},
		}

	case tunnelv1.FsOpDelete:
		if isProtectedSystemPath(resolved, e.WorkspaceRoot) {
			return failResp(req.RequestID, fmt.Errorf("refusing to delete protected root/system directory %q", resolved))
		}
		if err := os.RemoveAll(resolved); err != nil {
			return failResp(req.RequestID, err)
		}
		return tunnelv1.FsResponse{
			RequestID: req.RequestID,
			Success:   true,
		}

	default:
		return failResp(req.RequestID, fmt.Errorf("unsupported filesystem operation %q", req.Operation))
	}
}

func failResp(reqID string, err error) tunnelv1.FsResponse {
	return tunnelv1.FsResponse{
		RequestID: reqID,
		Success:   false,
		Error:     err.Error(),
	}
}

func isProtectedSystemPath(resolved string, workspaceRoot string) bool {
	cleaned := filepath.Clean(resolved)
	wsClean := filepath.Clean(workspaceRoot)
	if cleaned == "/" || cleaned == wsClean {
		return true
	}
	protectedRoots := []string{
		"/bin", "/boot", "/dev", "/etc", "/home", "/lib", "/lib64",
		"/opt", "/opt/axon", "/proc", "/root", "/run", "/sbin",
		"/srv", "/sys", "/usr", "/usr/bin", "/usr/local", "/usr/local/bin",
		"/usr/local/bin/axon", "/var",
	}
	for _, p := range protectedRoots {
		if cleaned == p {
			return true
		}
	}
	return false
}

func parseOctalFileMode(modeStr string, fallback os.FileMode) os.FileMode {
	cleaned := strings.TrimSpace(modeStr)
	if cleaned == "" {
		return fallback
	}
	if val, err := strconv.ParseUint(cleaned, 8, 32); err == nil && val > 0 {
		return os.FileMode(val)
	}
	return fallback
}

func atomicWriteFile(targetPath string, content []byte, defaultPerm os.FileMode, forcePerm bool) error {
	parent := filepath.Dir(targetPath)
	if err := os.MkdirAll(parent, 0o755); err != nil {
		return fmt.Errorf("mkdir parent %s: %w", parent, err)
	}

	perm := defaultPerm
	if !forcePerm {
		if info, err := os.Stat(targetPath); err == nil {
			perm = info.Mode().Perm()
		}
	}

	tmpFile, err := os.CreateTemp(parent, ".axon-atomic-*")
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	tmpName := tmpFile.Name()
	defer func() {
		_ = os.Remove(tmpName)
	}()

	if _, err := tmpFile.Write(content); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := tmpFile.Sync(); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("sync temp file: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("close temp file: %w", err)
	}
	if err := os.Chmod(tmpName, perm); err != nil {
		return fmt.Errorf("chmod temp file: %w", err)
	}
	if err := os.Rename(tmpName, targetPath); err != nil {
		return fmt.Errorf("rename temp file to %s: %w", targetPath, err)
	}
	return nil
}
