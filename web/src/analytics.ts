// Pure analytics helpers (no I/O) so they are easy to unit-test.

export interface WeekRecord {
  weekStart: string; // YYYY-MM-DD (Monday)
  units: number;     // kWh
}

/** Returns the Monday (YYYY-MM-DD) of the week containing the given date string. */
export function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  const day = d.getUTCDay();            // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export interface Comparison {
  current: number;
  previous: number;
  change: number;        // kWh
  changePercent: number | null; // null when previous is 0
}

/** Compares the latest week with the one before it (records oldest first). */
export function compareLastTwoWeeks(records: WeekRecord[]): Comparison | null {
  if (records.length < 2) return null;
  const current = records[records.length - 1].units;
  const previous = records[records.length - 2].units;
  return {
    current,
    previous,
    change: round2(current - previous),
    changePercent: previous === 0 ? null : round2(((current - previous) / previous) * 100),
  };
}

export const ALERT_FACTOR = 1.2; // alert when usage is 20% above the user's average
export const MIN_HISTORY_FOR_ALERT = 3;

export interface AlertResult {
  type: "ABOVE_AVERAGE";
  message: string;
}

/** Checks whether the latest week exceeds the average of the earlier weeks. */
export function checkAboveAverage(records: WeekRecord[]): AlertResult | null {
  if (records.length < MIN_HISTORY_FOR_ALERT + 1) return null;
  const latest = records[records.length - 1];
  const avg = average(records.slice(0, -1).map((r) => r.units));
  if (avg > 0 && latest.units > avg * ALERT_FACTOR) {
    const pct = Math.round(((latest.units - avg) / avg) * 100);
    return {
      type: "ABOVE_AVERAGE",
      message: `Usage for the week of ${latest.weekStart} (${latest.units} kWh) is ${pct}% above your average of ${round2(avg)} kWh.`,
    };
  }
  return null;
}

export function energySavingTips(alert: AlertResult | null, month = new Date().getUTCMonth() + 1): string[] {
  const general = [
    "Set air conditioners to 24°C or higher; each degree lower raises consumption noticeably.",
    "Switch off lights and appliances in rooms nobody is using.",
    "Unplug chargers and devices on standby.",
  ];
  const severe = alert && /\b([4-9]\d|\d{3,})% above/.test(alert.message);
  const seasonal = month >= 6 && month <= 9 ? ["During the summer, set the air conditioner to 24°C or higher and keep doors and windows closed."] : [];
  if (!alert) return [...seasonal, ...general];
  return [...(severe ? ["Your usage is more than 40% above average. Check air conditioning, water heating, and other high-load appliances first."] : ["Your usage is 20% to 40% above average. Check which appliances ran more than usual this week."]), ...seasonal, ...general];
}

export interface MonthlyRecord { month: string; units: number; weeks: number; partial: boolean }

/** Weeks belong to the calendar month containing their Monday week_start. */
export function groupMonthly(records: WeekRecord[]): MonthlyRecord[] {
  const groups = new Map<string, { units: number; weeks: number }>();
  for (const record of records) {
    const month = record.weekStart.slice(0, 7);
    const value = groups.get(month) ?? { units: 0, weeks: 0 };
    value.units += record.units;
    value.weeks += 1;
    groups.set(month, value);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({
    month, units: round2(value.units), weeks: value.weeks, partial: value.weeks < 4,
  }));
}

export function monthComparison(months: MonthlyRecord[]): { current: MonthlyRecord; previous: MonthlyRecord; changePercent: number | null } | null {
  if (months.length < 2) return null;
  const current = months[months.length - 1];
  const previous = months[months.length - 2];
  return { current, previous, changePercent: previous.units === 0 ? null : round2((current.units - previous.units) / previous.units * 100) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
