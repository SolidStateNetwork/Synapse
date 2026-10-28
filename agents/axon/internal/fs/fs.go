package fs

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
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

		// Allow either paths already prefixed with jailDir or treat relative-like paths inside jailDir
		if candidate != jailDir && !strings.HasPrefix(candidate, jailDir+string(filepath.Separator)) {
			return "", fmt.Errorf("Autonomy Tier Violation (TIER_2_WORKSPACE_JAIL): path %q escapes project jail %q", targetPath, jailDir)
		}

		// Check symlinks on both parent directory and candidate itself (if it already exists)
		if evalJail, errJail := filepath.EvalSymlinks(jailDir); errJail == nil {
			if candidate != jailDir {
				if evalParent, err := filepath.EvalSymlinks(filepath.Dir(candidate)); err == nil {
					if evalParent != evalJail && !strings.HasPrefix(evalParent, evalJail+string(filepath.Separator)) {
						return "", fmt.Errorf("Autonomy Tier Violation (TIER_2_WORKSPACE_JAIL): symlink parent %q escapes project jail %q", evalParent, evalJail)
					}
				}
			}
			if evalCand, err := filepath.EvalSymlinks(candidate); err == nil {
				if evalCand != evalJail && !strings.HasPrefix(evalCand, evalJail+string(filepath.Separator)) {
					return "", fmt.Errorf("Autonomy Tier Violation (TIER_2_WORKSPACE_JAIL): symlink target %q escapes project jail %q", evalCand, evalJail)
				}
			}
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

var hunkHeaderRegex = regexp.MustCompile(`^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@`)

func applyUnifiedDiffToFile(targetPath string, diffText string, fileMode string) ([]byte, error) {
	origBytes, err := os.ReadFile(targetPath)
	if err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("read target file for diff: %w", err)
	}

	patched, err := ApplyUnifiedDiff(string(origBytes), diffText)
	if err != nil {
		return nil, err
	}
	outBytes := []byte(patched)
	perm := parseOctalFileMode(fileMode, 0o644)
	if err := atomicWriteFile(targetPath, outBytes, perm, strings.TrimSpace(fileMode) != ""); err != nil {
		return nil, err
	}
	return outBytes, nil
}

// ApplyUnifiedDiff applies a standard unified diff to original content in memory,
// with automatic fuzzy hunk locating when LLM line numbers are slightly shifted.
func ApplyUnifiedDiff(original string, diffText string) (string, error) {
	origLines := splitLinesPreserve(original)
	diffLines := strings.Split(strings.ReplaceAll(diffText, "\r\n", "\n"), "\n")

	var result []string
	origIdx := 0
	i := 0
	foundHunk := false

	for i < len(diffLines) {
		line := diffLines[i]
		if strings.HasPrefix(line, "--- ") || strings.HasPrefix(line, "+++ ") || strings.HasPrefix(line, "diff ") || strings.HasPrefix(line, "index ") {
			i++
			continue
		}

		matches := hunkHeaderRegex.FindStringSubmatch(line)
		isBareHunk := strings.HasPrefix(strings.TrimSpace(line), "@@")
		if matches == nil && !isBareHunk {
			i++
			continue
		}

		foundHunk = true
		oldStart := origIdx + 1
		if len(matches) >= 2 {
			if parsed, err := strconv.Atoi(matches[1]); err == nil && parsed > 0 {
				oldStart = parsed
			}
		}
		targetIdx := oldStart - 1
		if targetIdx < origIdx {
			targetIdx = origIdx
		}
		if targetIdx > len(origLines) {
			targetIdx = len(origLines)
		}

		// Collect hunk lines first so we can auto-locate the hunk if LLM line numbers are slightly off
		i++
		var hunkOps []struct {
			prefix  byte
			content string
		}
		var expectedOld []string
		for i < len(diffLines) {
			hline := diffLines[i]
			if strings.HasPrefix(hline, "@@") || strings.HasPrefix(hline, "diff ") || strings.HasPrefix(hline, "--- ") || strings.HasPrefix(hline, "+++ ") {
				break
			}
			if hline == `\ No newline at end of file` {
				i++
				continue
			}
			if hline == "" && i == len(diffLines)-1 {
				i++
				break
			}
			prefix := byte(' ')
			content := hline
			if len(hline) > 0 {
				if hline[0] == ' ' || hline[0] == '-' || hline[0] == '+' {
					prefix = hline[0]
					content = hline[1:]
				} else {
					prefix = ' '
					content = hline
				}
			}
			hunkOps = append(hunkOps, struct {
				prefix  byte
				content string
			}{prefix: prefix, content: content})
			if prefix == ' ' || prefix == '-' {
				expectedOld = append(expectedOld, content)
			}
			i++
		}

		// Verify whether expectedOld matches at targetIdx; if not, fuzzy-search from origIdx
		if len(expectedOld) > 0 && !matchesAt(origLines, targetIdx, expectedOld, false) {
			if foundIdx := findHunkMatch(origLines, origIdx, targetIdx, expectedOld); foundIdx >= 0 {
				targetIdx = foundIdx
			}
		}

		// Copy unchanged lines up to targetIdx
		for origIdx < targetIdx && origIdx < len(origLines) {
			result = append(result, origLines[origIdx])
			origIdx++
		}

		for _, op := range hunkOps {
			switch op.prefix {
			case ' ':
				if origIdx >= len(origLines) || !linesMatch(origLines[origIdx], op.content) {
					actual := "<EOF>"
					if origIdx < len(origLines) {
						actual = origLines[origIdx]
					}
					return "", fmt.Errorf("unified diff context mismatch at line %d: expected %q, got %q", origIdx+1, op.content, actual)
				}
				result = append(result, origLines[origIdx])
				origIdx++
			case '-':
				if origIdx >= len(origLines) || !linesMatch(origLines[origIdx], op.content) {
					actual := "<EOF>"
					if origIdx < len(origLines) {
						actual = origLines[origIdx]
					}
					return "", fmt.Errorf("unified diff removal mismatch at line %d: expected %q, got %q", origIdx+1, op.content, actual)
				}
				origIdx++
			case '+':
				result = append(result, op.content)
			default:
				return "", fmt.Errorf("invalid unified diff line prefix %q", string(op.prefix))
			}
		}
	}

	if !foundHunk {
		return "", fmt.Errorf("no valid unified diff hunks (@@ ... @@) found")
	}

	for origIdx < len(origLines) {
		result = append(result, origLines[origIdx])
		origIdx++
	}

	joined := strings.Join(result, "\n")
	if strings.HasSuffix(original, "\n") && !strings.HasSuffix(joined, "\n") && len(result) > 0 {
		joined += "\n"
	}
	return joined, nil
}

func linesMatch(a, b string) bool {
	if a == b {
		return true
	}
	return strings.TrimRight(a, " \t\r") == strings.TrimRight(b, " \t\r")
}

func matchesAt(origLines []string, startIdx int, expected []string, allowTrim bool) bool {
	if startIdx < 0 || startIdx+len(expected) > len(origLines) {
		return false
	}
	for j, exp := range expected {
		orig := origLines[startIdx+j]
		if allowTrim {
			if !linesMatch(orig, exp) {
				return false
			}
		} else if orig != exp {
			return false
		}
	}
	return true
}

func findHunkMatch(origLines []string, minIdx int, hintIdx int, expected []string) int {
	// Pass 1: exact match closest to hintIdx
	for delta := 0; delta <= len(origLines); delta++ {
		for _, cand := range []int{hintIdx - delta, hintIdx + delta} {
			if cand >= minIdx && cand+len(expected) <= len(origLines) {
				if matchesAt(origLines, cand, expected, false) {
					return cand
				}
			}
		}
	}
	// Pass 2: trailing-whitespace tolerant match closest to hintIdx
	for delta := 0; delta <= len(origLines); delta++ {
		for _, cand := range []int{hintIdx - delta, hintIdx + delta} {
			if cand >= minIdx && cand+len(expected) <= len(origLines) {
				if matchesAt(origLines, cand, expected, true) {
					return cand
				}
			}
		}
	}
	return -1
}

func splitLinesPreserve(s string) []string {
	if s == "" {
		return nil
	}
	normalized := strings.ReplaceAll(s, "\r\n", "\n")
	normalized = strings.TrimSuffix(normalized, "\n")
	return strings.Split(normalized, "\n")
}
