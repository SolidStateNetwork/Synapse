package tunnelv1

import (
	"bytes"
	"encoding/binary"
	"errors"
	"io"
	"strings"
	"testing"
)

type chunkedReadWriter struct {
	buf       bytes.Buffer
	chunkSize int
}

func (c *chunkedReadWriter) Write(p []byte) (int, error) {
	if len(p) > c.chunkSize {
		p = p[:c.chunkSize]
	}
	return c.buf.Write(p)
}

func (c *chunkedReadWriter) Read(p []byte) (int, error) {
	if len(p) > c.chunkSize {
		p = p[:c.chunkSize]
	}
	return c.buf.Read(p)
}

type zeroWriter struct{}

func (zeroWriter) Write([]byte) (int, error) { return 0, nil }

type errWriter struct{}

func (errWriter) Write([]byte) (int, error) { return 0, errors.New("simulated write failure") }

func TestWriteAndReadFrameRoundTripAndChunking(t *testing.T) {
	crw := &chunkedReadWriter{chunkSize: 3}

	want := NodeHeartbeat{
		NodeID:            "muscle-01",
		Hostname:          "edge-host",
		OSArch:            "linux/amd64",
		Tier:              Tier2WorkspaceJail,
		CPUPercent:        18.5,
		RAMPercent:        42.0,
		ActivePtySessions: []string{"default"},
		Services: []ServiceHealthStatus{
			{ServiceID: "svc-api", Name: "API", Port: 4050, Healthy: true, LatencyMs: 3},
		},
	}

	if err := WriteFrame(crw, want); err != nil {
		t.Fatalf("WriteFrame failed on chunked writer: %v", err)
	}

	var got NodeHeartbeat
	if err := ReadFrame(crw, &got); err != nil {
		t.Fatalf("ReadFrame failed on chunked reader: %v", err)
	}
	if got.NodeID != want.NodeID || len(got.Services) != 1 || got.Services[0].Port != 4050 {
		t.Fatalf("roundtrip mismatch: got %+v, want %+v", got, want)
	}
}

func TestWriteAndReadFrameErrorConditions(t *testing.T) {
	// 1. Unmarshalable payload (channel/func)
	var buf bytes.Buffer
	if err := WriteFrame(&buf, make(chan int)); err == nil {
		t.Fatalf("expected error marshaling unsupported type")
	}

	// 2. Zero-progress writer -> io.ErrShortWrite
	if err := WriteFrame(zeroWriter{}, StreamHeader{StreamType: StreamTypePty}); !errors.Is(err, io.ErrShortWrite) {
		t.Fatalf("expected io.ErrShortWrite, got %v", err)
	}

	// 3. Failing writer
	if err := WriteFrame(errWriter{}, StreamHeader{StreamType: StreamTypePty}); err == nil {
		t.Fatalf("expected write error from errWriter")
	}

	// 4. Oversized payload on WriteFrame (> MaxFrameSize)
	huge := FsResponse{
		RequestID: "huge",
		Content:   bytes.Repeat([]byte("A"), MaxFrameSize+64),
	}
	if err := WriteFrame(&buf, huge); err == nil || !strings.Contains(err.Error(), "exceeds maximum") {
		t.Fatalf("expected MaxFrameSize error on WriteFrame, got %v", err)
	}

	// 5. Truncated 4-byte length header on ReadFrame
	var dst StreamHeader
	if err := ReadFrame(bytes.NewReader([]byte{0x00, 0x01}), &dst); err == nil {
		t.Fatalf("expected error on truncated length header")
	}

	// 6. Oversized length header on ReadFrame (> MaxFrameSize)
	var hdr [4]byte
	binary.BigEndian.PutUint32(hdr[:], uint32(MaxFrameSize+100))
	if err := ReadFrame(bytes.NewReader(hdr[:]), &dst); err == nil || !strings.Contains(err.Error(), "exceeds maximum") {
		t.Fatalf("expected MaxFrameSize error on ReadFrame, got %v", err)
	}

	// 7. Truncated frame payload on ReadFrame
	binary.BigEndian.PutUint32(hdr[:], 32)
	truncatedPayload := append(hdr[:], []byte("short")...)
	if err := ReadFrame(bytes.NewReader(truncatedPayload), &dst); err == nil {
		t.Fatalf("expected error on truncated frame payload")
	}

	// 8. Corrupted JSON payload on ReadFrame
	badJSON := []byte("{invalid-json")
	binary.BigEndian.PutUint32(hdr[:], uint32(len(badJSON)))
	corruptFrame := append(hdr[:], badJSON...)
	if err := ReadFrame(bytes.NewReader(corruptFrame), &dst); err == nil {
		t.Fatalf("expected error on corrupted JSON frame")
	}
}
