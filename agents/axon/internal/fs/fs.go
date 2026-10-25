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

const DefaultWorkspaceRoot = "/opt/axon/workspaces"

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

		// Check symlinks if parent exists
		if evalParent, err := filepath.EvalSymlinks(filepath.Dir(candidate)); err == nil {
			if evalJail, errJail := filepath.EvalSymlinks(jailDir); errJail == nil {
				if evalParent != evalJail && !strings.HasPrefix(evalParent, evalJail+string(filepath.Separator)) {
					return "", fmt.Errorf("Autonomy Tier Violation (TIER_2_WORKSPACE_JAIL): symlink target %q escapes project jail %q", evalParent, evalJail)
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
		if err := atomicWriteFile(resolved, req.Content, 0o644); err != nil {
			return failResp(req.RequestID, err)
		}
		return tunnelv1.FsResponse{
			RequestID: req.RequestID,
			Success:   true,
		}

	case tunnelv1.FsOpApplyUnifiedDiff:
		updated, err := applyUnifiedDiffToFile(resolved, req.Diff)
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
		if resolved == "/" || resolved == e.WorkspaceRoot {
			return failResp(req.RequestID, fmt.Errorf("refusing to delete root directory %q", resolved))
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

func atomicWriteFile(targetPath string, content []byte, defaultPerm os.FileMode) error {
	parent := filepath.Dir(targetPath)
	if err := os.MkdirAll(parent, 0o755); err != nil {
		return fmt.Errorf("mkdir parent %s: %w", parent, err)
	}

	perm := defaultPerm
	if info, err := os.Stat(targetPath); err == nil {
		perm = info.Mode().Perm()
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

func applyUnifiedDiffToFile(targetPath string, diffText string) ([]byte, error) {
	origBytes, err := os.ReadFile(targetPath)
	if err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("read target file for diff: %w", err)
	}

	patched, err := ApplyUnifiedDiff(string(origBytes), diffText)
	if err != nil {
		return nil, err
	}
	outBytes := []byte(patched)
	if err := atomicWriteFile(targetPath, outBytes, 0o644); err != nil {
		return nil, err
	}
	return outBytes, nil
}

// ApplyUnifiedDiff applies a standard unified diff to original content in memory.
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
		if matches == nil {
			i++
			continue
		}

		foundHunk = true
		oldStart, _ := strconv.Atoi(matches[1])
		targetIdx := oldStart - 1
		if targetIdx < 0 {
			targetIdx = 0
		}
		if targetIdx > len(origLines) {
			return "", fmt.Errorf("unified diff hunk start line %d exceeds file length %d", oldStart, len(origLines))
		}

		// Copy unchanged lines up to the hunk start
		for origIdx < targetIdx {
			result = append(result, origLines[origIdx])
			origIdx++
		}

		i++
		for i < len(diffLines) {
			hline := diffLines[i]
			if strings.HasPrefix(hline, "@@ ") || strings.HasPrefix(hline, "diff ") {
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
				prefix = hline[0]
				content = hline[1:]
			}

			switch prefix {
			case ' ':
				if origIdx >= len(origLines) || origLines[origIdx] != content {
					actual := "<EOF>"
					if origIdx < len(origLines) {
						actual = origLines[origIdx]
					}
					return "", fmt.Errorf("unified diff context mismatch at line %d: expected %q, got %q", origIdx+1, content, actual)
				}
				result = append(result, origLines[origIdx])
				origIdx++
			case '-':
				if origIdx >= len(origLines) || origLines[origIdx] != content {
					actual := "<EOF>"
					if origIdx < len(origLines) {
						actual = origLines[origIdx]
					}
					return "", fmt.Errorf("unified diff removal mismatch at line %d: expected %q, got %q", origIdx+1, content, actual)
				}
				origIdx++
			case '+':
				result = append(result, content)
			default:
				return "", fmt.Errorf("invalid unified diff line prefix %q in line %q", string(prefix), hline)
			}
			i++
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

func splitLinesPreserve(s string) []string {
	if s == "" {
		return nil
	}
	normalized := strings.ReplaceAll(s, "\r\n", "\n")
	normalized = strings.TrimSuffix(normalized, "\n")
	return strings.Split(normalized, "\n")
}
