import { Router } from "express";
import { RowDataPacket } from "mysql2";
import { pool } from "../db";
import { AuthedRequest, requireAuth } from "../auth";
import { WeekRecord, average, compareLastTwoWeeks, energySavingTips, groupMonthly, monthComparison, round2 } from "../analytics";
import { config } from "../config";
import { checkAboveAverage } from "../analytics";

const DEFAULT_TARIFF = { tierLimitKwh: 6000, baseRatePerKwh: 0.18, highRatePerKwh: 0.30 };

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

async function loadHistory(userId: number): Promise<WeekRecord[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT week_start AS weekStart, units_consumed AS units FROM consumption_records WHERE user_id = ? ORDER BY week_start ASC", [userId],
  );
  return rows.map((r) => ({ weekStart: String(r.weekStart).slice(0, 10), units: Number(r.units) }));
}

insightsRouter.get("/dashboard", async (req: AuthedRequest, res) => {
  const history = await loadHistory(req.userId!);
  const alert = checkAboveAverage(history);
  const [alertRows] = await pool.query<RowDataPacket[]>("SELECT alert_id AS id, alert_type AS type, message, created_at AS createdAt FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", [req.userId]);
  const [predictionRows] = await pool.query<RowDataPacket[]>("SELECT prediction_month AS predictionMonth, predicted_units AS predictedUnits, predicted_bill AS predictedBill FROM prediction_results WHERE user_id = ? ORDER BY generated_at DESC LIMIT 5", [req.userId]);
  res.json({ history, averageWeeklyUnits: round2(average(history.map((h) => h.units))), comparison: compareLastTwoWeeks(history), alert, alerts: alertRows, predictions: predictionRows, tips: energySavingTips(alert) });
});

insightsRouter.get("/dashboard/monthly", async (req: AuthedRequest, res) => {
  const months = groupMonthly(await loadHistory(req.userId!));
  res.json({ months, comparison: monthComparison(months), weekMapping: "A week belongs to the calendar month containing its Monday week_start." });
});

insightsRouter.get("/me", async (req: AuthedRequest, res) => {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT full_name AS fullName, email, price_per_kwh AS pricePerKwh, tariff_mode AS tariffMode, tier_limit_kwh AS tierLimitKwh, high_rate_per_kwh AS highRatePerKwh FROM users WHERE user_id = ?", [req.userId]);
  if (!rows[0]) return res.status(404).json({ error: "Account not found" });
  const mode = String(rows[0].tariffMode ?? "tiered");
  const flatOverride = mode === "flat_override" ? Number(rows[0].pricePerKwh) : null;
  res.json({ ...rows[0], tariffMode: mode, pricePerKwh: flatOverride, tierLimitKwh: Number(rows[0].tierLimitKwh ?? DEFAULT_TARIFF.tierLimitKwh), baseRatePerKwh: Number(rows[0].pricePerKwh ?? DEFAULT_TARIFF.baseRatePerKwh), highRatePerKwh: Number(rows[0].highRatePerKwh ?? DEFAULT_TARIFF.highRatePerKwh) });
});

insightsRouter.patch("/me", async (req: AuthedRequest, res) => {
  const { fullName, pricePerKwh, tariffMode } = req.body ?? {};
  const name = typeof fullName === "string" ? fullName.trim() : "";
  const mode = tariffMode === "flat_override" ? "flat_override" : tariffMode === undefined || tariffMode === "tiered" ? "tiered" : null;
  const hasFlatOverride = mode === "flat_override";
  const price = hasFlatOverride ? Number(pricePerKwh) : DEFAULT_TARIFF.baseRatePerKwh;
  if (!name || name.length > 100) return res.status(400).json({ error: "Name must be between 1 and 100 characters" });
  if (!mode) return res.status(400).json({ error: "Tariff mode must be tiered or flat_override" });
  if (hasFlatOverride && (!Number.isFinite(price) || price <= 0 || price > 5)) return res.status(400).json({ error: "Flat tariff override must be greater than 0 and at most 5 SAR/kWh" });
  await pool.query("UPDATE users SET full_name = ?, price_per_kwh = ?, tariff_mode = ? WHERE user_id = ?", [name, price, mode, req.userId]);
  res.json({ fullName: name, pricePerKwh: hasFlatOverride ? price : null, tariffMode: mode, ...DEFAULT_TARIFF });
});

insightsRouter.post("/predict", async (req: AuthedRequest, res) => {
  const history = await loadHistory(req.userId!);
  const [users] = await pool.query<RowDataPacket[]>("SELECT price_per_kwh, tariff_mode, tier_limit_kwh, high_rate_per_kwh FROM users WHERE user_id = ?", [req.userId]);
  const savedRate = Number(users[0]?.price_per_kwh ?? DEFAULT_TARIFF.baseRatePerKwh);
  const flatOverride = users[0]?.tariff_mode === "flat_override" ? savedRate : null;
  const tierLimit = Number(users[0]?.tier_limit_kwh ?? DEFAULT_TARIFF.tierLimitKwh);
  const highRate = Number(users[0]?.high_rate_per_kwh ?? DEFAULT_TARIFF.highRatePerKwh);
  let response: globalThis.Response;
  try {
    response = await fetch(`${config.mlServiceUrl}/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weekly_units: history.map((h) => h.units), price_per_kwh: flatOverride, high_rate_per_kwh: highRate, tier_limit_kwh: tierLimit }), signal: AbortSignal.timeout(5000) });
  } catch { return res.status(503).json({ error: "Prediction service is unavailable" }); }
  const body = await response.json() as { predicted_units?: number; predicted_bill?: number; weekly_units?: number[]; lower_units?: number; upper_units?: number; detail?: string };
  if (!response.ok) return res.status(422).json({ error: body.detail ?? "Prediction failed" });
  const next = new Date();
  const predictionMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  await pool.query("INSERT INTO prediction_results (user_id, prediction_month, predicted_units, predicted_bill) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE predicted_units = VALUES(predicted_units), predicted_bill = VALUES(predicted_bill), generated_at = CURRENT_TIMESTAMP", [req.userId, predictionMonth, body.predicted_units, body.predicted_bill]);
  res.json({ predictionMonth, predictedUnits: body.predicted_units, predictedBill: body.predicted_bill, weeklyUnits: body.weekly_units, lowerUnits: body.lower_units, upperUnits: body.upper_units, tariffMode: flatOverride === null ? "tiered" : "flat_override", flatRate: flatOverride, tierLimitKwh: tierLimit, baseRatePerKwh: flatOverride ?? DEFAULT_TARIFF.baseRatePerKwh, highRatePerKwh: highRate });
});

insightsRouter.get("/alerts", async (req: AuthedRequest, res) => {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT alert_id AS id, alert_type AS type, message, created_at AS createdAt FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", [req.userId]);
  res.json(rows);
});
