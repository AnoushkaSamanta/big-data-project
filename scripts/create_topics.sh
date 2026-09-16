#!/usr/bin/env bash
set -euo pipefail

BOOTSTRAP="localhost:9092"
echo "Creating Kafka topics on ${BOOTSTRAP}..."

create_topic() {
  local topic=$1
  local partitions=$2
  local retention_ms=$3
  
  docker compose exec kafka kafka-topics --bootstrap-server "${BOOTSTRAP}" \
    --create --if-not-exists \
    --topic "${topic}" \
    --partitions "${partitions}" \
    --replication-factor 1 \
    --config retention.ms="${retention_ms}"
  echo "✓ Topic '${topic}' ready (${partitions} partitions)"
}

# 24 hours retention for ingest and clean streams
create_topic "ais.positions.raw" 6 86400000
create_topic "ais.positions.clean" 6 86400000

# 7 days retention for dead-letter queue and alerts
create_topic "ais.positions.dlq" 1 604800000
create_topic "ais.alerts" 3 604800000

echo "All topics verified."
