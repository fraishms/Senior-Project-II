import { Router } from "express";
import { RowDataPacket } from "mysql2";
import { pool } from "../db";
import { AuthedRequest, requireAuth } from "../auth";
import { mondayOf, checkAboveAverage } from "../analytics";

export const consumptionRouter = Router();
consumptionRouter.use(requireAuth);

// UC-03 Add Weekly Consumption (re-submitting the same week updates it)
consumptionRouter.post("/", async (req: AuthedRequest, res) => {
  const { date, units, billAmount } = req.body ?? {};
  const unitsNum = Number(units);
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return res.status(400).json({ error: "Invalid date" });
  if (!Number.isFinite(unitsNum) || unitsNum < 0) {
    return res.status(400).json({ error: "units must be a non-negative number" });
  }
  let bill: number | null = null;
  if (billAmount !== undefined && billAmount !== null && billAmount !== "") {
    bill = Number(billAmount);
    if (!Number.isFinite(bill) || bill < 0) {
      return res.status(400).json({ error: "billAmount must be a non-negative number" });
    }
  }
  let weekStart: string;
  try {
    weekStart = mondayOf(date);
  } catch {
    return res.status(400).json({ error: "Invalid date" });
  }
  await pool.query(
    `INSERT INTO consumption_records (user_id, week_start, units_consumed, bill_amount)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE units_consumed = VALUES(units_consumed), bill_amount = VALUES(bill_amount)`,
    [req.userId, weekStart, unitsNum, bill],
  );
  const [historyRows] = await pool.query<RowDataPacket[]>(
    "SELECT week_start AS weekStart, units_consumed AS units FROM consumption_records WHERE user_id = ? ORDER BY week_start ASC",
    [req.userId],
  );
  const history = historyRows.map((row) => ({ weekStart: String(row.weekStart).slice(0, 10), units: Number(row.units) }));
  const alert = checkAboveAverage(history);
  if (alert) await pool.query(
    `INSERT INTO alerts (user_id, alert_type, message) SELECT ?, ?, ? FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM alerts WHERE user_id = ? AND message = ?)`,
    [req.userId, alert.type, alert.message, req.userId, alert.message],
  );
  else await pool.query("DELETE FROM alerts WHERE user_id = ? AND alert_type = 'ABOVE_AVERAGE'", [req.userId]);
  res.status(201).json({ weekStart, units: unitsNum });
});

// History, oldest first
consumptionRouter.get("/", async (req: AuthedRequest, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT week_start AS weekStart, units_consumed AS units, bill_amount AS billAmount
     FROM consumption_records WHERE user_id = ? ORDER BY week_start ASC`,
    [req.userId],
  );
  res.json(rows.map((r) => ({ ...r, units: Number(r.units), billAmount: r.billAmount === null ? null : Number(r.billAmount) })));
});

consumptionRouter.put("/:weekStart", async (req: AuthedRequest, res) => {
  const weekStart = String(req.params.weekStart);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return res.status(400).json({ error: "weekStart must be YYYY-MM-DD" });
  try { if (mondayOf(weekStart) !== weekStart) return res.status(400).json({ error: "weekStart must be a Monday" }); } catch { return res.status(400).json({ error: "Invalid date" }); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return res.status(400).json({ error: "weekStart must be YYYY-MM-DD" });
  try { if (mondayOf(weekStart) !== weekStart) return res.status(400).json({ error: "weekStart must be a Monday" }); } catch { return res.status(400).json({ error: "Invalid date" }); }
  const units = Number(req.body?.units);
  if (!Number.isFinite(units) || units < 0) return res.status(400).json({ error: "units must be a non-negative number" });
  const rawBill = req.body?.billAmount;
  const bill = rawBill === undefined || rawBill === null || rawBill === "" ? null : Number(rawBill);
  if (bill !== null && (!Number.isFinite(bill) || bill < 0)) return res.status(400).json({ error: "billAmount must be a non-negative number" });
  const [existing] = await pool.query<RowDataPacket[]>("SELECT record_id FROM consumption_records WHERE user_id = ? AND week_start = ?", [req.userId, weekStart]);
  if (!existing.length) return res.status(404).json({ error: "Weekly record not found" });
  await pool.query("UPDATE consumption_records SET units_consumed = ?, bill_amount = ? WHERE user_id = ? AND week_start = ?", [units, bill, req.userId, weekStart]);
  await refreshAlertState(Number(req.userId));
  res.json({ weekStart, units, billAmount: bill });
});

consumptionRouter.delete("/:weekStart", async (req: AuthedRequest, res) => {
  const weekStart = String(req.params.weekStart);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return res.status(400).json({ error: "weekStart must be YYYY-MM-DD" });
  try { if (mondayOf(weekStart) !== weekStart) return res.status(400).json({ error: "weekStart must be a Monday" }); } catch { return res.status(400).json({ error: "Invalid date" }); }
  const [existing] = await pool.query<RowDataPacket[]>("SELECT record_id FROM consumption_records WHERE user_id = ? AND week_start = ?", [req.userId, weekStart]);
  if (!existing.length) return res.status(404).json({ error: "Weekly record not found" });
  await pool.query("DELETE FROM consumption_records WHERE user_id = ? AND week_start = ?", [req.userId, weekStart]);
  await refreshAlertState(Number(req.userId));
  res.status(204).end();
});

async function refreshAlertState(userId: number): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT week_start AS weekStart, units_consumed AS units FROM consumption_records WHERE user_id = ? ORDER BY week_start ASC", [userId]);
  const history = rows.map((row) => ({ weekStart: String(row.weekStart).slice(0, 10), units: Number(row.units) }));
  const alert = checkAboveAverage(history);
  await pool.query("DELETE FROM alerts WHERE user_id = ? AND alert_type = 'ABOVE_AVERAGE'", [userId]);
  if (alert) await pool.query("INSERT INTO alerts (user_id, alert_type, message) VALUES (?, ?, ?)", [userId, alert.type, alert.message]);
}
