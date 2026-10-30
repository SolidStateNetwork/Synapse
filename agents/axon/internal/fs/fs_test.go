package fs

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func TestTier2WorkspaceJailAndUnifiedDiff(t *testing.T) {
	if defEng := NewEngine(""); defEng.WorkspaceRoot != DefaultWorkspaceRoot {
		t.Fatalf("expected DefaultWorkspaceRoot, got %s", defEng.WorkspaceRoot)
	}

	root := t.TempDir()
	eng := NewEngine(root)

	// 1. Reject path traversal outside /opt/axon/workspaces/<project_id>
	escapedResp := eng.Execute(tunnelv1.FsRequest{
		RequestID: "req-1",
		ProjectID: "proj-alpha",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpReadFile,
		Path:      "/etc/passwd",
	})
	if escapedResp.Success {
		t.Fatalf("expected TIER_2_WORKSPACE_JAIL to block /etc/passwd")
	}

	// 2. Reject symlink target escape and symlink parent escape in TIER_2_WORKSPACE_JAIL
	outsideDir := t.TempDir()
	outsideFile := filepath.Join(outsideDir, "secret.txt")
	_ = os.WriteFile(outsideFile, []byte("secret"), 0o600)
	jailDir := filepath.Join(root, "proj-alpha")
	_ = os.MkdirAll(jailDir, 0o755)
	_ = os.Symlink(outsideFile, filepath.Join(jailDir, "escaped-file.txt"))
	_ = os.Symlink(outsideDir, filepath.Join(jailDir, "escaped-dir"))

	if symResp := eng.Execute(tunnelv1.FsRequest{
		RequestID: "req-sym-1",
		ProjectID: "proj-alpha",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpReadFile,
		Path:      "escaped-file.txt",
	}); symResp.Success {
		t.Fatalf("expected TIER_2_WORKSPACE_JAIL to block symlink target escaping jail")
	}
	if symParentResp := eng.Execute(tunnelv1.FsRequest{
		RequestID: "req-sym-2",
		ProjectID: "proj-alpha",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpReadFile,
		Path:      "escaped-dir/secret.txt",
	}); symParentResp.Success {
		t.Fatalf("expected TIER_2_WORKSPACE_JAIL to block symlink parent escaping jail")
	}

	// 3. Write file inside jail with explicit octal file_mode, then overwrite preserving mode
	writeResp := eng.Execute(tunnelv1.FsRequest{
		RequestID: "req-2",
		ProjectID: "proj-alpha",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpWriteFile,
		Path:      "src/config.ts",
		FileMode:  "0755",
		Content:   []byte("export const PORT = 3000;\n"),
	})
	if !writeResp.Success {
		t.Fatalf("expected write_file inside jail to succeed, got error: %s", writeResp.Error)
	}
	writeResp2 := eng.Execute(tunnelv1.FsRequest{
		RequestID: "req-2b",
		ProjectID: "proj-alpha",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpWriteFile,
		Path:      "src/config.ts",
		Content:   []byte("export const PORT = 3000;\nexport const HOST = '127.0.0.1';\n"),
	})
	if !writeResp2.Success {
		t.Fatalf("expected overwrite without file_mode to succeed: %s", writeResp2.Error)
	}

	// 4. Apply unified diff (including shifted line numbers for fuzzy hunk matching & \ No newline at end of file)
	diff := `--- a/src/config.ts
+++ b/src/config.ts
@@ -10,2 +10,3 @@
-export const PORT = 3000;   
+export const PORT = 8080;
 export const HOST = '127.0.0.1';   
+export const TLS = true;
\ No newline at end of file
`
	diffResp := eng.Execute(tunnelv1.FsRequest{
		RequestID: "req-3",
		ProjectID: "proj-alpha",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpApplyUnifiedDiff,
		Path:      filepath.Join(root, "proj-alpha", "src/config.ts"),
		Diff:      diff,
	})
	if !diffResp.Success {
		t.Fatalf("expected apply_unified_diff to succeed, got: %s", diffResp.Error)
	}

	expected := "export const PORT = 8080;\nexport const HOST = '127.0.0.1';\nexport const TLS = true;\n"
	if string(diffResp.Content) != expected {
		t.Fatalf("unexpected diff result:\ngot:\n%s\nwant:\n%s", string(diffResp.Content), expected)
	}

	// 5. ReadFile, Stat, ListDir, Delete & error edge cases
	if dirRead := eng.Execute(tunnelv1.FsRequest{
		RequestID: "req-dir-read",
		ProjectID: "proj-alpha",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpReadFile,
		Path:      "src",
	}); dirRead.Success {
		t.Fatalf("expected ReadFile on directory to fail")
	}

	readResp := eng.Execute(tunnelv1.FsRequest{
		RequestID: "req-4",
		ProjectID: "proj-alpha",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpReadFile,
		Path:      "src/config.ts",
	})
	if !readResp.Success || string(readResp.Content) != expected {
		t.Fatalf("expected ReadFile to return patched content, got: %+v", readResp)
	}

	statResp := eng.Execute(tunnelv1.FsRequest{
		RequestID: "req-5",
		ProjectID: "proj-alpha",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpStat,
		Path:      "src/config.ts",
	})
	if !statResp.Success || len(statResp.Entries) != 1 || statResp.Entries[0].Name != "config.ts" {
		t.Fatalf("expected Stat to return 1 entry for config.ts, got: %+v", statResp)
	}

	listResp := eng.Execute(tunnelv1.FsRequest{
		RequestID: "req-6",
		ProjectID: "proj-alpha",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpListDir,
		Path:      "src",
	})
	if !listResp.Success || len(listResp.Entries) != 1 {
		t.Fatalf("expected ListDir on src to return 1 entry, got: %+v", listResp)
	}

	delResp := eng.Execute(tunnelv1.FsRequest{
		RequestID: "req-7",
		ProjectID: "proj-alpha",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpDelete,
		Path:      "src/config.ts",
	})
	if !delResp.Success {
		t.Fatalf("expected Delete on src/config.ts to succeed, got: %+v", delResp)
	}

	// Protected path deletion must be refused
	for _, prot := range []string{"/", "/etc", root} {
		if pResp := eng.Execute(tunnelv1.FsRequest{
			RequestID: "req-prot",
			ProjectID: "",
			Tier:      tunnelv1.Tier1Unleashed,
			Operation: tunnelv1.FsOpDelete,
			Path:      prot,
		}); pResp.Success {
			t.Fatalf("expected Delete on protected path %q to be refused", prot)
		}
	}

	// Missing file Stat/ListDir/ReadFile & unsupported op
	for _, op := range []tunnelv1.FsOperation{tunnelv1.FsOpReadFile, tunnelv1.FsOpStat, tunnelv1.FsOpListDir, "UNSUPPORTED_OP"} {
		if r := eng.Execute(tunnelv1.FsRequest{
			RequestID: "req-err",
			ProjectID: "",
			Tier:      tunnelv1.Tier1Unleashed,
			Operation: op,
			Path:      "nonexistent-path-xyz",
		}); r.Success {
			t.Fatalf("expected op %s on nonexistent path to fail", op)
		}
	}
}

func TestApplyUnifiedDiff_ErrorAndFuzzyCases(t *testing.T) {
	orig := "line1\nline2\nline3\nline4\n"

	// No hunks
	if _, err := ApplyUnifiedDiff(orig, "just plain text without hunks"); err == nil {
		t.Fatal("expected error when no hunks are present")
	}

	// Context mismatch
	badCtxDiff := "@@ -1,2 +1,2 @@\n wrong_ctx\n-line2\n+line2_mod\n"
	if _, err := ApplyUnifiedDiff(orig, badCtxDiff); err == nil || !strings.Contains(err.Error(), "context mismatch") {
		t.Fatalf("expected context mismatch error, got %v", err)
	}

	// Removal mismatch
	badRemDiff := "@@ -1,2 +1,2 @@\n line1\n-wrong_remove\n+line2_mod\n"
	if _, err := ApplyUnifiedDiff(orig, badRemDiff); err == nil || !strings.Contains(err.Error(), "removal mismatch") {
		t.Fatalf("expected removal mismatch error, got %v", err)
	}

	// Fuzzy exact match when hunk header line number is shifted
	shiftedDiff := "@@ -99,2 +99,2 @@\n line2\n-line3\n+line3_patched\n"
	patched, err := ApplyUnifiedDiff(orig, shiftedDiff)
	if err != nil || !strings.Contains(patched, "line3_patched") {
		t.Fatalf("expected fuzzy hunk match to succeed, got err=%v patched=%q", err, patched)
	}

	// ParseOctalFileMode fallback on invalid octal string
	if mode := parseOctalFileMode("invalid-octal", 0o644); mode != 0o644 {
		t.Fatalf("expected fallback 0644, got %v", mode)
	}
}
