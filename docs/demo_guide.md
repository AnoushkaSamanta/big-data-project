# CSE412 Project Evaluation: Recorded Demonstration Walkthrough Guide

This document provides a scene-by-scene script, terminal commands, and user interface actions to record the **$\le 10$-minute project demonstration video** required by the **CSE412: Big Data & Large-Scale Computing** evaluation rubric.

---

## Video Specifications
- **Maximum Duration**: 10 minutes (strictly enforced by course guidelines).
- **Format**: Screen recording (1080p, 60 FPS recommended) with clear voiceover audio.
- **Presenter**: Can be presented by one member or split among the 3 team members.

---

## Scene-by-Scene Storyboard & Script

### Scene 1: Problem Context & The Coverage Trap (0:00 – 1:30)
- **Visual**: Show slide or open browser to `http://localhost:3000` showing the coastal boundary line off San Francisco and open ocean.
- **Presenter Voiceover**:
  > *"Hello, welcome to our demonstration of the Real-Time Dark Vessel Detection System for CSE412. Maritime vessels are legally required under IMO SOLAS to broadcast AIS transponder signals. However, illegal fishing fleets and sanctions-evading tankers deliberately disable their transponders or broadcast spoofed GPS coordinates.*
  > 
  > *Most conventional surveillance tools use a naive flat silence threshold—flagging any ship silent for more than three hours as dark. We discovered that this approach is fundamentally broken: terrestrial VHF radio operates line-of-sight, with an effective range of only 50 to 75 nautical miles. Consequently, legitimate ships sailing into the open Pacific trigger hundreds of false alarms. Our system solves this coverage dilemma by coupling streaming ingestion with distributed spatial baselines."*

---

### Scene 2: Architectural Data Flow & Course Tools (1:30 – 3:30)
- **Visual**: Show terminal with Docker services and display the architecture diagram (`docs/architecture.md`).
- **Commands to Show in Terminal**:
  ```bash
  # Show running containers: Kafka KRaft, PostGIS, Next.js, and background streaming workers
  docker compose ps
  
  # Check Kafka topics and partition structure
  make topics
  ```
- **Presenter Voiceover**:
  > *"Our pipeline satisfies Track D & E by integrating three genuine big data tools:
  > First, **Apache Kafka in KRaft mode** serves as our distributed message buffer. Incoming AIS messages are partitioned across 6 partitions keyed by MMSI to guarantee strict per-vessel ordering.
  > 
  > Second, **Apache Spark Core and SQL** run distributed batch jobs over millions of historical NOAA Cadastre records, calculating empirical inter-ping gap percentiles—p50, p95, and p99—grouped by Uber H3 resolution-5 hexagonal cells.
  > 
  > Third, **Apache Spark MLlib** fits an unsupervised KMeans clustering pipeline over 1-hour vessel movement vectors to detect anomalous maneuvers.
  > 
  > For storage, **PostgreSQL 16 with PostGIS 3.4** maintains a hot state table and range-partitioned cold history, and our **Next.js and Deck.gl** tactical console provides real-time GPU-accelerated situational awareness."*

---

### Scene 3: Live Ingestion & Arrival-Path Anomaly Detection (3:30 – 5:30)
- **Visual**: Split screen: Terminal on left, Browser on right (`http://localhost:3000`).
- **Commands**:
  ```bash
  # Start replaying demo stream
  make demo
  
  # Inject GPS Jump-and-Return spoofing scenario
  make inject SCENARIO=spoof
  ```
- **Presenter Voiceover**:
  > *"Let's trigger live streaming traffic. As messages flow into Kafka, our consumer validates ITU sentinels and executes micro-batch upserts to PostGIS. Notice on the map how vessels appear in real time with color-coded commercial vessel classifications.
  > 
  > Now, we inject a live GPS Spoofing attack. Watch the alert feed on the left: an instant alert is triggered for MMSI 367404000. Clicking the alert shows the evidence audit: the vessel jumped 78 kilometers at an implied speed of over 120 knots before returning to its original track. Our 3-ping sliding window verified that the jump leg violates physical speed limits, confirming a fraudulent transmission."*

---

### Scene 4: The Absence Sweeper & Dark Vessel Detection (5:30 – 7:30)
- **Visual**: Browser zoomed on the Monterey Bay / Farallones area, terminal showing sweeper logs.
- **Commands**:
  ```bash
  # Inject a deliberate dark vessel transponder deactivation
  make inject SCENARIO=dark
  ```
- **Presenter Voiceover**:
  > *"Now for the central paradox of dark vessel detection: a ship that turns off its transponder emits nothing. Therefore, no incoming message can trigger its detection!
  > 
  > To solve this, our speed layer runs an independent **Absence Sweeper** on a 60-second timer. It scans the hot state table and calculates an anomaly gap score: the observed silence divided by the empirical p99 gap for that specific H3 cell and transceiver class.
  > 
  > Look at the screen: the sweeper tick executes, and a high-severity `dark_vessel` alert appears. Furthermore, because the vessel was cruising at 14 knots when it went dark, our system computes a dead-reckoning probability drift cone, predicting where the vessel could be heading for naval interdiction."*

---

### Scene 5: Tactical Command Console & Analytics (7:30 – 8:45)
- **Visual**: Navigate to the `/analytics` page in the Next.js UI (`http://localhost:3000/analytics`).
- **Presenter Voiceover**:
  > *"Here in our analytics operations center, Apache ECharts visualizes streaming pipeline health and maritime risk metrics in real time. We monitor consumer lag, batch insert latency (averaging under 15 milliseconds), and the distribution of anomaly types. Operators can filter by risk tier, inspect the high-risk vessel leaderboard, and drill down into full historical voyage tracks."*

---

### Scene 6: Quantitative Benchmarks, Ablation & Test Suite (8:45 – 10:00)
- **Visual**: Terminal executing test and evaluation targets:
  ```bash
  # Run test suite
  make test
  
  # Run benchmark evaluation
  make evaluate
  ```
- **Presenter Voiceover**:
  > *"We verified the pipeline against 310 ground-truth injected scenarios across 12 million NOAA records.
  > 
  > Our automated test suite passes 41 comprehensive unit and integration tests across rules, MLlib models, and streaming processors.
  > 
  > In our quantitative evaluation, the system achieves an overall **F1-score of 0.949** and **Precision of 0.946**. Most importantly, our ablation benchmark confirms that spatial H3 coverage gating delivers a **92.9% reduction in false alarms** compared to naive thresholding.
  > 
  > In conclusion, our system demonstrates how coupling distributed big data tools with maritime domain physics creates an effective, production-grade surveillance platform. Thank you!"*
