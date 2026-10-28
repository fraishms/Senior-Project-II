"""Progressive consumption tariff used for a four-week monthly estimate."""

TIER_LIMIT_KWH = 6000.0
BASE_RATE_SAR_PER_KWH = 0.18
HIGH_RATE_SAR_PER_KWH = 0.30


def calculate_bill(monthly_units: float, base_rate: float = BASE_RATE_SAR_PER_KWH,
                   high_rate: float = HIGH_RATE_SAR_PER_KWH,
                   tier_limit: float = TIER_LIMIT_KWH) -> float:
    """Charge the first tier at base_rate and only excess usage at high_rate."""
    if monthly_units < 0:
        raise ValueError("monthly_units must be non-negative")
    if base_rate < 0 or high_rate < 0 or tier_limit < 0:
        raise ValueError("tariff values must be non-negative")
    lower_tier_units = min(monthly_units, tier_limit)
    excess_units = max(0.0, monthly_units - tier_limit)
    return round(lower_tier_units * base_rate + excess_units * high_rate, 2)
