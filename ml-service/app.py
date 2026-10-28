from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from model import NotEnoughDataError, predict_next_month
from tariff import HIGH_RATE_SAR_PER_KWH, TIER_LIMIT_KWH

app = FastAPI(title="Electricity Prediction Service")


class PredictRequest(BaseModel):
    weekly_units: list[float] = Field(..., description="Historical kWh per week, oldest first")
    price_per_kwh: float | None = Field(default=None, ge=0, description="Optional flat-rate override")
    high_rate_per_kwh: float = Field(default=HIGH_RATE_SAR_PER_KWH, ge=0)
    tier_limit_kwh: float = Field(default=TIER_LIMIT_KWH, ge=0)


class PredictResponse(BaseModel):
    weekly_units: list[float]
    predicted_units: float
    predicted_bill: float
    model: str
    lower_units: float
    upper_units: float


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if any(v < 0 for v in req.weekly_units):
        raise HTTPException(status_code=422, detail="weekly_units must be non-negative")
    try:
        result = predict_next_month(req.weekly_units, req.price_per_kwh, req.high_rate_per_kwh, req.tier_limit_kwh)
    except NotEnoughDataError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return PredictResponse(**result.__dict__)
