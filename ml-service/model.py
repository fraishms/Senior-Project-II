"""Short-history mean and evaluated seasonal Random Forest for weekly usage."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from tariff import BASE_RATE_SAR_PER_KWH, HIGH_RATE_SAR_PER_KWH, TIER_LIMIT_KWH, calculate_bill

MIN_WEEKS = 4          # fewer records than this -> not enough history
HORIZON_WEEKS = 4      # one month ahead
# Synthetic rolling-origin MAE for the baseline by history length (see results.md).
BASELINE_MAE = {8: 49.09, 16: 50.11, 26: 41.60}


class NotEnoughDataError(ValueError):
    pass


@dataclass
class Prediction:
    weekly_units: list[float]
    predicted_units: float
    predicted_bill: float
    model: str
    lower_units: float
    upper_units: float


def predict_next_month(weekly_units: list[float], price_per_kwh: float | None = None,
                       high_rate_per_kwh: float = HIGH_RATE_SAR_PER_KWH,
                       tier_limit_kwh: float = TIER_LIMIT_KWH) -> Prediction:
    """Predict the next 4 weeks of consumption and the resulting bill.

    weekly_units: historical kWh per week, oldest first, one value per week.
    """
    if len(weekly_units) < MIN_WEEKS:
        raise NotEnoughDataError(
            f"At least {MIN_WEEKS} weekly records are required, got {len(weekly_units)}."
        )
    base_rate = BASE_RATE_SAR_PER_KWH if price_per_kwh is None else price_per_kwh
    if base_rate < 0 or high_rate_per_kwh < 0 or tier_limit_kwh < 0:
        raise ValueError("price_per_kwh must be non-negative")

    y = np.asarray(weekly_units, dtype=float)
    recent = y[-4:]
    weekly_mean = float(np.mean(recent))
    future = np.repeat(weekly_mean, HORIZON_WEEKS)
    nearest_history = min(BASELINE_MAE, key=lambda size: abs(size - len(y)))
    error_margin = BASELINE_MAE[nearest_history]
    model_name = "last_four_week_mean"

    total = float(future.sum())
    return Prediction(
        weekly_units=[round(float(v), 2) for v in future],
        predicted_units=round(total, 2),
        predicted_bill=calculate_bill(total, base_rate, high_rate_per_kwh, tier_limit_kwh),
        model=model_name,
        lower_units=round(max(0, total - error_margin), 2),
        upper_units=round(total + error_margin, 2),
    )
