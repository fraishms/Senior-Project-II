import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.DB_NAME ??= "smart_electricity_test";
process.env.DB_HOST ??= "127.0.0.1";
process.env.JWT_SECRET ??= "test-only-secret-at-least-32-characters";
if (process.env.DB_NAME !== "smart_electricity_test") throw new Error("API tests require DB_NAME=smart_electricity_test");
if (process.env.RUN_API_INTEGRATION !== "1") {
  test("UC-00: API integration suite skipped (set RUN_API_INTEGRATION=1 with test database)", { skip: true }, () => {});
} else {

const { app } = require("../app") as typeof import("../app");
const { pool } = require("../db") as typeof import("../db");
const { AppDataSource } = require("../data-source") as typeof import("../data-source");
let token = "";
const email = `test-${Date.now()}@example.com`;

test("UC-00: API integration suite (test DB only)", async (suite) => {
  await suite.test("UC-00: database name guard", () => assert.equal(process.env.DB_NAME, "smart_electricity_test"));
  await suite.test("UC-01: registration validation and success", async () => {
    assert.equal((await request(app).post("/api/auth/register").send({ email: "bad", password: "password123" })).status, 400);
    assert.equal((await request(app).post("/api/auth/register").send({ email, password: "short" })).status, 400);
    const response = await request(app).post("/api/auth/register").send({ email, password: "password123", fullName: "Test User" });
    assert.equal(response.status, 201); token = response.body.token;
  });
  await suite.test("UC-01: duplicate email returns 409", async () => assert.equal((await request(app).post("/api/auth/register").send({ email, password: "password123" })).status, 409));
  await suite.test("UC-02: login errors do not reveal whether email exists", async () => {
    const wrong = await request(app).post("/api/auth/login").send({ email, password: "wrongpassword" });
    const missing = await request(app).post("/api/auth/login").send({ email: "missing@example.com", password: "wrongpassword" });
    assert.equal(wrong.status, 401); assert.equal(wrong.body.error, missing.body.error);
    assert.equal((await request(app).post("/api/auth/login").send({ email, password: "password123" })).status, 200);
  });
  await suite.test("UC-03: protected write normalizes to Monday and rejects negative units", async () => {
    assert.equal((await request(app).post("/api/consumption").send({ date: "2026-10-07", units: 120 })).status, 401);
    assert.equal((await request(app).post("/api/consumption").set("Authorization", `Bearer ${token}`).send({ date: "2026-10-07", units: -1 })).status, 400);
    const response = await request(app).post("/api/consumption").set("Authorization", `Bearer ${token}`).send({ date: "2026-10-07", units: 120 });
    assert.equal(response.status, 201); assert.equal(response.body.weekStart, "2026-10-05");
  });
  await suite.test("UC-03: duplicate week updates the existing row", async () => {
    await request(app).post("/api/consumption").set("Authorization", `Bearer ${token}`).send({ date: "2026-10-08", units: 135 });
    const [rows] = await pool.query<any[]>("SELECT units_consumed FROM consumption_records WHERE user_id = (SELECT user_id FROM users WHERE email = ?) AND week_start = '2026-10-05'", [email]);
    assert.equal(rows.length, 1); assert.equal(Number(rows[0].units_consumed), 135);
  });
  await suite.test("UC-03: invalid date and foreign delete are rejected", async () => {
    assert.equal((await request(app).post("/api/consumption").set("Authorization", `Bearer ${token}`).send({ date: "2026-02-31", units: 3 })).status, 400);
    const other = await request(app).post("/api/auth/register").send({ email: `foreign-${Date.now()}@example.com`, password: "password123" });
    assert.equal((await request(app).delete("/api/consumption/2026-10-05").set("Authorization", `Bearer ${other.body.token}`)).status, 404);
  });
  await suite.test("UC-04: dashboard read is side-effect free and unknown route is 404", async () => {
    const [beforeRows] = await pool.query<any[]>("SELECT alert_id FROM alerts");
    assert.equal((await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`)).status, 200);
    const [afterRows] = await pool.query<any[]>("SELECT alert_id FROM alerts");
    assert.equal(beforeRows.length, afterRows.length);
    assert.equal((await request(app).get("/api/not-a-route").set("Authorization", `Bearer ${token}`)).status, 404);
  });
  await suite.test("UC-04: settings are isolated to the authenticated account", async () => {
    const other = await request(app).post("/api/auth/register").send({ email: `settings-${Date.now()}@example.com`, password: "password123" });
    await request(app).patch("/api/me").set("Authorization", `Bearer ${token}`).send({ fullName: "Owned Name", pricePerKwh: 0.3 });
    const theirs = await request(app).get("/api/me").set("Authorization", `Bearer ${other.body.token}`);
    assert.notEqual(theirs.body.fullName, "Owned Name"); assert.notEqual(theirs.body.pricePerKwh, 0.3);
  });
  await suite.test("UC-04: a user cannot read or change another user's record", async () => {
    const other = await request(app).post("/api/auth/register").send({ email: `other-${Date.now()}@example.com`, password: "password123" });
    const foreign = await request(app).put("/api/consumption/2026-10-05").set("Authorization", `Bearer ${other.body.token}`).send({ units: 999 });
    assert.equal(foreign.status, 404);
    const list = await request(app).get("/api/consumption").set("Authorization", `Bearer ${other.body.token}`);
    assert.deepEqual(list.body, []);
  });
  await suite.test("UC-04: account tariff and name validation", async () => {
    assert.equal((await request(app).patch("/api/me").set("Authorization", `Bearer ${token}`).send({ fullName: "Test", tariffMode: "flat_override", pricePerKwh: 0 })).status, 400);
    const ok = await request(app).patch("/api/me").set("Authorization", `Bearer ${token}`).send({ fullName: "Test Name", tariffMode: "flat_override", pricePerKwh: 0.25 });
    assert.equal(ok.status, 200); assert.equal(ok.body.pricePerKwh, 0.25);
    const tiered = await request(app).patch("/api/me").set("Authorization", `Bearer ${token}`).send({ fullName: "Test Name", tariffMode: "tiered" });
    assert.equal(tiered.body.tariffMode, "tiered");
    const flat = await request(app).patch("/api/me").set("Authorization", `Bearer ${token}`).send({ fullName: "Test Name", tariffMode: "flat_override", pricePerKwh: 0.25 });
    assert.equal(flat.body.tariffMode, "flat_override"); assert.equal(flat.body.pricePerKwh, 0.25);
  });
  await suite.test("UC-04: invalid flat tariff mode is rejected", async () => {
    const response = await request(app).patch("/api/me").set("Authorization", `Bearer ${token}`).send({ fullName: "Test Name", tariffMode: "unknown" });
    assert.equal(response.status, 400);
  });
  await suite.test("UC-04: monthly endpoint responds with grouped totals", async () => {
    const response = await request(app).get("/api/dashboard/monthly").set("Authorization", `Bearer ${token}`);
    assert.equal(response.status, 200); assert.ok(Array.isArray(response.body.months));
  });
  await pool.end();
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
});
}
