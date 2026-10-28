import pytest
from fastapi.testclient import TestClient

from app import app
from model import NotEnoughDataError, predict_next_month
from tariff import calculate_bill


def test_short_history_uses_recent_mean_and_range():
    # 10, 12, 14, 16 -> last-four mean is 13 kWh/week.
    p = predict_next_month([10, 12, 14, 16], price_per_kwh=0.5)
    assert p.weekly_units == [13.0, 13.0, 13.0, 13.0]
    assert p.predicted_units == 52.0
    assert p.predicted_bill == 26.0
    assert p.lower_units <= p.predicted_units <= p.upper_units
    assert p.upper_units - p.predicted_units == 49.09


def test_prediction_never_negative():
    p = predict_next_month([30, 20, 10, 5], price_per_kwh=0.2)
    assert all(v >= 0 for v in p.weekly_units)
    assert p.predicted_units >= 0


def test_prediction_model_is_deterministic_for_long_history():
    history = [80 + (i % 9) * 4 for i in range(26)]
    first = predict_next_month(history, 0.2)
    second = predict_next_month(history, 0.2)
    assert first == second
    assert first.model == "last_four_week_mean"


def test_progressive_tariff_boundaries():
    assert calculate_bill(0) == 0
    assert calculate_bill(6000) == 1080
    assert calculate_bill(6001) == 1080.30
    assert calculate_bill(7000) == 1380
    assert calculate_bill(7000, base_rate=0.5, high_rate=0.5) == 3500


def test_api_accepts_tiered_defaults_and_flat_override():
    c = TestClient(app)
    tiered = c.post("/predict", json={"weekly_units": [1500, 1500, 1500, 1500]})
    assert tiered.status_code == 200
    assert tiered.json()["predicted_bill"] == 1080
    flat = c.post("/predict", json={"weekly_units": [1500, 1500, 1500, 1500], "price_per_kwh": 0.25})
    assert flat.json()["predicted_bill"] == 1500


def test_prediction_uses_progressive_tariff_and_flat_override():
    history = [1500, 1500, 1500, 1500]  # predicts 6000 kWh
    tiered = predict_next_month(history)
    assert tiered.predicted_bill == 1080
    flat = predict_next_month(history, price_per_kwh=0.25)
    assert flat.predicted_bill == 1500


def test_too_little_data():
    with pytest.raises(NotEnoughDataError):
        predict_next_month([10, 12, 14], price_per_kwh=0.2)


def test_api_predict_and_validation():
    c = TestClient(app)
    ok = c.post("/predict", json={"weekly_units": [10, 12, 14, 16], "price_per_kwh": 0.5})
    assert ok.status_code == 200
    assert ok.json()["predicted_units"] == 52.0
    short = c.post("/predict", json={"weekly_units": [1, 2], "price_per_kwh": 0.5})
    assert short.status_code == 422
    neg = c.post("/predict", json={"weekly_units": [1, -2, 3, 4], "price_per_kwh": 0.5})
    assert neg.status_code == 422
