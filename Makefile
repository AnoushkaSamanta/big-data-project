.PHONY: help up down nuke topics reset dashboard demo test lint geofences prior

.DEFAULT_GOAL := help
export PYTHONPATH := backend

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS=":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up:              ## Start core services (Kafka KRaft, PostGIS) and wait for health
	docker compose up -d
	@./scripts/wait_healthy.sh kafka postgres
	@./scripts/create_topics.sh

down:            ## Stop all running services, preserving data volumes
	docker compose --profile stream --profile ui down

nuke:            ## Stop everything and delete all persistent volumes
	docker compose --profile stream --profile ui down -v

topics:          ## Create/verify Kafka topics and partitions
	@./scripts/create_topics.sh

reset:           ## Clear dynamic state tables (preserves coverage_prior, geofences, ground_truth)
	docker compose exec -T postgres psql -U postgres -d ais -c \
	  "TRUNCATE vessel_positions, vessel_latest_state, alerts, pipeline_metrics;"
	docker compose exec -T kafka kafka-consumer-groups \
	  --bootstrap-server localhost:9092 --group detector \
	  --topic ais.positions.clean --reset-offsets --to-earliest --execute 2>/dev/null || true
	@echo "State reset complete. Reference baselines preserved."

dashboard:       ## Start Next.js surveillance console (http://127.0.0.1:3000)
	docker compose --profile ui up -d
	@echo "Next.js surveillance dashboard running at http://127.0.0.1:3000"

demo:            ## Replay sample AIS positions to Kafka
	uv run --no-sync --project backend python3 -m streaming.producer --speedup 60

live:            ## Stream live real-time AIS data from AISStream.io WebSocket
	uv run --no-sync --project backend python3 -m streaming.aisstream_producer

stream:          ## Run consumer and sweeper
	@./scripts/check_prior.sh
	docker compose --profile stream up -d

geofences:       ## Seed EEZ, MPA, and Port geofences into PostGIS
	uv run --no-sync --project backend python3 -m data_pipeline.load_geofences

prior:           ## Build coverage prior baseline
	uv run --no-sync --project backend python3 -m analysis.build_coverage_prior

train:           ## Train IsolationForest trajectory anomaly model
	uv run --no-sync --project backend python3 -m detection.train

evaluate:        ## Run Precision/Recall & ablation evaluation against ground truth
	uv run --no-sync --project backend python3 -m evaluation.evaluate

test:            ## Run pytest test suite for backend
	uv run --no-sync --project backend pytest backend/tests/ -v

lint:            ## Lint Python codebase with ruff
	uv run --no-sync --project backend ruff check backend/

ci: lint test    ## Run complete CI check (lint + test)
