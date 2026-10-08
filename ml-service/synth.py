"""Deterministic synthetic weekly electricity histories for model evaluation."""
import numpy as np


def generate_series(weeks: int, seed: int = 42) -> list[float]:
    rng = np.random.default_rng(seed)
    t = np.arange(weeks)
    seasonal = 70 + 35 * np.sin(2 * np.pi * (t - 18) / 52)
    trend = 0.22 * t
    noise = rng.normal(0, 7, weeks)
    values = seasonal + trend + noise
    for idx in range(weeks):
        if idx > 0 and rng.random() < 0.035:
            values[idx] += rng.uniform(25, 55)
    return np.maximum(values, 0).round(2).tolist()
