from unittest.mock import MagicMock
from monitoring.metrics import collect_vessel_counts, collect_e2e_latency


def test_collect_vessel_counts_mocked():
    cur = MagicMock()
    cur.fetchone.return_value = {
        "active_count": 10,
        "dark_count": 2,
        "stale_count": 1,
        "total_msgs": 54321,
    }
    counts = collect_vessel_counts(cur)
    assert counts["active"] == 10
    assert counts["dark"] == 2
    assert counts["stale"] == 1
    assert counts["total_msgs"] == 54321


def test_collect_e2e_latency_mocked():
    cur = MagicMock()
    cur.fetchone.return_value = {"p95_latency": 2.45}
    lat = collect_e2e_latency(cur)
    assert lat == 2.45


def test_collect_e2e_latency_empty():
    cur = MagicMock()
    cur.fetchone.return_value = {"p95_latency": None}
    lat = collect_e2e_latency(cur)
    assert lat == 0.0
