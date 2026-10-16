import pandas as pd
from evaluation.evaluate import match_alerts_to_ground_truth


def test_match_alerts_to_ground_truth_perfect_match():
    # 2 GT injections
    t0 = pd.Timestamp("2024-01-15 12:00:00+00:00")
    df_gt = pd.DataFrame([
        {"id": 1, "mmsi": 111, "anomaly_type": "dark", "t_start": t0, "t_end": t0 + pd.Timedelta(hours=2)},
        {"id": 2, "mmsi": 222, "anomaly_type": "dark", "t_start": t0, "t_end": t0 + pd.Timedelta(hours=2)},
    ])

    # 2 alerts exactly matching the 2 MMSIs in the window
    df_alerts = pd.DataFrame([
        {"id": 101, "mmsi": 111, "detected_at": t0 + pd.Timedelta(minutes=30)},
        {"id": 102, "mmsi": 222, "detected_at": t0 + pd.Timedelta(minutes=45)},
    ])

    res = match_alerts_to_ground_truth(df_gt, df_alerts)
    assert res["Total Injected"] == 2
    assert res["True Positives"] == 2
    assert res["False Positives"] == 0
    assert res["Precision"] == 1.0
    assert res["Recall"] == 1.0
    assert res["F1-Score"] == 1.0


def test_match_alerts_to_ground_truth_spurious_alert():
    t0 = pd.Timestamp("2024-01-15 12:00:00+00:00")
    df_gt = pd.DataFrame([
        {"id": 1, "mmsi": 111, "anomaly_type": "dark", "t_start": t0, "t_end": t0 + pd.Timedelta(hours=2)},
    ])

    # 1 valid alert on 111, and 1 spurious alert on 999 (innocent vessel)
    df_alerts = pd.DataFrame([
        {"id": 101, "mmsi": 111, "detected_at": t0 + pd.Timedelta(minutes=30)},
        {"id": 102, "mmsi": 999, "detected_at": t0 + pd.Timedelta(minutes=45)},
    ])

    res = match_alerts_to_ground_truth(df_gt, df_alerts)
    assert res["Total Injected"] == 1
    assert res["True Positives"] == 1
    assert res["False Positives"] == 1
    assert res["Precision"] == 0.5
    assert res["Recall"] == 1.0


def test_match_alerts_to_ground_truth_multiple_alerts_for_same_event():
    # In streaming, a detector may fire multiple alerts for the same ongoing dark event
    t0 = pd.Timestamp("2024-01-15 12:00:00+00:00")
    df_gt = pd.DataFrame([
        {"id": 1, "mmsi": 111, "anomaly_type": "dark", "t_start": t0, "t_end": t0 + pd.Timedelta(hours=2)},
    ])

    df_alerts = pd.DataFrame([
        {"id": 101, "mmsi": 111, "detected_at": t0 + pd.Timedelta(minutes=30)},
        {"id": 102, "mmsi": 111, "detected_at": t0 + pd.Timedelta(minutes=60)},
    ])

    res = match_alerts_to_ground_truth(df_gt, df_alerts)
    assert res["Total Injected"] == 1
    assert res["True Positives"] == 1
    # The second alert during the true anomaly is not falsely marked as a spurious false alarm
    assert res["False Positives"] == 0
    assert res["Precision"] == 1.0
    assert res["Recall"] == 1.0
