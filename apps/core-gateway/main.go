package main

import (
	"fmt"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func main() {
	fmt.Printf("Synapse Core Gateway v0.1.0-mvp1 (protocol StreamTypeTelemetry=%d)\n", tunnelv1.StreamTypeTelemetry)
}
