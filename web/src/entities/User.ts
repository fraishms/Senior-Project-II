import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "users" })
@Unique("uq_users_email", ["email"])
export class User {
  @PrimaryGeneratedColumn({ name: "user_id", type: "int", unsigned: true }) userId!: number;
  @Column({ name: "full_name", type: "varchar", length: 100 }) fullName!: string;
  @Column({ type: "varchar", length: 255 }) email!: string;
  @Column({ name: "password_hash", type: "varchar", length: 255, select: false }) passwordHash!: string;
  @Column({ name: "price_per_kwh", type: "decimal", precision: 6, scale: 4, default: 0.18 }) pricePerKwh!: number;
  @Column({ name: "tariff_mode", type: "enum", enum: ["tiered", "flat_override"], default: "tiered" }) tariffMode!: "tiered" | "flat_override";
  @Column({ name: "tier_limit_kwh", type: "decimal", precision: 10, scale: 2, default: 6000 }) tierLimitKwh!: number;
  @Column({ name: "high_rate_per_kwh", type: "decimal", precision: 6, scale: 4, default: 0.3 }) highRatePerKwh!: number;
  @CreateDateColumn({ name: "created_at", type: "datetime" }) createdAt!: Date;
}
