import { test } from "node:test";
import assert from "node:assert/strict";
import { mondayOf, compareLastTwoWeeks, checkAboveAverage, groupMonthly, energySavingTips } from "../analytics";

test("mondayOf maps any day to its Monday", () => {
  assert.equal(mondayOf("2026-10-08"), "2026-10-05"); // Thursday
  assert.equal(mondayOf("2026-10-05"), "2026-10-05"); // Monday
  assert.equal(mondayOf("2026-10-11"), "2026-10-05"); // Sunday
  assert.throws(() => mondayOf("not-a-date"));
});

test("compareLastTwoWeeks", () => {
  assert.equal(compareLastTwoWeeks([{ weekStart: "2026-10-05", units: 10 }]), null);
  const c = compareLastTwoWeeks([
    { weekStart: "2026-09-28", units: 100 },
    { weekStart: "2026-10-05", units: 120 },
  ]);
  assert.deepEqual(c, { current: 120, previous: 100, change: 20, changePercent: 20 });
});

test("checkAboveAverage needs history and a >20% jump", () => {
  const base = [100, 100, 100].map((units, i) => ({ weekStart: `2026-09-${7 + i * 7}`, units }));
  assert.equal(checkAboveAverage([...base, { weekStart: "2026-09-28", units: 110 }]), null);
  const a = checkAboveAverage([...base, { weekStart: "2026-09-28", units: 150 }]);
  assert.equal(a?.type, "ABOVE_AVERAGE");
  assert.equal(checkAboveAverage(base), null); // not enough history
});

test("monthly totals use week_start month across year boundaries", () => {
  const months = groupMonthly([
    { weekStart: "2025-12-29", units: 100 }, { weekStart: "2026-01-05", units: 110 },
    { weekStart: "2026-01-12", units: 120 }, { weekStart: "2026-01-19", units: 130 },
  ]);
  assert.deepEqual(months.map((m) => m.month), ["2025-12", "2026-01"]);
  assert.equal(months[0].partial, true);
  assert.equal(months[1].units, 360);
});

test("UC-06: alert tips reflect severity and summer", () => {
  const moderate = energySavingTips({ type: "ABOVE_AVERAGE", message: "Usage 30% above average" }, 2);
  const severe = energySavingTips({ type: "ABOVE_AVERAGE", message: "Usage 50% above average" }, 7);
  assert.match(moderate[0], /20% to 40%/);
  assert.match(severe[0], /more than 40%/);
  assert.ok(severe.some((tip) => /summer/i.test(tip)));
});
