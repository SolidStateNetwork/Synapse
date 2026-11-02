package fs

import (
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
)

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

		if len(expectedOld) > 0 && !matchesAt(origLines, targetIdx, expectedOld, false) {
			if foundIdx := findHunkMatch(origLines, origIdx, targetIdx, expectedOld); foundIdx >= 0 {
				targetIdx = foundIdx
			}
		}

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
	for delta := 0; delta <= len(origLines); delta++ {
		for _, cand := range []int{hintIdx - delta, hintIdx + delta} {
			if cand >= minIdx && cand+len(expected) <= len(origLines) {
				if matchesAt(origLines, cand, expected, false) {
					return cand
				}
			}
		}
	}
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
