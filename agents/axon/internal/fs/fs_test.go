package fs

import (
	"path/filepath"
	"testing"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func TestTier2WorkspaceJailAndUnifiedDiff(t *testing.T) {
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

	// 2. Write file inside jail
	writeResp := eng.Execute(tunnelv1.FsRequest{
		RequestID: "req-2",
		ProjectID: "proj-alpha",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpWriteFile,
		Path:      "src/config.ts",
		Content:   []byte("export const PORT = 3000;\nexport const HOST = '127.0.0.1';\n"),
	})
	if !writeResp.Success {
		t.Fatalf("expected write_file inside jail to succeed, got error: %s", writeResp.Error)
	}

	// 3. Apply unified diff
	diff := `--- a/src/config.ts
+++ b/src/config.ts
@@ -1,2 +1,3 @@
-export const PORT = 3000;
+export const PORT = 8080;
 export const HOST = '127.0.0.1';
+export const TLS = true;
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
}
