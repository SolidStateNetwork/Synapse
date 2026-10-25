module github.com/SolidStateNetwork/Synapse/apps/core-gateway

go 1.23.0

require (
	github.com/SolidStateNetwork/Synapse/agents/axon v0.0.0
	github.com/SolidStateNetwork/Synapse/proto v0.0.0
	github.com/hashicorp/yamux v0.1.2
)

require (
	github.com/creack/pty v1.1.24 // indirect
	github.com/go-ole/go-ole v1.2.6 // indirect
	github.com/lufia/plan9stats v0.0.0-20211012122336-39d0f177ccd0 // indirect
	github.com/power-devops/perfstat v0.0.0-20210106213030-5aafc221ea8c // indirect
	github.com/shirou/gopsutil/v3 v3.24.5 // indirect
	github.com/shoenig/go-m1cpu v0.1.6 // indirect
	github.com/tklauser/go-sysconf v0.3.12 // indirect
	github.com/tklauser/numcpus v0.6.1 // indirect
	github.com/yusufpapurcu/wmi v1.2.4 // indirect
	golang.org/x/sys v0.20.0 // indirect
)

replace (
	github.com/SolidStateNetwork/Synapse/agents/axon => ../../agents/axon
	github.com/SolidStateNetwork/Synapse/proto => ../../proto
)
