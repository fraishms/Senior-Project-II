import "dotenv/config";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const db = await mysql.createConnection({ host: process.env.DB_HOST ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER ?? "root", password: process.env.DB_PASSWORD ?? "", database: process.env.DB_NAME ?? "smart_electricity" });
const hash = await bcrypt.hash("DemoPass123!", 10);
const [userResult] = await db.execute<mysql.ResultSetHeader>("INSERT INTO users (full_name,email,password_hash,tariff_mode,price_per_kwh,tier_limit_kwh,high_rate_per_kwh) VALUES (?,?,?,'tiered',0.18,6000,0.30) ON DUPLICATE KEY UPDATE user_id=LAST_INSERT_ID(user_id)", ["Demo User", "demo@example.com", hash]);
const demoId = userResult.insertId;
const [smallResult] = await db.execute<mysql.ResultSetHeader>("INSERT INTO users (full_name,email,password_hash,tariff_mode,price_per_kwh,tier_limit_kwh,high_rate_per_kwh) VALUES (?,?,?,'tiered',0.18,6000,0.30) ON DUPLICATE KEY UPDATE user_id=LAST_INSERT_ID(user_id)", ["New User", "new@example.com", hash]);
const smallId = smallResult.insertId;
const now = new Date();
const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const day = monday.getUTCDay(); monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
const rows = [];
for (let i = 25; i >= 0; i--) {
  const start = new Date(monday); start.setUTCDate(start.getUTCDate() - 7 * i);
  const summer = start.getUTCMonth() >= 5 && start.getUTCMonth() <= 8;
  const noise = ((i * 37) % 17 - 8) * 1.7;
  const spike = i === 2 ? 130 : 0;
  rows.push([demoId, start.toISOString().slice(0, 10), Math.round((180 * (summer ? 1.4 : 1) + noise + spike) * 100) / 100, null]);
}
await db.query("INSERT INTO consumption_records (user_id,week_start,units_consumed,bill_amount) VALUES ? ON DUPLICATE KEY UPDATE units_consumed=VALUES(units_consumed),bill_amount=VALUES(bill_amount)", [rows]);
const twoWeeks = [1, 0].map((offset) => { const start = new Date(monday); start.setUTCDate(start.getUTCDate() - 7 * offset); return [smallId, start.toISOString().slice(0, 10), 165 + offset * 8, null]; });
await db.query("INSERT INTO consumption_records (user_id,week_start,units_consumed,bill_amount) VALUES ? ON DUPLICATE KEY UPDATE units_consumed=VALUES(units_consumed),bill_amount=VALUES(bill_amount)", [twoWeeks]);
console.log("Seeded demo@example.com (DemoPass123!) and new@example.com (DemoPass123!)");
await db.end();
