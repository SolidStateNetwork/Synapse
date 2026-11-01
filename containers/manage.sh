#!/usr/bin/env bash
set -euo pipefail

CONTAINERS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${CONTAINERS_DIR}/.." && pwd)"
export PATH="${HOME}/.local/go/bin:${PATH}"

CORE_DIR="${CONTAINERS_DIR}/core"
MUSCLE_DIR="${CONTAINERS_DIR}/muscle"
CORE_UNIT="synapse-core-container"
MUSCLE_UNIT="synapse-muscle-container"

has_docker_compose() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

stop_local_containers() {
  if has_docker_compose; then
    docker compose -f "${CONTAINERS_DIR}/docker-compose.yml" down 2>/dev/null || true
  fi
  systemctl --user stop "$MUSCLE_UNIT" "$CORE_UNIT" 2>/dev/null || true
  systemctl --user reset-failed "$MUSCLE_UNIT" "$CORE_UNIT" 2>/dev/null || true
  rm -f "${CORE_DIR}/container.pid" "${MUSCLE_DIR}/container.pid"
}

start_local_containers() {
  mkdir -p "${CORE_DIR}/data/projects" "${MUSCLE_DIR}/config" "${MUSCLE_DIR}/workspaces"

  if has_docker_compose; then
    echo "[containers] Docker daemon detected -> launching 2 Docker containers (synapse-core + synapse-muscle)..."
    docker compose -f "${CONTAINERS_DIR}/docker-compose.yml" up -d --build
    return 0
  fi

  echo "[containers] Using rootless Linux Namespace Containers in ${CONTAINERS_DIR}/{core,muscle}..."
  stop_local_containers

  mkdir -p "${CORE_DIR}/runtime/bin" "${MUSCLE_DIR}/runtime/bin" \
           "${MUSCLE_DIR}/runtime/usr-local-bin" \
           "${MUSCLE_DIR}/runtime/opt/axon/workspaces" \
           "${MUSCLE_DIR}/runtime/opt/synapse-src" \
           "${REPO_ROOT}/bin"

  echo "[1/3] Building Core & Muscle binaries into ${CONTAINERS_DIR}/{core,muscle}/runtime..."
  (
    cd "$REPO_ROOT"
    CGO_ENABLED=0 go build -ldflags="-s -w -X main.version=v2.2.0" -o "${CORE_DIR}/runtime/bin/core-gateway" ./apps/core-gateway
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w -X main.version=v2.2.0" -o "${MUSCLE_DIR}/runtime/bin/axon" ./agents/axon/cmd/axon
    cp -f "${MUSCLE_DIR}/runtime/bin/axon" "${CORE_DIR}/runtime/bin/axon"
    cp -f "${MUSCLE_DIR}/runtime/bin/axon" "${CORE_DIR}/runtime/bin/axon-linux-amd64"
    cp -f "${MUSCLE_DIR}/runtime/bin/axon" "${MUSCLE_DIR}/runtime/usr-local-bin/axon"
  )

  if [ ! -f "${CORE_DIR}/runtime/web/server.js" ] || [ "${REPO_ROOT}/apps/core-web/src/lib/version.ts" -nt "${CORE_DIR}/runtime/web/server.js" ]; then
    echo "[2/3] Building Next.js 15 standalone bundle for synapse-core container..."
    (
      cd "${REPO_ROOT}/apps/core-web"
      npm run build >/dev/null
    )
    rm -rf "${CORE_DIR}/runtime/web"
    mkdir -p "${CORE_DIR}/runtime/web"
    cp -r "${REPO_ROOT}/apps/core-web/.next/standalone/." "${CORE_DIR}/runtime/web/"
    mkdir -p "${CORE_DIR}/runtime/web/.next"
    cp -r "${REPO_ROOT}/apps/core-web/.next/static" "${CORE_DIR}/runtime/web/.next/static"
    rm -rf "${REPO_ROOT}/apps/core-web/.next"
  else
    echo "[2/3] Reusing built Next.js 15 standalone bundle in ${CORE_DIR}/runtime/web..."
  fi

  echo "[3/3] Starting Container 1 (${CORE_UNIT}) and Container 2 (${MUSCLE_UNIT})..."
  WEB_SERVER_JS="${CORE_DIR}/runtime/web/server.js"

  systemd-run --user --collect --unit="$CORE_UNIT" \
    --property=Restart=always \
    --property=RestartSec=2 \
    --working-directory="${CORE_DIR}" \
    /usr/bin/unshare --user --map-root-user --uts --mount --fork /usr/bin/bash -c "
      exec >>'${CORE_DIR}/container.log' 2>&1
      hostname synapse-core 2>/dev/null || true
      mount --bind '${CORE_DIR}/runtime/bin' '${REPO_ROOT}/bin' 2>/dev/null || true
      export SYNAPSE_DATA_DIR='${CORE_DIR}/data'
      export SYNAPSE_VAULT_DIR='${CORE_DIR}/data/projects'
      export SYNAPSE_CARTRIDGES_DIR='${REPO_ROOT}/cartridges'
      export SYNAPSE_REPO_ROOT='${REPO_ROOT}'
      export CORE_GATEWAY_URL='http://127.0.0.1:8081'
      export CORE_GATEWAY_INTERNAL_URL='http://127.0.0.1:8081'
      '${CORE_DIR}/runtime/bin/core-gateway' &
      GW_PID=\$!
      env HOSTNAME=0.0.0.0 PORT=3000 node '${WEB_SERVER_JS}' &
      WEB_PID=\$!
      trap 'kill -TERM \$GW_PID \$WEB_PID 2>/dev/null || true' INT TERM EXIT
      wait -n \$GW_PID \$WEB_PID
    "

  for _ in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:8081/healthz >/dev/null 2>&1 && curl -fsS http://127.0.0.1:3000/api/projects >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done

  systemd-run --user --collect --unit="$MUSCLE_UNIT" \
    --property=Restart=always \
    --property=RestartSec=2 \
    --working-directory="${MUSCLE_DIR}" \
    /usr/bin/unshare --user --map-root-user --uts --mount --fork /usr/bin/bash -c "
      exec >>'${MUSCLE_DIR}/container.log' 2>&1
      hostname synapse-muscle 2>/dev/null || true
      mount --bind '${MUSCLE_DIR}/runtime/usr-local-bin' /usr/local/bin 2>/dev/null || true
      mount --bind '${MUSCLE_DIR}/runtime/opt' /opt 2>/dev/null || true
      mount --bind '${MUSCLE_DIR}/workspaces' /opt/axon/workspaces 2>/dev/null || true
      mount --bind '${REPO_ROOT}' /opt/synapse-src 2>/dev/null || true
      export AXON_CONFIG_DIR='${MUSCLE_DIR}/config'
      export AXON_WORKSPACE_DIR='/opt/axon/workspaces'
      export SYNAPSE_CORE_HTTP_URL='http://127.0.0.1:8081'
      export SYNAPSE_CORE_TUNNEL_ADDR='127.0.0.1:8443'
      export AXON_NODE_ID='local-muscle'
      export AXON_TIER='TIER_1_UNLEASHED'
      export AXON_BIN_PATH='/usr/local/bin/axon'
      exec '${MUSCLE_DIR}/entrypoint.sh'
    "

  for _ in $(seq 1 20); do
    if curl -fsS http://127.0.0.1:8081/healthz | grep -q '"connected_nodes":1'; then
      break
    fi
    sleep 0.5
  done

  # Ensure local-muscle is assigned to the default project so it appears immediately on the Canvas
  curl -fsS -X POST http://127.0.0.1:3000/api/projects \
    -H "Content-Type: application/json" \
    -d '{"action":"assign_node","project_id":"default","node_id":"local-muscle"}' >/dev/null 2>&1 || true
}

status_containers() {
  echo "=== Synapse 2-Container Local Lab (${CONTAINERS_DIR}) ==="
  if has_docker_compose; then
    docker compose -f "${CONTAINERS_DIR}/docker-compose.yml" ps
  else
    for unit_dir in "${CORE_UNIT}:${CORE_DIR}" "${MUSCLE_UNIT}:${MUSCLE_DIR}"; do
      u="${unit_dir%%:*}"
      d="${unit_dir#*:}"
      if systemctl --user is-active --quiet "$u"; then
        pid="$(systemctl --user show -p MainPID --value "$u")"
        echo "  [RUNNING] ${u} (PID ${pid}) -> ${d}/"
      else
        echo "  [STOPPED] ${u}"
      fi
    done
  fi
  echo ""
  echo "=== Core Gateway Health (:8081/healthz) ==="
  curl -fsS http://127.0.0.1:8081/healthz || echo "Gateway offline"
  echo ""
  echo "=== Core WebUI (:3000/api/debug) ==="
  curl -fsS http://127.0.0.1:3000/api/debug | head -c 260 || echo "WebUI offline"
  echo ""
  echo ""
  echo "=== Enrolled Muscle Nodes (:8081/api/v1/nodes) ==="
  curl -fsS http://127.0.0.1:8081/api/v1/nodes | head -c 360 || echo "Nodes unavailable"
  echo ""
}

case "${1:-status}" in
  up|start)
    start_local_containers
    status_containers
    ;;
  down|stop)
    stop_local_containers
    echo "[containers] Both containers (${CORE_UNIT} & ${MUSCLE_UNIT}) stopped."
    ;;
  restart)
    stop_local_containers
    start_local_containers
    status_containers
    ;;
  status|ps)
    status_containers
    ;;
  logs)
    tail -n 30 "${CORE_DIR}/container.log" "${MUSCLE_DIR}/container.log" 2>/dev/null || true
    ;;
  clean)
    stop_local_containers
    rm -rf "${CORE_DIR}/data" "${CORE_DIR}/runtime" "${CORE_DIR}/container.log" \
           "${MUSCLE_DIR}/config" "${MUSCLE_DIR}/workspaces" "${MUSCLE_DIR}/runtime" "${MUSCLE_DIR}/container.log"
    echo "[containers] Runtime data and build artifacts inside ${CONTAINERS_DIR} cleaned."
    ;;
  *)
    echo "Usage: $0 {up|down|restart|status|logs|clean}"
    exit 1
    ;;
esac
