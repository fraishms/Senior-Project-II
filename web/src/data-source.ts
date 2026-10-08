import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "./config";
import { User } from "./entities/User";
import { ConsumptionRecord } from "./entities/ConsumptionRecord";
import { PredictionResult } from "./entities/PredictionResult";
import { Alert } from "./entities/Alert";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: config.db.host,
  port: config.db.port,
  username: config.db.user,
  password: config.db.password,
  database: config.db.database,
  entities: [User, ConsumptionRecord, PredictionResult, Alert],
  migrations: ["dist/migrations/*.js"],
  synchronize: false,
  migrationsTableName: "typeorm_migrations",
});
