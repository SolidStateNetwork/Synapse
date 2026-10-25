package main

import (
	"fmt"
	"os"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "version" {
		fmt.Printf("axon v0.1.0-mvp1 (protocol StreamTypeRpcFs=%d)\n", tunnelv1.StreamTypeRpcFs)
		return
	}
	fmt.Println("Synapse Axon Agent - Ready")
}
