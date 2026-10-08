import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { authRouter } from "./routes/auth";
import { consumptionRouter } from "./routes/consumption";
import { insightsRouter } from "./routes/insights";
import { AppDataSource } from "./data-source";

export const app = express();
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
let databaseReady: Promise<void> | null = null;
app.use((_req, _res, next) => {
  databaseReady ??= (async () => {
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
  })();
  databaseReady.then(() => next(), next);
});
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many authentication attempts. Try again later." } }));
app.use("/api/auth", authRouter);
app.use("/api/consumption", consumptionRouter);
app.use("/api", insightsRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
app.use(express.static(process.env.PUBLIC_DIR ?? (process.env.NODE_ENV === "production" ? "/app/public" : "public")));
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err instanceof Error ? err.name : "Request error");
  res.status(500).json({ error: "Internal server error" });
});
