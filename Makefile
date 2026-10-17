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
	  --topic ais.positions.raw --reset-offsets --to-earliest --execute 2>/dev/null || true
	@echo "State reset complete. Reference baselines preserved."

score:           ## Run Isolation Forest ML trajectory anomaly scorer on recent windows
	uv run --no-sync --project backend python3 -m detection.ml_scorer

dashboard:       ## Start Next.js surveillance console (http://127.0.0.1:3000)
	docker compose --profile ui up -d
	@echo "Next.js surveillance dashboard running at http://127.0.0.1:3000"

demo:            ## Replay sample AIS positions to Kafka
	uv run --no-sync --project backend python3 -m streaming.producer --speedup 60 --input-file data/raw/demo_scenarios.csv

inject:          ## Inject anomaly scenario into Kafka stream (SCENARIO=spoof|collision|loiter|rendezvous|dark|ml_anomaly|all)
	uv run --no-sync --project backend python3 -m streaming.injector --scenario $(or $(SCENARIO),spoof)

inject-all:      ## Inject all anomaly scenarios sequentially into Kafka stream
	uv run --no-sync --project backend python3 -m streaming.injector --scenario all

live:            ## Stream live real-time AIS data from AISStream.io WebSocket
	uv run --no-sync --project backend python3 -m streaming.aisstream_producer

stream:          ## Run consumer, sweeper, scorer, and metrics telemetry daemon
	@./scripts/check_prior.sh
	docker compose --profile stream up -d

metrics:         ## Run pipeline telemetry collector directly
	uv run --no-sync --project backend python3 -m monitoring.metrics

geofences:       ## Seed EEZ, MPA, and Port geofences into PostGIS
	uv run --no-sync --project backend python3 -m data_pipeline.load_geofences

prior:           ## Build H3 coverage prior baseline using PySpark
	uv run --no-sync --project backend python3 -m analysis.build_coverage_prior --use-spark

train:           ## Train distributed Spark MLlib trajectory anomaly model
	uv run --no-sync --project backend python3 -m detection.train --engine mllib

spark-up:        ## Start standalone containerized Spark master and worker cluster
	docker compose --profile batch up -d spark-master spark-worker
	@echo "Spark Master Web UI available at http://127.0.0.1:8080"

spark-down:      ## Stop containerized Spark cluster
	docker compose --profile batch stop spark-master spark-worker

evaluate:        ## Run Precision/Recall & ablation evaluation against ground truth
	uv run --no-sync --project backend python3 -m evaluation.evaluate

test:            ## Run pytest test suite for backend
	env -u SPARK_HOME uv run --no-sync --project backend pytest backend/tests/ -v

lint:            ## Lint Python codebase with ruff
	uv run --no-sync --project backend ruff check backend/

ci: lint test    ## Run complete CI check (lint + test)
