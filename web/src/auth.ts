import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config";

export interface AuthedRequest extends Request {
  userId?: number;
}

export function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: "7d" });
}

/** Restricts a route to the authenticated owner (NFR: access limited to the owner). */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    const payload = jwt.verify(token, config.jwtSecret) as unknown as { sub: number };
    req.userId = Number(payload.sub);
    next();
  } catch {
    res.status(401).json({ error: "Not authenticated" });
  }
}
