import { Router } from "express";
import bcrypt from "bcryptjs";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { pool } from "../db";
import { signToken } from "../auth";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// UC-01 Register Account
authRouter.post("/register", async (req, res) => {
  const { fullName, email, password } = req.body ?? {};
  if (typeof email !== "string" || email.length > 255 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  if (typeof fullName === "string" && fullName.trim().length > 100) return res.status(400).json({ error: "Name must be at most 100 characters" });
  const name = typeof fullName === "string" && fullName.trim() ? fullName.trim() : email.split("@")[0];

  const [existing] = await pool.query<RowDataPacket[]>("SELECT user_id FROM users WHERE email = ?", [email.toLowerCase()]);
  if (existing.length > 0) return res.status(409).json({ error: "Email is already registered" });

  const hash = await bcryptHash(password);
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)",
    [name, email.toLowerCase(), hash],
  );
  res.status(201).json({ token: signToken(result.insertId) });
});

// UC-02 Log In
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT user_id, password_hash FROM users WHERE email = ?",
    [email.toLowerCase()],
  );
  const user = rows[0];
  // Same message for unknown email and wrong password, so accounts can't be enumerated.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  res.json({ token: signToken(user.user_id) });
});

function bcryptHash(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
